# PROJECT_MAP.md — meldtask Knowledge Center

> **Purpose:** This file is the single source of truth for the entire meldtask codebase. Claude should read ONLY this file at the start of every session instead of scanning every file individually. Keep it up to date when making changes.

---

## 1. Project Overview

**meldtask** is a task, team, and goal management platform. It supports Google OAuth sign-in with domain-restricted access, workspace/project hierarchies, team management, and user administration.

- **Repo:** Monorepo managed with **Turborepo** + **pnpm workspaces**
- **Package Manager:** pnpm@9.0.0
- **Node:** >=18

---

## 2. Monorepo Structure

```
meldtask/
├── apps/
│   ├── api/          # Express + TypeScript backend (port 7651)
│   └── web/          # Vite + React frontend (port 7650)
├── packages/
│   ├── db/           # Prisma client + schema (shared database layer)
│   ├── eslint-config/ # Shared ESLint configs (base, react-internal, next)
│   └── typescript-config/ # Shared TS configs (base, nextjs, react-library)
├── specs/            # Feature specification .md files (numbered sequence)
├── turbo.json        # Turborepo pipeline config
├── pnpm-workspace.yaml
└── package.json      # Root scripts
```

### Workspace Names (from `pnpm-workspace.yaml`):
- `apps/*` → `@meldtask/api`, `@meldtask/web`
- `packages/*` → `@repo/db`, `@repo/eslint-config`, `@repo/typescript-config`

---

## 3. Tech Stack

### Frontend (`apps/web`)
| Concern | Technology |
|---|---|
| Framework | React 19 + Vite 6 |
| Routing | react-router-dom v7 |
| Styling | Tailwind CSS v4 (dark mode only, CSS variables) |
| Component Library | shadcn/ui (Radix primitives) |
| API Calls | Axios + TanStack React Query v5 |
| Forms | react-hook-form + yup (via @hookform/resolvers) |
| Toast Notifications | react-toastify |
| Date Formatting | date-fns v4 |
| Icons | lucide-react |
| Drag & Drop | @hello-pangea/dnd |
| Google Auth | @react-oauth/google |
| Class Merging | clsx + tailwind-merge → `cn()` utility |

### Backend (`apps/api`)
| Concern | Technology |
|---|---|
| Runtime | Express 4 + TypeScript |
| Dev Runner | tsx (watch mode) |
| Validation | Zod v4 |
| Auth (JWT) | jsonwebtoken |
| Auth (Google) | google-auth-library |
| File Upload | multer |
| Password Hashing | bcryptjs |
| CORS | cors |

### Database (`packages/db`)
| Concern | Technology |
|---|---|
| ORM | Prisma |
| Database | PostgreSQL |
| Client | Singleton PrismaClient (dev-mode global caching) |

---

## 4. Database Schema (Prisma)

**Location:** `packages/db/prisma/schema.prisma`

### Enums
- **UserRole:** `Admin`, `Developer`, `Manager`
- **UserStatus:** `Pending`, `Active`, `Rejected`
- **TeamMemberRole:** `Lead`, `Member`
- **WorkspaceMemberRole:** `Owner`, `Admin`, `Member`
- **ProjectMemberRole:** `Owner`, `Member`
- **TaskPriority:** `Low`, `Medium`, `High`, `Urgent`

### Models (9 tables)

