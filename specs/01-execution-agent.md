# 01-execution-agent — Implementation Decisions & Execution Log

## Overview

Implementing `specs/01-initial-setup.md`: initial setup of a task/team/goal management app ("meldtask") in an empty Turborepo monorepo. Three new packages created — database, backend API, and frontend — plus root infrastructure updates.

---

## 1. Root-Level Infrastructure

### `.npmrc`
**Decision:** Added `shamefully-hoist=true` and `strict-peer-dependencies=false`.

**Why:** pnpm's strict module isolation prevents Prisma from finding its own binaries (they expect to be at the root `node_modules`). `shamefully-hoist` flattens the hoisting so Prisma works. `strict-peer-dependencies=false` prevents pnpm 9 from erroring on unmet optional peer deps from Radix/shadcn transitive dependencies.

### `turbo.json`
**Decision:** Replaced `.next/**` build outputs with `dist/**` (generic). Added tasks for `db:generate`, `db:push`, `db:migrate`, `db:studio`.

**Why:** The old turbo.json was Next.js-specific (leftover from deleted `apps/web` and `apps/docs`). The new pipeline is framework-agnostic: Vite outputs to `dist/`, Express compiles to `dist/`. DB tasks are uncached (`cache: false`) because they have filesystem/database side effects.

### Root `package.json`
**Decision:** Added filter-scoped scripts: `dev:web`, `dev:api`, `build:web`, `build:api`, `db:generate`, `db:push`, `db:migrate`, `db:studio`.

**Why:** Convenience. `turbo run dev` runs everything; `turbo run dev --filter=@meldtask/web` runs just the frontend. The `db:generate` and `db:push` delegate to turbo so they run in the correct package context.

### Root `tsconfig.json`
**Decision:** Created with `ESNext`/`Bundler` module settings and project `references` to `apps/web`, `apps/api`, `packages/db`.

**Why:** Gives the IDE a root-level TypeScript config so it can resolve all workspace packages without opening each one individually. Project references enable `tsc -b` build mode across packages.

---

## 2. Database Package (`packages/db`)

### Package naming
**Decision:** Named `@repo/db` (not `@meldtask/db`), following the existing `@repo/*` convention from the Turborepo starter.

**Why:** Consistency with `@repo/eslint-config` and `@repo/typescript-config`. Infrastructure packages use the `@repo` scope; application packages use `@meldtask`.

### Module system
**Decision:** ESM (`"type": "module"`). tsconfig overrides base's `NodeNext` to `ESNext`/`Bundler`.

**Why:** The shared base tsconfig uses `NodeNext` module resolution (requires `.js` extensions in relative imports), but Turborepo packages typically export `.ts` source directly and let the consumer's bundler resolve them. `Bundler` mode allows extensionless imports like `import { prisma } from "@repo/db"` to work. Same pattern used in `apps/api` and `apps/web`.

### Prisma schema
**Decision:** Single `User` model with `id` (cuid), `email` (unique), `name`, `avatarUrl`, `googleId` (unique, nullable), `password` (nullable for email-password users), `createdAt`, `updatedAt`.

**Why:** Google OAuth users have `googleId` set, `password` null. Email users have `password` set, `googleId` null. Both paths are supported. `email` remains unique across both auth methods. No separate `Account`/`Session` models — keep it simple for the initial setup.

### PrismaClient singleton
**Decision:** Global singleton pattern in `src/client.ts` — stores PrismaClient on `globalThis` in non-production to survive hot-reload.

**Why:** `tsx watch` restarts the Node process on file changes. Without a singleton, each restart creates a new PrismaClient instance, quickly exhausting database connections.

### Exports
**Decision:** Barrel export from `src/index.ts`: `prisma` client instance + `User` type re-exported from `@prisma/client`.

**Why:** Consumers (`apps/api`) only need one import: `import { prisma } from "@repo/db"`. The `User` type is re-exported so the API doesn't need a direct dependency on `@prisma/client`.

---

## 3. Backend API (`apps/api`)

### Framework
**Decision:** Express (not Fastify, not Hono). Plain `express` + `cors` + `dotenv`.

