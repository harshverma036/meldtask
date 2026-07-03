# 02-execution-agent — Teams, User Roles & Admin Management

## Overview

Implemented `specs/02-user-teams.md` plus subsequent iterations covering: domain-restricted login, user roles (Admin/Developer/Manager), admin approval flow, admin invite flow, Teams with many-to-many users, shadcn UI components (Dialog, Button, Input, Sheet), and admin user management (approve, reject, remove access).

Also migrated the frontend stack to comply with `CLAUDE.md` rules: TanStack Query + axios replacing raw fetch, react-toastify for toast notifications, Zod validation on all API endpoints, date-fns for date formatting.

---

## 1. Infrastructure Migration (CLAUDE.md Compliance)

### Dependencies Added
| Package | Version | Purpose |
|---|---|---|
| `axios` | ^1.18.1 | HTTP client replacing raw fetch |
| `@tanstack/react-query` | ^5.101.2 | Server state management, caching, mutations |
| `react-toastify` | ^11.1.0 | Toast notifications for success/error |
| `date-fns` | ^4.4.0 | Date manipulation |
| `zod` | ^4.4.3 | Request validation on all API endpoints |

### Axios Instance (`apps/web/src/lib/axios.ts`)
Single axios instance with:
- `baseURL: "/api"` — Vite dev proxy handles forwarding
- Request interceptor: injects Bearer token from localStorage
- Response interceptor: 401 → clears token, redirects to `/login`
- Replaces deleted `apps/web/src/lib/api.ts`

### Providers (`apps/web/src/App.tsx`)
- `QueryClientProvider` — `staleTime: 5min`, `retry: 1`
- `ToastContainer` — dark theme, bottom-right, auto-close 4s

### Zod Validators (`apps/api/src/lib/validators.ts`)
Schemas: `googleAuthSchema`, `emailAuthSchema`, `updateRoleSchema`, `inviteUserSchema`, `createTeamSchema`, `updateTeamSchema`, `addMemberSchema`. All routes use `safeParse` and return Zod's issue messages.

---

## 2. Database Schema Changes

### User Model — Added Fields
| Field | Type | Default | Purpose |
|---|---|---|---|
| `role` | `UserRole` enum | `Developer` | Admin / Developer / Manager |
| `status` | `UserStatus` enum | `Pending` | Pending / Active / Rejected |
| `domain` | `String?` | null | Extracted from email |

### New Enums
- `UserRole`: Admin, Developer, Manager
- `UserStatus`: Pending, Active, Rejected
- `TeamMemberRole`: Lead, Member

### New Models
```prisma
model Team {
  id          String       @id @default(cuid())
  name        String
  description String?
  createdBy   String
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
  members     TeamMember[]
}

model TeamMember {
  id       String         @id @default(cuid())
  teamId   String
  userId   String
  role     TeamMemberRole @default(Member)
  joinedAt DateTime       @default(now())
  team     Team    @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user     User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([teamId, userId])
}
```

**Relations**: User → TeamMember (one-to-many, one user in multiple teams). Team → TeamMember (one-to-many, one team has multiple members). Cascade deletes on both directions.

---

## 3. Auth System

### Domain Validation
**Allowed domains**: `youngun.in`, `meldit.ai`
**Whitelisted emails**: `harshverma0362@gmail.com`

**Flow on login:**
1. Extract email from Google token or email/password body
2. If whitelisted email → authorized + auto Admin + Active
3. If domain in allowed list → authorized, Developer + Pending
4. Otherwise → 403 "domain not authorized"

### Google Auth (`POST /api/auth/google`)
- Zod validates `{ idToken }`
- Verifies token server-side via `google-auth-library`
- Domain check before upsert
- **Existing user**: checks status (Active → login, Pending → 403 with message, Rejected → 403)
- **New user (whitelisted)**: creates with Admin+Active, returns JWT
- **New user (allowed domain)**: creates with Developer+Pending, returns 403 with pending message

### Email Auth (`POST /api/auth/email`)
- Zod validates `{ email, password, name? }`
- Same domain check and status flow
- Password hashed with bcryptjs (12 rounds) for new registrations
- Handles Google-only accounts error: "This account uses Google Sign-In"

### User Profile (`GET /api/me`)
Returns: id, email, name, avatarUrl, role, status, createdAt

### Auth Middleware (`authenticate`)
Extracts Bearer token from Authorization header, verifies JWT, sets `req.userId`. Returns 401 if missing/invalid.

### Admin Middleware (`requireAdmin`)
Runs after `authenticate`. Fetches user, checks `role === "Admin"` AND `status === "Active"`. Returns 403 if not.

### JWT
`jsonwebtoken` with 7-day expiry. Payload: `{ userId }`. Secret from `JWT_SECRET` env var.

### ESM / dotenv Fix
`apps/api/src/index.ts` uses dynamic `import("./app.js")` after explicit `dotenv.config()` with resolved path. This prevents ESM import hoisting from evaluating `google.ts` (which creates `OAuth2Client` at module scope) before env vars are loaded.