```
User
├── id, email (unique), name?, avatarUrl?, googleId? (unique), password?
├── role (UserRole), status (UserStatus), domain?
├── timestamps: createdAt, updatedAt
├── Relations: TeamMember[], WorkspaceMember[], ProjectMember[]
├──              createdWorkspaces[], createdProjects[]
├──              assignedTasks[], assignedByTasks[], createdTasks[], taskComments[]

Team
├── id, name, description?, createdBy, createdAt, updatedAt
└── Relations: TeamMember[]

TeamMember (join: teamId + userId, unique composite key)
├── id, teamId, userId, role (TeamMemberRole), joinedAt
└── Cascade delete on both FK sides

Workspace
├── id, name, description?, createdBy, createdAt, updatedAt
└── Relations: creator (User), WorkspaceMember[], Project[]

WorkspaceMember (join: workspaceId + userId, unique composite key)
├── id, workspaceId, userId, role (WorkspaceMemberRole), joinedAt
└── Cascade delete on both FK sides

Project
├── id, name, description?, statuses (String[]), workspaceId, createdBy, createdAt, updatedAt
└── Relations: workspace (Workspace), creator (User), ProjectMember[], Task[]

ProjectMember (join: projectId + userId, unique composite key)
├── id, projectId, userId, role (ProjectMemberRole), joinedAt
└── Cascade delete on both FK sides

Task (self-referencing for N-level nesting)
├── id, title, description?, status (String), priority (TaskPriority), dueDate?
├── projectId, parentId? (self-ref FK), assignedTo?, assignedBy?, createdBy
├── position (Int, for ordering), createdAt, updatedAt
├── Relations: project (Project), parent/children (self), assignee/assigner/creator (User)
├──              comments (TaskComment[]), assets (TaskAsset[])
└── Cascade delete from Project; SetNull on parent delete (preserves children)

TaskComment
├── id, content, taskId, authorId, createdAt, updatedAt
└── Cascade delete from Task; Cascade delete author

TaskAsset
├── id, type ("file" | "link"), url, name, size?, mimeType?, taskId, createdAt
└── Cascade delete from Task
```

### Key Relationships
- User → Teams (many-to-many via TeamMember)
- User → Workspaces (many-to-many via WorkspaceMember)
- User → Projects (many-to-many via ProjectMember)
- User → Tasks (Assignee, Assigner, Creator relations)
- Workspace → Projects (one-to-many, cascade delete)
- Project → Tasks (one-to-many, cascade delete)
- Task → Task (self-referencing parent/children for subtasks)
- Task → TaskComment (one-to-many, cascade delete)
- Task → TaskAsset (one-to-many, cascade delete)

---

## 5. API Routes (Backend)

**Express app:** `apps/api/src/app.ts` mounts all routes under `/api`.

### Auth (`/api/auth`) — `apps/api/src/routes/auth.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/google` | None | Google OAuth login/signup. Validates idToken, checks domain whitelist |
| POST | `/api/auth/email` | None | Email+password login/register |

**Authorization rules:**
- Allowed domains: `youngun.in`, `meldit.ai`
- Whitelisted emails: `harshverma0362@gmail.com`
- Whitelisted users → Admin role + Active status (immediate access)
- Domain-matched users → Developer role + Pending status (needs admin approval)
- Non-matching → rejected with error

### Current User (`/api/me`) — `apps/api/src/routes/me.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/me` | Bearer | Returns authenticated user's profile |

### Users Admin (`/api/users`) — `apps/api/src/routes/users.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/users?status=` | Admin | List users, filter by status |
| POST | `/api/users/invite` | Admin | Pre-approve/invite a user by email |
| PATCH | `/api/users/:id/approve` | Admin | Approve pending user |
| PATCH | `/api/users/:id/reject` | Admin | Reject pending user |
| PATCH | `/api/users/:id/role` | Admin | Change user role |
| DELETE | `/api/users/:id` | Admin | Delete user (not self) |

### Teams (`/api/teams`) — `apps/api/src/routes/teams.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/teams` | Bearer | List user's teams |
| POST | `/api/teams` | Bearer | Create team (creator=Lead), optionally with member emails |
| GET | `/api/teams/:id` | Bearer | Get team details |
| PATCH | `/api/teams/:id` | Bearer | Update team (Lead or Admin only) |
| DELETE | `/api/teams/:id` | Bearer | Delete team (Lead or Admin only) |
| POST | `/api/teams/:id/members` | Bearer | Add member by email |
| DELETE | `/api/teams/:id/members/:userId` | Bearer | Remove member |