**Why:** Express is the most widely understood Node.js framework. The spec said "typescript + express." Kept dependencies minimal — no ORM layer on top of Prisma, no validation library yet (can add Zod later).

### Auth flow — Google
**Decision:** POST-only endpoint. Frontend sends Google ID token → backend verifies with `google-auth-library` → upserts user via `prisma.user.upsert` (match on `googleId`) → returns JWT + user object.

**Why:** Server-side token verification is critical for security — the backend validates with Google's API, not just trusting the client. `upsert` handles both new-user registration and returning-user login in one query. Matching on `googleId` (not `email`) allows users to change their Google email without breaking their account.

### Auth flow — Email/password
**Decision:** Single `POST /api/auth/email` endpoint that handles both login and register. If user exists → verify password (login). If user doesn't exist → hash password + create user (register). bcryptjs with 12 salt rounds. Minimum 8-char password.

**Why:** Simple UX — one endpoint for both flows. `bcryptjs` chosen over `bcrypt` because it's a pure JS implementation (no native compilation needed, works everywhere). 12 rounds is a good balance of security and speed for an MVP.

### JWT
**Decision:** `jsonwebtoken` library. 7-day expiry. Secret from `JWT_SECRET` env var (falls back to hardcoded dev secret). Payload: only `{ userId }`.

**Why:** Stateless auth — no session table needed. 7 days is generous for an MVP. No refresh token mechanism yet (can add later). Dev secret fallback lets the API start without env vars configured (useful during initial setup).

### Middleware
**Decision:** `authenticate` middleware extracts Bearer token from `Authorization` header, verifies JWT, attaches `userId` to `req`. `errorHandler` catches unhandled errors and returns 500.

**Why:** Standard Express middleware pattern. Token in `Authorization` header is the most portable approach (works with any client, avoids cookie CSRF concerns). Errors are caught globally rather than per-route.

### CORS
**Decision:** CORS middleware allows `FRONTEND_URL` env var (default `http://localhost:3000`). `credentials: true` for future cookie support.

**Why:** In development, the Vite dev proxy handles all `/api` requests, so CORS is never exercised. But the middleware is there as a safety net for production or direct API access. The Vite dev proxy approach (configured in `vite.config.ts`) eliminates CORS issues entirely during development.

### Running the API
**Decision:** `tsx watch src/index.ts` for dev (hot-reload on file changes). `tsc` for production build → `node dist/index.js` to run.

**Why:** `tsx` is the simplest way to run TypeScript directly without a build step. `tsx watch` restarts on changes. `tsc` compile for production is standard. No bundler needed for the backend.

---

## 4. Frontend (`apps/web`)

### Build tooling
**Decision:** Vite 6 + `@vitejs/plugin-react` + `@tailwindcss/vite` plugin. No CRA, no Next.js, no additional bundlers.

**Why:** The spec explicitly says "vite + react." Tailwind CSS v4 provides a dedicated Vite plugin that handles CSS processing with zero PostCSS config needed beyond an empty `postcss.config.js`. The Vite plugin approach is the recommended Tailwind v4 setup.

### Styling — Tailwind CSS v4
**Decision:** CSS-first configuration via `@import "tailwindcss"` in `src/index.css`. No `tailwind.config.js` or `tailwind.config.ts`.

**Why:** Tailwind v4 eliminated JS-based config. Everything lives in CSS:
- `@import "tailwindcss"` — loads Tailwind
- `@variant dark (&:where(.dark, .dark *))` — defines the dark mode variant
- `@theme inline { ... }` — maps CSS custom properties to Tailwind utility classes (e.g., `bg-background`, `text-foreground`, `border-border`)

### Dark theme
**Decision:** Deep dark palette using oklch color space. Applied via `<html class="dark">` in `index.html` — forces dark mode universally (no light mode toggle).

**Why:** The spec says "the theme will be on complete deep dark mode." Using `class="dark"` on `<html>` makes the entire page dark from the first paint — no flash of light mode. oklch color space was chosen for perceptual uniformity and better dark color rendering. All colors are CSS custom properties, making them easy to override or theme later.