---

## 4. Admin User Management

### Endpoints (all require `authenticate` + `requireAdmin`)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users?status=` | List users with status filter |
| POST | `/api/users/invite` | Invite user by email + role (+ optional teamId) |
| PATCH | `/api/users/:id/approve` | Set Pending → Active |
| PATCH | `/api/users/:id/reject` | Set Pending → Rejected |
| PATCH | `/api/users/:id/role` | Update user role |
| DELETE | `/api/users/:id` | Hard delete user + cascade team memberships |

### Invite Flow
1. Admin enters email + role (+ optional team)
2. `POST /api/users/invite`: validates domain, creates User with `status: Active`
3. If `teamId` provided, adds to team as Member
4. Invited user logs in via Google → matched by email in existing auth flow → already Active → immediate access

### Remove Access
`DELETE /api/users/:id`: hard deletes user, cascades to `TeamMember` records. Prevents self-deletion.

### AdminUsers Page (`/admin/users`)
Two sections:
- **Members** (default): Active users table with role dropdown, "Invite User" button, "Remove Access" (trash) per row with confirm dialog
- **Pending**: Approve/Reject buttons for pending users

Status badges: Active (green), Pending (yellow), Rejected (red). Dates formatted with `date-fns`.

### InviteUserDialog
shadcn Dialog with: Email input, Role select (Developer/Manager/Admin), optional Team select (fetched from `/api/teams`). TanStack Mutation POSTs to `/api/users/invite`. Invalidates both `["admin-users"]` and `["teams"]` queries on success.

---

## 5. Teams System

### Endpoints (all require `authenticate`)

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/teams` | Any | List teams user belongs to |
| POST | `/api/teams` | Any | Create team (+ optional memberEmails), creator=Lead |
| GET | `/api/teams/:id` | Any | Get team with members |
| PATCH | `/api/teams/:id` | Lead/Admin | Update name/description |
| DELETE | `/api/teams/:id` | Lead/Admin | Delete team |
| POST | `/api/teams/:id/members` | Any | Add member by email |
| DELETE | `/api/teams/:id/members/:userId` | Lead/Admin | Remove member |

### Create Team with Members
`POST /api/teams` accepts optional `memberEmails: string[]`. Looks up active users by email, adds them as Members alongside the creator (Lead). Up to 50 members via Zod validation.

### Teams Page (`/teams`)
- Grid of TeamCards
- "Create Team" button → CreateTeamDialog (shadcn)
- Click a TeamCard → TeamDetailSheet (shadcn Sheet, right-side panel)
- Delete button on hover (Lead/Admin only)

### CreateTeamDialog (shadcn Dialog)
Form: Team name (required), Description (optional), Add Members section (email input + Add button, chips with X to remove, Enter key support). Uses TanStack Mutation, invalidates `["teams"]`.

### TeamCard
Displays: name, description (2-line clamp), member count, avatar stack (up to 4 + overflow count). Clickable → opens TeamDetailSheet. Delete with `e.stopPropagation()`.

### TeamDetailSheet (shadcn Sheet)
Right-side slide-in panel showing:
- Team name + description
- Full member list: avatar, name, email, role (Lead has crown icon)
- Remove member button (Lead/Admin only, not self)
- Creation date (date-fns formatted)
- TanStack Mutation for remove, invalidates `["teams"]`

---

## 6. shadcn UI Components Created

All components in `apps/web/src/components/ui/`:

| Component | Wraps | Features |
|---|---|---|
| `dialog.tsx` | `@radix-ui/react-dialog` | Dialog, Content, Header, Title, Description, Footer, Close (X) button, backdrop, animations |
| `button.tsx` | `@radix-ui/react-slot` | CVA variants: default/destructive/outline/secondary/ghost/link, sizes: default/sm/lg/icon |
| `input.tsx` | native `<input>` | Dark theme border/bg/focus-ring, consistent height |
| `sheet.tsx` | `@radix-ui/react-dialog` | Sheet, Content (right/left/top/bottom), Header, Title, Description, Close button, overlay, slide animations |

All use `cn()` utility from `@/lib/utils.ts` and dark theme CSS variables from `index.css`.

---

## 7. Frontend Architecture

### Component Tree
```
App.tsx
  QueryClientProvider
    BrowserRouter
      AuthProvider
        Routes
          /login → Login (PublicRoute)
            GoogleSignInButton
          / → Dashboard (ProtectedRoute)
            DashboardLayout
              Sidebar
              Topbar
          /teams → Teams (ProtectedRoute)
            DashboardLayout
            TeamCard[] → TeamDetailSheet
            CreateTeamDialog
          /admin/users → AdminUsers (ProtectedRoute)
            DashboardLayout
            InviteUserDialog