### Workspaces (`/api/workspaces`) — `apps/api/src/routes/workspaces.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/workspaces` | Bearer | List user's workspaces |
| POST | `/api/workspaces` | Bearer | Create workspace (Admin only, creator=Owner) |
| GET | `/api/workspaces/:id` | Bearer | Get workspace with members + projects |
| PATCH | `/api/workspaces/:id` | Bearer | Update (Owner or Admin only) |
| DELETE | `/api/workspaces/:id` | Bearer | Delete (Owner or Admin only) |
| POST | `/api/workspaces/:id/members` | Bearer | Add member (Owner/Admin only) |
| DELETE | `/api/workspaces/:id/members/:userId` | Bearer | Remove member (Owner/Admin, cannot remove Owner) |
| GET | `/api/workspaces/:id/members` | Bearer | Lightweight member list for selector UI |

### Projects (`/api/workspaces/:workspaceId/projects`) — `apps/api/src/routes/projects.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/workspaces/:workspaceId/projects` | Bearer | List projects (must be workspace member) |
| POST | `/api/workspaces/:workspaceId/projects` | Bearer | Create project (any workspace member, creator=Owner) |
| GET | `/api/workspaces/:workspaceId/projects/:id` | Bearer | Get project details |
| PATCH | `/api/workspaces/:workspaceId/projects/:id` | Bearer | Update (Project Owner / Workspace Admin / System Admin) |
| DELETE | `/api/workspaces/:workspaceId/projects/:id` | Bearer | Delete (Project Owner / Workspace Admin / System Admin) |
| POST | `/api/workspaces/:workspaceId/projects/:id/members` | Bearer | Add member (must be workspace member first) |
| DELETE | `/api/workspaces/:workspaceId/projects/:id/members/:userId` | Bearer | Remove member |

