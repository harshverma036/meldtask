# 02-execution-agent — Teams & User Roles Implementation

## Overview

Implemented `specs/02-user-teams.md`: domain-restricted login, user roles (Admin/Developer/Manager), admin approval flow, Teams with many-to-many users. Also migrated the frontend stack to comply with CLAUDE.md rules (TanStack Query + axios replacing raw fetch, react-toastify, Zod validation).

---

## 1. Infrastructure Upgrades

### Dependencies Added
| Package | Version | Why |
|---|---|---|
| `axios` | ^1.18.1 | CLAUDE.md requirement — HTTP client replacing raw fetch |
| `@tanstack/react-query` | ^5.101.2 | Server state management, caching, mutations |
| `react-toastify` | ^11.1.0 | Toast notifications for success/error feedback |
| `date-fns` | ^4.4.0 | Date manipulation (CLAUDE.md requirement) |
| `zod` | ^4.4.3 | Request body validation on all API endpoints |

### Axios Instance (`apps/web/src/lib/axios.ts`)
**Decision:** Single axios instance with baseURL `/api`, request interceptor that injects Bearer token from localStorage, response interceptor that auto-logouts on 401 and redirects to `/login`. Replaces old `lib/api.ts` (deleted).

### Providers (`apps/web/src/App.tsx`)
- `QueryClientProvider` wraps the entire app with `staleTime: 5min`, `retry: 1`
- `ToastContainer` positioned bottom-right, dark theme, auto-close 4s