```

### Auth Flow (Frontend)
1. `AuthContext` checks localStorage for token on mount
2. If token exists → `GET /api/me` via axios → set user
3. `loginWithGoogle(idToken)` → `POST /api/auth/google` → stores JWT + sets user
4. Errors surfaced via react-toastify in `GoogleSignInButton`
5. Login page: pending users see warning toast, rejected see error toast

### Data Fetching Pattern
All API calls use TanStack Query:
- `useQuery` for reads (keyed by `["resource", ...params]`)
- `useMutation` for writes → `invalidateQueries` to refresh lists
- `onSuccess` → toast.success, `onError` → toast.error with server message

---

## 8. Routing

| Path | Access | Page |
|---|---|---|
| `/login` | Public (redirects to `/` if logged in) | Login |
| `/` | Protected (redirects to `/login` if not) | Dashboard |
| `/teams` | Protected | Teams |
| `/admin/users` | Protected + Admin only | AdminUsers |
| `*` | Catch-all | Redirects to `/` |

### Sidebar
- Uses React Router `<Link>` for SPA navigation
- `useLocation()` for active state detection
- Admin-only items (Users) hidden when `user.role !== "Admin"`

---

## 9. File Manifest

### New Files (20)
```
Root:
  tsconfig.json

apps/api/src/lib/validators.ts
apps/api/src/middleware/requireAdmin.ts
apps/api/src/routes/users.ts
apps/api/src/routes/teams.ts

apps/web/src/lib/axios.ts
apps/web/src/pages/Teams.tsx
apps/web/src/pages/AdminUsers.tsx
apps/web/src/components/ui/dialog.tsx
apps/web/src/components/ui/button.tsx
apps/web/src/components/ui/input.tsx
apps/web/src/components/ui/sheet.tsx
apps/web/src/components/teams/CreateTeamDialog.tsx
apps/web/src/components/teams/TeamCard.tsx
apps/web/src/components/teams/TeamDetailSheet.tsx
apps/web/src/components/admin/InviteUserDialog.tsx
```

### Modified Files (14)
```
.npmrc
turbo.json
package.json (root)
packages/db/prisma/schema.prisma
packages/db/src/index.ts
apps/api/src/app.ts
apps/api/src/index.ts
apps/api/src/routes/auth.ts
apps/api/src/routes/me.ts
apps/api/src/lib/google.ts
apps/web/src/App.tsx
apps/web/src/index.css
apps/web/src/context/AuthContext.tsx
apps/web/src/pages/Login.tsx
apps/web/src/components/GoogleSignInButton.tsx
apps/web/src/components/layout/Sidebar.tsx
```

### Deleted Files (1)
```
apps/web/src/lib/api.ts (replaced by axios.ts)
```

---

## 10. Backend Module Resolution Fix

### Problem
ESM modules hoist all static `import` statements above any code. `import "dotenv/config"` in `index.ts` was written first, but the entire dependency tree (`app.ts` → routes → `google.ts`) resolved before `dotenv.config()` executed. `new OAuth2Client(process.env.GOOGLE_CLIENT_ID)` at module scope got `undefined`.

### Fix
- `index.ts`: explicit `dotenv.config()` with resolved path, then dynamic `await import("./app.js")` using top-level await
- `google.ts`: lazy `getClient()` instead of module-level `const client`
- `auth.ts`: returns actual error messages instead of generic "Authentication failed"
- All route params: `param()` helper to cast `req.params[key]` (Express 5 types with `noUncheckedIndexedAccess`)

---

## 11. Key Design Decisions

1. **Whitelisted user = first admin**: `harshverma0362@gmail.com` auto-gets Admin + Active on first login. No other bootstrap mechanism needed.

2. **Pre-approved invite = Active status**: Admin-invited users are created Active. When they Google login, matched by email, googleId filled in, immediate access.

3. **Domain check at auth level**: Both Google and email auth check domain before any DB operations. Unauthorized domains get 403 early.

4. **Cascade deletes on User delete**: Removes User + all their TeamMember records. Team stays intact for remaining members.

5. **Sheet for team detail, not a separate page**: TeamDetailSheet slides in from the right, keeping the teams list visible behind. Better UX than navigating away.

6. **TanStack Query everywhere**: Replaced raw fetch with typed axios + TanStack Query. All mutations invalidate relevant queries for automatic refetch.

7. **Toast for all feedback**: Success and error states always show react-toastify toasts. No silent failures.

8. **shadcn for all modals**: CreateTeamDialog, InviteUserDialog use shadcn Dialog. TeamDetailSheet uses shadcn Sheet. Buttons and Inputs are shadcn components. No custom modal markup.

---

## 12. Verification

| Check | Status |
|---|---|
| pnpm install | ✅ All deps installed |
| pnpm db:generate | ✅ Prisma Client regenerated |
| @repo/db check-types | ✅ |
| @meldtask/api check-types | ✅ |
| @meldtask/web check-types | ✅ |

---

## 13. Commands

```bash
# Apply schema to PostgreSQL
pnpm db:push

# Start both services
pnpm dev           # API:3001 + Web:3000
pnpm dev:api       # API only
pnpm dev:web       # Web only
```