### Tasks (`/api/projects/:projectId/tasks`) — `apps/api/src/routes/tasks.ts`
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/projects/:projectId/tasks` | Bearer | List tasks (filters: status, priority, assignedTo, parentId, search) |
| POST | `/api/projects/:projectId/tasks` | Bearer | Create task (any project member) |
| GET | `/api/projects/:projectId/tasks/:id` | Bearer | Get task with children, comments, assets |
| PATCH | `/api/projects/:projectId/tasks/:id` | Bearer | Update task fields |
| DELETE | `/api/projects/:projectId/tasks/:id` | Bearer | Delete task (cascade children/comments/assets) |
| PATCH | `/api/projects/:projectId/tasks/:id/reorder` | Bearer | Update position + status (drag-and-drop) |
| GET | `/api/projects/:projectId/tasks/:id/comments` | Bearer | List comments |
| POST | `/api/projects/:projectId/tasks/:id/comments` | Bearer | Add comment |
| DELETE | `/api/projects/:projectId/tasks/:id/comments/:commentId` | Bearer | Delete comment (author/owner/admin) |
| GET | `/api/projects/:projectId/tasks/:id/assets` | Bearer | List assets |
| POST | `/api/projects/:projectId/tasks/:id/assets/upload` | Bearer | Upload file (multipart, 25MB limit) |
| POST | `/api/projects/:projectId/tasks/:id/assets/link` | Bearer | Attach link |
| DELETE | `/api/projects/:projectId/tasks/:id/assets/:assetId` | Bearer | Remove asset |

### Middleware
| File | Purpose |
|---|---|
| `apps/api/src/middleware/auth.ts` | `authenticate` — extracts Bearer token, verifies JWT, attaches `req.userId` |
| `apps/api/src/middleware/requireAdmin.ts` | `requireAdmin` — checks user has Admin role + Active status |
| `apps/api/src/middleware/upload.ts` | Multer config — disk storage in `uploads/`, 25MB limit, MIME allowlist |
| `apps/api/src/middleware/errorHandler.ts` | Global error handler — 500 with generic message |

### Validation Schemas
- `apps/api/src/lib/validators.ts` — Auth, User, Team, Workspace, Project schemas
- `apps/api/src/lib/validators/tasks.ts` — Task-specific schemas: `createTaskSchema`, `updateTaskSchema`, `reorderTaskSchema`, `createCommentSchema`, `createAssetLinkSchema`

### Other Lib Files
- `apps/api/src/lib/jwt.ts` — `generateToken()`, `verifyToken()` (JWT_SECRET, 7d expiry)
- `apps/api/src/lib/google.ts` — `verifyGoogleToken()` using google-auth-library

---

## 6. Frontend Structure

### Entry Point & App Shell
- `apps/web/src/main.tsx` — React 19 createRoot, StrictMode
- `apps/web/src/App.tsx` — Router setup, providers, route definitions
- `apps/web/src/index.css` — Tailwind v4 import + dark theme CSS variables (oklch colors)

### Route Map
| Path | Page Component | Auth | Guard |
|---|---|---|---|
| `/login` | `Login` | Public (redirects if authed) | — |
| `/` | `Dashboard` | Protected | WorkspaceGuard |
| `/teams` | `Teams` | Protected | WorkspaceGuard |
| `/workspaces` | `Workspaces` | Protected | WorkspaceGuard |
| `/projects` | `Projects` | Protected | WorkspaceGuard |
| `/tasks` | `Tasks` | Protected | WorkspaceGuard |
| `/tasks/:projectId/:taskId` | `TaskFullPage` | Protected | WorkspaceGuard |
| `/admin/users` | `AdminUsers` | Protected | WorkspaceGuard |
| `*` | Redirect to `/` | — | — |

### Providers (nested in App.tsx)
1. **QueryClientProvider** (TanStack Query — staleTime: 5 min, retry: 1)
2. **BrowserRouter**
3. **AuthProvider** (AuthContext — user, loginWithGoogle, logout)
4. **WorkspaceProvider** (WorkspaceContext — active workspace, workspace list, switch/refresh)

### Contexts
#### AuthContext (`apps/web/src/context/AuthContext.tsx`)
- Holds `user: User | null`, `isLoading`
- On mount: checks `auth_token` in localStorage → hits `GET /api/me`
- `loginWithGoogle(idToken)` → `POST /api/auth/google` → stores token
- `logout()` → clears token + active workspace

#### WorkspaceContext (`apps/web/src/context/WorkspaceContext.tsx`)
- Holds `activeWorkspace`, `workspaces[]`, `isLoading`
- Polls localStorage for auth token; fetches workspaces when token appears (handles post-login timing)
- Resolves active workspace from localStorage key `active_workspace_id`
- Auto-selects first workspace if none stored
- `switchWorkspace(id)` → finds workspace in list by ID, updates state + localStorage
- `setActiveWorkspace(workspace)` → directly sets the active workspace from a full object (used by WorkspaceSelection)
- `refreshWorkspaces()` → re-fetches

### Hooks
- `apps/web/src/hooks/useAuth.ts` — re-exports from AuthContext
- `apps/web/src/hooks/useWorkspace.ts` — re-exports from WorkspaceContext
- `apps/web/src/hooks/useTasks.ts` — 12 TanStack Query hooks: `useTasks`, `useTask`, `useCreateTask`, `useUpdateTask`, `useDeleteTask`, `useReorderTask`, `useTaskComments`, `useCreateComment`, `useDeleteComment`, `useTaskAssets`, `useUploadAsset`, `useCreateAssetLink`, `useDeleteAsset`

### Lib Utilities
- `apps/web/src/lib/axios.ts` — Pre-configured Axios instance (baseURL: `/api`, auto-injects Bearer token via request interceptor; 401 interceptor clears token + redirects to `/login`)
- `apps/web/src/lib/utils.ts` — `cn()` = clsx + tailwind-merge
- `apps/web/src/lib/types/task.ts` — TypeScript interfaces: Task, TaskComment, TaskAsset, TaskPriority, TaskViewMode, TaskGroupBy, etc.
- `apps/web/src/lib/projectStatus.ts` — `getStatusColor()` maps status strings to Tailwind color classes (12-color palette, known status map + hash-based fallback)

### Pages (all inside `apps/web/src/pages/`)
| Page | Description |
|---|---|
| `Login.tsx` | Google OAuth sign-in card (uses `@react-oauth/google`). Handles pending/rejected status messages. |
| `Dashboard.tsx` | Welcome page with placeholder stat cards (Tasks, Teams, Goals — all "No X yet") |
| `Teams.tsx` | Teams list grid + CreateTeamDialog + TeamDetailSheet |
| `Workspaces.tsx` | Workspaces list grid (Admin-only create button) + CreateWorkspaceDialog + WorkspaceDetailSheet |
| `Projects.tsx` | Projects grid scoped to active workspace + CreateProjectDialog + ProjectDetailSheet |
| `Tasks.tsx` | Task management with project selector, Board/List view toggle, filters, CreateTaskSheet (right), TaskDetailSheet (right) |
| `TaskFullPage.tsx` | Full-screen dedicated task view at `/tasks/:projectId/:taskId` with inline editing, subtasks, comments, assets |
| `AdminUsers.tsx` | User management (Members/Pending tabs), approve/reject/change role/remove actions |
| `WorkspaceSelection.tsx` | Post-login screen when no workspace active; lists workspaces + create option for admins |

### Components (all inside `apps/web/src/components/`)

#### Layout
- `layout/DashboardLayout.tsx` — Sidebar + Topbar + `<main>` with responsive padding (lg:pl-72 for sidebar offset)
- `layout/Sidebar.tsx` — Fixed sidebar (w-64), mobile hamburger menu, nav links (Dashboard, Workspaces, Projects, Tasks, Teams, Goals, Users, Settings). Admin-only items filtered. Version footer.
- `layout/Topbar.tsx` — Sticky header with centered search input, workspace switcher dropdown, profile dropdown (View Profile, Logout)
- `layout/WorkspaceGuard.tsx` — Shows WorkspaceSelection if no active workspace; loading spinner while fetching

#### UI (shadcn) — `components/ui/`
- `button.tsx` — CVA-based Button with variants (default, destructive, outline, secondary, ghost, link) + sizes
- `dialog.tsx` — Radix Dialog wrapper (Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogTrigger, DialogClose)
- `input.tsx` — Styled `<input>` with dark theme
- `sheet.tsx` — Radix Dialog-based Sheet (right-side slide-over, used for detail panels + create forms)
- `select.tsx` — Radix Select wrapper (dropdown select)
- `tabs.tsx` — Radix Tabs wrapper (view toggles)
- `textarea.tsx` — Styled `<textarea>` with dark theme
- `badge.tsx` — CVA-based Badge with variants
- `avatar.tsx` — Radix Avatar wrapper
- `separator.tsx` — Radix Separator
- `tooltip.tsx` — Radix Tooltip
- `dropdown-menu.tsx` — Radix DropdownMenu (full set of sub-components)

#### Feature Components
- `GoogleSignInButton.tsx` — Wraps `@react-oauth/google` GoogleLogin, handles errors with toast messages
- `admin/InviteUserDialog.tsx` — Invite user form (email, role, optional team assignment)
- `teams/CreateTeamDialog.tsx` — Create team + add member emails as chips
- `teams/TeamCard.tsx` — Team summary card (name, description, member count + avatar stack, delete button for Lead/Admin)
- `teams/TeamDetailSheet.tsx` — Slide-over: member list with remove capability (Lead/Admin only)
- `workspaces/CreateWorkspaceDialog.tsx` — Create workspace form, auto-switches after creation
- `workspaces/WorkspaceCard.tsx` — Workspace summary card (name, description, members, active highlight)
- `workspaces/WorkspaceDetailSheet.tsx` — Slide-over: member list, add member form (email + role)
- `projects/CreateProjectDialog.tsx` — Create project form with SortableStatusChips tag input for status pipeline
- `projects/ProjectCard.tsx` — Project card (name, description, status chips, member avatars, delete for Owner/Admin)
- `projects/ProjectDetailSheet.tsx` — Central hub: inline-editable name/desc, sortable status pipeline, member management (add via MemberSelector + remove)
- `projects/SortableStatusChips.tsx` — Drag-and-drop reorderable status chips (HTML5 DnD API, colored via `getStatusColor()`)
- `projects/MemberSelector.tsx` — Searchable dropdown to select workspace members (excludes already-added users)
- `tasks/TaskCard.tsx` — Compact task card (priority badge, status chip, due date, assignee avatar, subtask/comment/asset counts)
- `tasks/TaskListView.tsx` — Grouped task list with collapsible sections (groupBy: status, priority, assignedTo, createdAt)
- `tasks/TaskBoardView.tsx` — Kanban board with @hello-pangea/dnd drag-and-drop between status columns
- `tasks/TaskDetailSheet.tsx` — Right-side sheet: breadcrumb, inline editing (title/desc/priority/status/due/assignee), subtasks, comments, assets, full-screen button
- `tasks/CreateTaskDialog.tsx` — Right-side sheet form: react-hook-form + yup, title/desc/priority/status/due/assignee fields
- `tasks/CommentSection.tsx` — Comment thread with @mention rendering and add-comment input
- `tasks/AssetSection.tsx` — File upload + link attachment management with download/delete
- `tasks/TaskFilters.tsx` — Search + priority/status/assignee filter dropdowns with clear button
- `tasks/Breadcrumb.tsx` — Clickable navigation breadcrumb for task hierarchy

---

## 7. Vite Config (Frontend Build)

**Location:** `apps/web/vite.config.ts`
- Plugins: `@vitejs/plugin-react` + `@tailwindcss/vite`
- Path alias: `@` → `./src`
- Dev server: port 7650, proxy `/api` → `http://localhost:7651`