**Color values:**
| Token | Value | Usage |
|---|---|---|
| `--background` | `oklch(0.145 0 0)` | Main page background (very dark) |
| `--foreground` | `oklch(0.985 0 0)` | Primary text (near white) |
| `--card` | `oklch(0.165 0 0)` | Card/panel backgrounds (slightly lighter than page) |
| `--sidebar` | `oklch(0.12 0 0)` | Sidebar background (darker than page) |
| `--border` | `oklch(0.269 0 0)` | Borders and separators |
| `--muted` | `oklch(0.269 0 0)` | Muted/sunken surfaces |
| `--muted-foreground` | `oklch(0.708 0 0)` | Secondary text |

The sidebar is intentionally darker than the main background to create visual hierarchy.

### shadcn/ui setup
**Decision:** Manually pre-configured instead of running `shadcn init`. Dependencies declared in `package.json` (`@radix-ui/*`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`). The `cn()` utility written at `src/lib/utils.ts`. The `@theme inline` block in `src/index.css` maps the shadcn CSS variable naming convention to Tailwind utilities.

**Why:** Running `shadcn init` is interactive and requires user input. By pre-configuring everything, the user can simply run `pnpm dlx shadcn@latest add button input avatar dropdown-menu separator tooltip` to add the component source files without needing to configure anything. All the boilerplate shadcn usually generates is already in place:
- `cn()` at `src/lib/utils.ts`
- CSS variables at `src/index.css`
- Radix primitives in `package.json`
- Path alias `@/*` in `tsconfig.json` and `vite.config.ts`

Note: The user still needs to run the `shadcn add` command to copy the actual `.tsx` component files into `src/components/ui/` — but no config prompts will appear since the setup is already done.

### Routing
**Decision:** `react-router-dom` v7 with `BrowserRouter`. Three routes:
- `/login` — public (redirects to `/` if already authenticated)
- `/` — protected (redirects to `/login` if not authenticated)
- `*` — catch-all, redirects to `/`

**Why:** Simple client-side routing. `ProtectedRoute` and `PublicRoute` components handle auth gating. Loading state shows a spinner while checking auth status on initial mount (prevents flash of login page for authenticated users).

### Auth state management
**Decision:** React Context (`AuthContext`) with `useState` + `useEffect`. Token stored in `localStorage`. On mount, if token exists, calls `GET /api/me` to validate and fetch user. On login, stores token + sets user. On logout, removes token + clears user.

**Why:** localStorage is the simplest persistence for an MVP. The `/api/me` validation on mount ensures the token is still valid (catches expired/invalid tokens). Context was chosen over Redux/Zustand because auth state is simple (just `user | null` and a loading flag). Can migrate to httpOnly cookies or a state management library later.

### API client (`src/lib/api.ts`)
**Decision:** Typed fetch wrappers: `apiGet<T>()`, `apiPost<T>()`. All paths are relative (`/api/...`). Auth token auto-injected from localStorage into `Authorization: Bearer` header. Errors thrown as `Error` with the server's `error` message.

**Why:** Relative paths mean the Vite dev proxy handles routing to the backend — no absolute URLs needed. Centralized auth header injection avoids repeating the token logic in every component. Typed generics (`apiGet<{ user: User }>("/me")`) provide end-to-end type safety at the call site.

### Vite dev proxy
**Decision:** Vite proxies all `/api/*` requests to `http://localhost:3001` with `changeOrigin: true`.

**Why:** Eliminates CORS issues entirely during development. The frontend code only uses relative paths like `/api/auth/google`. In production, a reverse proxy (nginx, Cloudflare, etc.) would handle this — or the frontend and API would be on the same origin.

### Sidebar
**Decision:** Fixed left sidebar (`w-64` / 16rem), hidden off-screen on mobile (`-translate-x-full`), slides in when hamburger menu is clicked. Nav items: Dashboard, Tasks, Teams, Goals, Settings (all hardcoded with lucide icons). Mobile overlay backdrop with click-to-close.

**Why:** Fixed sidebar is standard for dashboard layouts. The responsive approach uses CSS translate for smooth animation — no drawer library needed. The mobile hamburger appears at the top-left with `lg:hidden` (only visible below 1024px). At `lg:` breakpoint, the sidebar is always visible.

### Topbar
**Decision:** Sticky header, offset by sidebar width (`lg:pl-72`). Centered search input with `Search` icon, placeholder "Search everything...". Right-side profile dropdown with avatar (initials fallback), name, chevron. Dropdown items: View Profile + Logout (red). Outside-click-to-close via `mousedown` listener + ref.

**Why:** Centered search matches the spec requirement. The profile dropdown uses a portal-free approach (relative positioning + ref-based outside-click detection) — simpler than Radix dropdown for a single menu. The avatar shows initials extracted from the user's name (first letters of first+last name, max 2 chars) as fallback when `avatarUrl` is null.

### Layout composition
**Decision:** `DashboardLayout` composes `Sidebar` + `Topbar` + `<main>`. Main content area has `pl-0 lg:pl-72` (sidebar width offset on desktop) and `pt-16` (topbar height). Content padding: `p-4 lg:p-6`.

**Why:** Composition pattern keeps each layout component independently testable and reusable. The responsive padding/offset pattern means the sidebar and topbar don't overlap content at any breakpoint.

### Login page
**Decision:** Centered card layout. Uses `@react-oauth/google`'s `GoogleOAuthProvider` + `GoogleLogin` component (filled_black theme, pill shape, "signin_with" text). The `GOOGLE_CLIENT_ID` is read from `VITE_GOOGLE_CLIENT_ID` env var (via `import.meta.env`).

**Why:** `@react-oauth/google` handles the entire Google One Tap / OAuth popup flow — Google ID token is returned to the callback. The `filled_black` theme matches the dark UI. `VITE_GOOGLE_CLIENT_ID` is a Vite env var (must be prefixed with `VITE_` to be exposed to client code).

### Dashboard page
**Decision:** Welcome message with user's first name. Three placeholder stats cards (Tasks, Teams, Goals) in a responsive grid (`sm:grid-cols-2 lg:grid-cols-3`). Each card: border, card background, heading, "No X yet" placeholder text.

**Why:** Placeholder cards give immediate visual feedback that the dashboard is functional. The responsive grid adapts from 1 column (mobile) → 2 (tablet) → 3 (desktop). These cards are ready to be replaced with real data components.

### Entry point (`main.tsx`)
**Decision:** `StrictMode` wrapper, renders `<App />` into `#root`. CSS imported at entry (not in `index.html`) so Vite processes it through the Tailwind plugin.

**Why:** CSS must go through Vite's pipeline for Tailwind to process it (the `@tailwindcss/vite` plugin transforms the CSS). Importing in JS ensures this. `StrictMode` is standard React practice for catching side-effect bugs during development.

---

## 5. Environment Variables

### `.env.example` files
**Decision:** Three `.env.example` files created:
- `packages/db/.env.example` — `DATABASE_URL`
- `apps/api/.env.example` — `PORT`, `FRONTEND_URL`, `GOOGLE_CLIENT_ID`, `JWT_SECRET`, `DATABASE_URL`
- `apps/web/.env.example` — `VITE_GOOGLE_CLIENT_ID`

Each file includes:
- A description of what the variable does
- The format/example value
- Instructions for how to obtain the value (e.g., Google Cloud Console URL)

**Why:** The spec says "put them into the example env with proper comments and all. i will add value to it. also add what could be the value for the each variable (as example) comment." Three separate `.env.example` files (one per package) keep configuration close to where it's used. The user copies each to `.env` and fills in real values.

### `DATABASE_URL` duplication
**Decision:** `DATABASE_URL` appears in both `packages/db/.env.example` and `apps/api/.env.example`.

**Why:** The db package declares it as a dependency, but `dotenv` in the API loads from the API's own `.env` (or a root `.env`). In practice, the user can either: set it once in a root `.env`, set it per-package, or set it as a shell environment variable. Having it in both example files ensures it's documented wherever it's needed.

---

## 6. Module System & TypeScript Configuration

### ESM everywhere
**Decision:** All three new packages use `"type": "module"`. tsconfig overrides base's `NodeNext` module resolution to `ESNext`/`Bundler`.

**Why:** The shared base tsconfig uses `NodeNext` which requires `.js` extensions in relative imports (`import { foo } from "./bar.js"`). This is correct for Node.js but breaks Turborepo's internal package resolution (where packages export `.ts` source directly). `Bundler` mode allows extensionless imports while still supporting `package.json` exports. All chosen dependencies (`express`, `jsonwebtoken`, `google-auth-library`, `@prisma/client`, `@react-oauth/google`, etc.) support ESM imports.

### Path alias (`@/*`)
**Decision:** `apps/web` maps `@/*` → `./src/*` in both `tsconfig.json` (`paths`) and `vite.config.ts` (`resolve.alias`).

**Why:** Both are required. `paths` in tsconfig tells TypeScript how to resolve `@/lib/utils` during type-checking. `resolve.alias` in Vite tells the bundler how to resolve it at build/runtime. Without the Vite alias, imports will fail at runtime even if TypeScript is happy. This is a standard Vite + path alias pattern.

### ESLint
**Decision:** `apps/api` uses `@repo/eslint-config/base`. `apps/web` uses `@repo/eslint-config/react-internal`.

**Why:** The base config includes TypeScript-ESLint + Prettier + Turbo plugin. The react-internal config adds React hooks + browser globals. No Next.js config used (these aren't Next.js apps). The `turbo/no-undeclared-env-vars` rule warns when env vars are used without being declared in `turbo.json` inputs.

---

## 7. Dependencies

### Key dependency choices

| Package | Dependency | Why |
|---|---|---|
| `packages/db` | `@prisma/client` v6 | Latest stable Prisma major version |
| `packages/db` | `tsx` v4 | Run TypeScript directly in Node (for dev and seeds) |
| `apps/api` | `express` v4 | Spec requirement; most widely understood |
| `apps/api` | `google-auth-library` v9 | Official Google server-side auth library |
| `apps/api` | `jsonwebtoken` v9 | Standard JWT signing/verification |
| `apps/api` | `bcryptjs` v2 | Pure JS bcrypt (no native compilation) |
| `apps/api` | `cors` v2 | CORS middleware for Express |
| `apps/api` | `dotenv` v16 | Load `.env` files into `process.env` |
| `apps/web` | `react` + `react-dom` v19 | Latest React major version |
| `apps/web` | `react-router-dom` v7 | Latest react-router major version |
| `apps/web` | `@react-oauth/google` v0.12 | Official Google OAuth React wrapper |
| `apps/web` | `@radix-ui/*` v1-v2 | Headless UI primitives (shadcn/ui foundation) |
| `apps/web` | `lucide-react` v0.468 | Icon library (used by shadcn + custom components) |
| `apps/web` | `tailwindcss` v4 | Spec requirement; CSS-first config |
| `apps/web` | `@tailwindcss/vite` v4 | Tailwind v4 Vite plugin |
| `apps/web` | `vite` v6 | Spec requirement; latest Vite major |
| `apps/web` | `@vitejs/plugin-react` v4 | Official React Fast Refresh for Vite |

### Dev dependencies consistency
**Decision:** All packages use `typescript` ^5.9.2 and `eslint` ^9.39.1 — consistent with the root devDependencies and existing eslint-config package.

**Why:** Single version of TypeScript and ESLint across the monorepo avoids version conflicts in the IDE and during turbo runs. pnpm's strict resolution ensures only one copy is installed.

---

## 8. What Was NOT Done (Future Work)

These items are intentionally deferred:

1. **shadcn/ui component files** — The `src/components/ui/` directory is empty. The user must run `pnpm dlx shadcn@latest add button input avatar dropdown-menu separator tooltip` to copy the component source files. All configuration is in place so this will work with zero prompts.

2. **Email auth UI** — The backend supports `POST /api/auth/email` but the frontend Login page only shows Google sign-in. Adding email/password form fields to the Login page is a quick follow-up.

3. **Database migrations** — Currently using `prisma db push` (prototyping). Switch to `prisma migrate dev` for production to get migration history.

4. **Refresh tokens** — JWTs have 7-day expiry with no refresh mechanism. For production, add refresh tokens stored in httpOnly cookies.

5. **httpOnly cookies** — Tokens are stored in localStorage (vulnerable to XSS). For production, switch to httpOnly, Secure, SameSite cookies.

6. **Environment variable validation** — No Zod or env-var validation on startup. The API will start with missing env vars and fail at runtime on first auth attempt.

7. **Rate limiting** — No rate limiting on auth endpoints. Add `express-rate-limit` before production.

8. **Tests** — No test files created. Add vitest for frontend, vitest or jest for backend.

9. **CI/CD** — No GitHub Actions or CI config. The Turborepo starter includes a basic workflow that can be adapted.

10. **The remaining deleted files** — `apps/docs/` and `packages/ui/` are still tracked as deleted in git but not yet committed. Run `git add -A && git commit` to clean up.

---

## 9. File Manifest

All 42 files created/modified:

```
Root (4 files):
  .npmrc                              (modified)
  turbo.json                          (modified)
  package.json                        (modified)
  tsconfig.json                       (created)

packages/db (6 files):
  packages/db/package.json            (created)
  packages/db/tsconfig.json           (created)
  packages/db/.env.example            (created)
  packages/db/prisma/schema.prisma    (created)
  packages/db/src/client.ts           (created)
  packages/db/src/index.ts            (created)

apps/api (12 files):
  apps/api/package.json               (created)
  apps/api/tsconfig.json              (created)
  apps/api/eslint.config.js           (created)
  apps/api/.env.example               (created)
  apps/api/src/index.ts               (created)
  apps/api/src/app.ts                 (created)
  apps/api/src/lib/jwt.ts             (created)
  apps/api/src/lib/google.ts          (created)
  apps/api/src/middleware/auth.ts     (created)
  apps/api/src/middleware/errorHandler.ts (created)
  apps/api/src/routes/auth.ts         (created)
  apps/api/src/routes/me.ts           (created)

apps/web (20 files):
  apps/web/package.json               (created)
  apps/web/tsconfig.json              (created)
  apps/web/eslint.config.js           (created)
  apps/web/postcss.config.js          (created)
  apps/web/vite.config.ts             (created)
  apps/web/index.html                 (created)
  apps/web/.env.example               (created)
  apps/web/src/vite-env.d.ts          (created)
  apps/web/src/main.tsx               (created)
  apps/web/src/App.tsx                (created)
  apps/web/src/index.css              (created)
  apps/web/src/lib/utils.ts           (created)
  apps/web/src/lib/api.ts             (created)
  apps/web/src/context/AuthContext.tsx (created)
  apps/web/src/hooks/useAuth.ts       (created)
  apps/web/src/components/GoogleSignInButton.tsx (created)
  apps/web/src/components/layout/Sidebar.tsx     (created)
  apps/web/src/components/layout/Topbar.tsx      (created)
  apps/web/src/components/layout/DashboardLayout.tsx (created)
  apps/web/src/pages/Login.tsx        (created)
  apps/web/src/pages/Dashboard.tsx    (created)
```

---

## 10. Verification Results

| Check | Status | Command |
|---|---|---|
| Dependencies installed | ✅ 507 packages | `pnpm install` |
| Prisma client generated | ✅ Generated in 50ms | `pnpm db:generate` |
| TypeScript — `@repo/db` | ✅ No errors | `pnpm check-types` |
| TypeScript — `@meldtask/api` | ✅ No errors | `pnpm check-types` |
| TypeScript — `@meldtask/web` | ✅ No errors | `pnpm check-types` |

---

## 11. Next Steps for the User

```bash
# 1. Create .env files from templates
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# 2. Edit apps/api/.env with real values:
#    GOOGLE_CLIENT_ID  → from https://console.cloud.google.com/apis/credentials
#    JWT_SECRET        → run: openssl rand -base64 64
#    DATABASE_URL      → your PostgreSQL connection string

# 3. Edit apps/web/.env with:
#    VITE_GOOGLE_CLIENT_ID → same Google Client ID as above

# 4. Push database schema to PostgreSQL
pnpm db:push

# 5. (Optional) Add shadcn/ui component files
cd apps/web
pnpm dlx shadcn@latest add button input avatar dropdown-menu separator tooltip

# 6. Start development
pnpm dev
#    → API:    http://localhost:3001
#    → Web:    http://localhost:3000
```

Open `http://localhost:3000` — the login page with Google Sign-In will appear.