### Zod Validators (`apps/api/src/lib/validators.ts`)
Schemas for: `googleAuthSchema`, `emailAuthSchema`, `updateRoleSchema`, `createTeamSchema`, `updateTeamSchema`, `addMemberSchema`. All used in routes with `safeParse` for proper error messages (returns Zod's issue messages, not generic errors).

---

## 2. Database Schema Changes

### User Model — New Fields
| Field | Type | Default | Purpose |
|---|---|---|---|
| `role` | `UserRole` enum | `Developer` | Admin / Developer / Manager |
| `status` | `UserStatus` enum | `Pending` | Pending / Active / Rejected |
| `domain` | `String?` | null | Extracted from email on registration |

### New Enums
- `UserRole`: Admin, Developer, Manager
- `UserStatus`: Pending, Active, Rejected
- `TeamMemberRole`: Lead, Member

### New Models
- **Team**: id, name, description, createdBy (userId), createdAt, updatedAt
- **TeamMember**: id, teamId, userId, role (Lead/Member), joinedAt, with `@@unique([teamId, userId])`

### Relations
- User ↔ TeamMember (one-to-many): A user can be in multiple teams
- Team ↔ TeamMember (one-to-many): A team can have multiple members
- Cascade deletes: Deleting a team cascades to its TeamMember records; deleting a user cascades to their TeamMember records

---

## 3. Backend — Auth Changes

### Domain Validation
**Decision:** Allowed domains: `youngun.in`, `meldit.ai`. Whitelisted emails: `harshverma0362@gmail.com`. Both email and Google auth check authorization BEFORE creating/updating users.

**Flow:**
1. Extract email from Google token or request body
2. Check if email is in whitelist → authorized
3. Check if email domain is in allowed domains → authorized
4. Otherwise → 403 "This email domain is not authorized"

### User Creation Logic
**Decision:** Whitelisted emails get `role: Admin, status: Active` on first login. Allowed domain users get `role: Developer, status: Pending`.

**Existing user flows:**
- Status=Active → login normally, update profile info
- Status=Pending → 403 "Your account is pending admin approval"
- Status=Rejected → 403 "Your account has been rejected"

### Google Auth (`POST /api/auth/google`)
- Zod validates `{ idToken }` body
- Verifies Google token via `google-auth-library`
- Checks domain authorization
- For existing users: checks status, updates profile (name, avatar)
- For new users: creates with appropriate role/status, returns JWT only if Active

### Email Auth (`POST /api/auth/email`)
- Zod validates `{ email, password, name? }`
- Same domain check and status flow as Google auth
- Password hashed with bcryptjs (12 rounds) for new registrations

### User Profile (`GET /api/me`)
- Now returns `role`, `status`, `createdAt` in addition to existing fields

---

## 4. Backend — User Management (Admin)

### Middleware: `requireAdmin`
- Must run AFTER `authenticate` middleware
- Fetches user from DB, checks `role === "Admin"` AND `status === "Active"`
- Returns 403 if not admin

### Endpoints (all requireAdmin)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/users?status=Pending` | List users, optional status filter |
| PATCH | `/api/users/:id/approve` | Set user status to Active |
| PATCH | `/api/users/:id/reject` | Set user status to Rejected |
| PATCH | `/api/users/:id/role` | Update user role (Admin/Developer/Manager) |

All endpoints use Zod validation and return typed responses.

---

## 5. Backend — Teams CRUD

### Endpoints (all require authentication)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/teams` | List teams the current user belongs to |
| POST | `/api/teams` | Create team (creator auto-joined as Lead) |
| GET | `/api/teams/:id` | Get team with all members |
| PATCH | `/api/teams/:id` | Update name/description (Lead or Admin only) |
| DELETE | `/api/teams/:id` | Delete team (Lead or Admin only) |
| POST | `/api/teams/:id/members` | Add member by email |
| DELETE | `/api/teams/:id/members/:userId` | Remove member |

### Authorization Model
- **Creator becomes Lead**: On team creation, the creating user is added as `TeamMemberRole.Lead`
- **Lead or Admin can update/delete**: Checked via `teamId_userId` unique lookup + user role check
- **Add member by email**: Looks up user by email, checks they're Active, checks they aren't already a member
- **Cascade deletes**: Deleting a team removes all TeamMember records for that team

---

## 6. Frontend — Auth Flow

### AuthContext Refactored
- **Replaced `apiGet/apiPost`** with the axios instance (`import api from "@/lib/axios"`)
- **User type expanded** to include `role`, `status`, `createdAt`
- **Error handling**: Errors propagate to callers (GoogleSignInButton, Login) which display toasts

### GoogleSignInButton
- Uses `axios.isAxiosError()` to detect API errors
- Shows contextual toasts: "pending approval" → warn, "domain not authorized" → error, "rejected" → error, generic → error

### Login Page
- **Pending users**: Show warning toast, stay on login page (don't redirect to dashboard)
- **Rejected users**: Show error toast, stay on login page
- **Active users**: Redirect to dashboard as before
- Extracted `LoginContent` as a stateless component to avoid duplication

---

## 7. Frontend — Teams Page

### `Teams.tsx`
- **TanStack Query**: `useQuery` with `["teams"]` key fetches team list
- **TanStack Mutation**: `useMutation` for delete with `invalidateQueries` to refresh list
- **Empty state**: "No teams yet" with CTA link to create
- **Create button**: Opens `CreateTeamDialog`

### `CreateTeamDialog.tsx`
- Custom modal (backdrop + centered card) — no shadcn dependency since `components/ui/` is empty
- Form: team name (required, max 100), description (optional, max 500)
- **TanStack Mutation**: POST to `/api/teams`, invalidates `["teams"]` on success
- Toast: "Team created successfully" / error message

### `TeamCard.tsx`
- Displays: team name, description (2-line clamp), member count, avatar stack (up to 4 members, +N overflow)
- Delete button: only visible to Lead or Admin, appears on hover (`group-hover:opacity-100`)
- Avatar fallback: initials extracted from name or email

---

## 8. Frontend — Admin Users Page

### `AdminUsers.tsx`
- **Admin gate**: If `user.role !== "Admin"`, redirects to `/`
- **Status filter tabs**: All / Pending / Active / Rejected — uses `useState<StatusTab>`, defaults to Pending
- **TanStack Query**: `useQuery` with `["admin-users", statusFilter]` key, passes `?status=` param
- **Table columns**: User (avatar + name), Email, Domain, Role (editable select), Status (colored badge), Joined (date-fns formatted), Actions (approve/reject buttons for pending users)

### Role Select
- Inline `<select>` element in the table row
- **TanStack Mutation**: `useMutation` PATCHes `/api/users/:id/role`
- Toast on success/error

### Approve/Reject Buttons
- Check (green) and X (red) icon buttons, only shown for Pending users
- **TanStack Mutations**: Separate mutations for approve and reject
- Both invalidate `["admin-users"]` query on success
- Toast: "User approved" / "User rejected"

### Status Badges
- Active: green background (`bg-green-500/10 text-green-400`)
- Pending: yellow background (`bg-yellow-500/10 text-yellow-400`)
- Rejected: red background (`bg-red-500/10 text-red-400`)

---

## 9. Sidebar Updates

- **React Router Links**: Changed from `<a href>` to `<Link to>` for SPA navigation (no full page reloads)
- **Active state**: Uses `useLocation()` to compare `pathname === item.href` — dynamic instead of hardcoded `active: true`
- **Admin items**: Shield icon "Users" link to `/admin/users` — only shown when `user?.role === "Admin"`
- **App title**: Now a `Link` to `/` for home navigation

---

## 10. File Manifest

### New files (15):
```
rules/02-execution-agent.md                      (this file)
apps/web/src/lib/axios.ts                         (axios instance)
apps/api/src/lib/validators.ts                    (Zod schemas)
apps/api/src/middleware/requireAdmin.ts           (admin guard)
apps/api/src/routes/users.ts                      (user management)
apps/api/src/routes/teams.ts                      (team CRUD)
apps/web/src/pages/Teams.tsx                      (teams list)
apps/web/src/pages/AdminUsers.tsx                 (admin user management)
apps/web/src/components/teams/CreateTeamDialog.tsx (create team modal)
apps/web/src/components/teams/TeamCard.tsx         (team display card)
```

### Modified files (12):
```
packages/db/prisma/schema.prisma                  (enums, fields, Team/TeamMember)
packages/db/src/index.ts                          (export Team, TeamMember types)
apps/api/src/app.ts                               (register users, teams routes)
apps/api/src/routes/auth.ts                       (domain validation, status, Zod)
apps/api/src/routes/me.ts                         (return role, status, createdAt)
apps/api/src/index.ts                             (env var logging on startup)
apps/api/package.json                             (zod dependency)
apps/web/src/App.tsx                              (providers, routes)
apps/web/src/index.css                            (react-toastify CSS import)
apps/web/src/context/AuthContext.tsx              (axios, User type with role/status)
apps/web/src/pages/Login.tsx                      (toast handling, pending check)
apps/web/src/components/GoogleSignInButton.tsx     (axios error handling, toasts)
apps/web/src/components/layout/Sidebar.tsx        (react-router Links, admin item)
apps/web/package.json                             (new dependencies)
```

### Deleted files (1):
```
apps/web/src/lib/api.ts                           (replaced by axios.ts)
```

---

## 11. Verification

| Check | Status |
|---|---|
| pnpm install (all deps) | ✅ |
| pnpm db:generate | ✅ Prisma Client regenerated |
| @meldtask/api check-types | ✅ No errors |
| @meldtask/web check-types | ✅ No errors |
| @repo/db check-types | ✅ No errors |

---

## 12. Next Steps for the User

```bash
# 1. Push schema changes to PostgreSQL
pnpm db:push

# 2. Start both services
pnpm dev
```

### Test the flows:
1. **Whitelisted login**: Sign in as `harshverma0362@gmail.com` → auto Active + Admin
2. **Domain login**: Sign in with `@youngun.in` or `@meldit.ai` email → Pending status
3. **Rejected login**: Try `@gmail.com` (not whitelisted) → "domain not authorized"
4. **Admin approval**: As admin, go to `/admin/users` → approve pending user
5. **Teams**: Create team, see it in list, delete it