---

## 8. Environment Variables

### `apps/api/.env`
| Variable | Description |
|---|---|
| `PORT` | API server port (default: 7651) |
| `FRONTEND_URL` | CORS origin (default: http://localhost:7650) |
| `GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `DATABASE_URL` | PostgreSQL connection string |

### `apps/web/.env`
| Variable | Description |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth Client ID (public, browser-exposed) |

### `packages/db/.env`
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (same as api) |

---

## 9. Root Package Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Run all apps in dev mode |
| `pnpm dev:web` | Run only web (port 7650) |
| `pnpm dev:api` | Run only API (port 7651) |
| `pnpm build` | Build all |
| `pnpm lint` | Lint all |
| `pnpm db:generate` | Generate Prisma client |
| `pnpm db:push` | Push schema to DB |
| `pnpm db:migrate` | Run Prisma migrations |
| `pnpm db:studio` | Open Prisma Studio |

---

## 10. Auth Flow Summary

1. User lands on `/login` → sees Google Sign-In button
2. Google returns `idToken` → `POST /api/auth/google { idToken }`
3. Backend verifies token with Google, checks domain whitelist:
   - **Whitelisted email** → Admin + Active → JWT returned immediately
   - **Allowed domain** → Developer + Pending → "pending approval" message
   - **Blocked domain** → 403 rejected
4. JWT stored in `localStorage.auth_token`
5. Axios interceptor injects `Authorization: Bearer <token>` on every request
6. On app load, `AuthProvider` hits `GET /api/me` to hydrate user
7. `WorkspaceProvider` fetches workspaces, resolves active from localStorage
8. `WorkspaceGuard` blocks rendering until a workspace is selected

---

## 11. Authorization Matrix

| Action | Who Can Do It |
|---|---|
| Create workspace | System Admin only |
| Update/delete workspace | Workspace Owner or System Admin |
| Add/remove workspace members | Workspace Owner or Admin or System Admin |
| Create project | Any workspace member |
| Update/delete project | Project Owner, Workspace Admin/Owner, or System Admin |
| Add/remove project members | Project Owner, Workspace Admin/Owner, or System Admin |
| Create/manage tasks | Any project member |
| Reorder tasks (drag-drop) | Any project member |
| Add/delete comments | Any project member (delete: author/owner/admin only) |
| Upload files / attach links | Any project member |
| Create/manage teams | Any authenticated user (Lead of own teams) |
| Update/delete team | Team Lead or System Admin |
| Manage users (approve/reject/invite) | System Admin only |
| Change user roles | System Admin only |

---

## 12. Coding Standards & Conventions

### Frontend (from `CLAUDE.md`)
- **Styling:** Tailwind CSS v4 only. No custom CSS beyond `index.css` theme variables.
- **Components:** shadcn/ui only. Do NOT create custom components from scratch.
- **API Calls:** TanStack React Query for all queries/mutations with caching. Axios only.
- **Forms:** react-hook-form + yup for validation.
- **Dates:** date-fns only.
- **Toasts:** react-toastify (dark theme, bottom-right). Show backend error message if available, else write one.
- **Design:** Dark mode only, responsive, clean and consistent.
- **Code organization:** Break into reusable components. Keep files short.

### Backend (from `CLAUDE.md`)
- **Validation:** Zod schemas for every API input. Create validation file per module.
- **Error Handling:** Cover every case. Proper try/catch with meaningful messages.
- **Types:** Define types/interfaces for everything. No `any`.
- **Comments:** Proper code documentation everywhere.
- **Structure:** Break code into functions.

### Agent (from `CLAUDE.md`)
- After every execution, create a `.md` file in `specs/` with sequential numbering documenting decisions.

---

## 13. Planned Features (from `specs/`)

1. **✅ Initial Setup** (`01-initial-setup.md`) — Turborepo, Vite+React frontend, Express backend, PostgreSQL+Prisma, Google OAuth login, dashboard layout
2. **✅ Teams** (`02-user-teams.md`) — Team CRUD, member management
3. **✅ Workspace & Projects** (`03-workspace-project.md`) — Workspace CRUD, workspace switching, project CRUD with status pipeline, member management
4. **✅ Tasks** (`04-tasks.md`, implemented in `05-tasks-implementation.md`) — Hierarchical tasks (N-level subtasks), status pipeline from project, comments with @mentions + file uploads, attached assets (files + links), task detail sheet (right-side) with breadcrumbs, list view + board view with drag-and-drop, grouping options (assigned_to, priority, status, createdAt)

---

## 14. Database Client Usage

The `@repo/db` package exports a singleton Prisma client:
```ts
import { prisma } from "@repo/db";
```
- Dev mode: client is cached on `globalThis` to survive hot reloads
- Production: fresh client per instance
- Also exports Prisma-generated types: `User`, `Team`, `TeamMember`, `Workspace`, `WorkspaceMember`, `Project`, `ProjectMember`, `Task`, `TaskComment`, `TaskAsset`

---

## 15. Key Design Patterns

- **Composite unique keys** for all join tables: `@@unique([parentId, userId])` prevents duplicates
- **Cascade deletes** on join tables (TeamMember, WorkspaceMember, ProjectMember), Restrict on creator FKs (Workspace.createdBy, Project.createdBy)
- **Inline editable fields** in detail sheets (ProjectDetailSheet) — click pencil → inline input → Enter/blur saves, Escape cancels
- **Drag-and-drop reorder** via HTML5 DnD API (SortableStatusChips) — uses refs instead of state during drag to avoid React re-render issues inside Sheets/Dialogs
- **Workspace-scoped data fetching** — Projects/Tasks query keys include `workspaceId`/`projectId` so switching refetches automatically
- **Error extraction pattern** — `(error as { response?: { data?: { error?: string } } })?.response?.data?.error` used consistently in mutations to show backend errors
- **Sheet-based forms** — Create/Edit task forms open as right-side Sheets (not center Dialogs) for consistency with detail panels
- **Polling for auth token** — WorkspaceProvider polls localStorage on mount to detect token appearance after login, then fetches workspaces
- **Midpoint position calculation** — Drag-and-drop reorder uses integer midpoint between surrounding positions; new tasks start at max+1000
