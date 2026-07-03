# 03-execution-agent — Workspace & Project Implementation

## Overview

Implemented `specs/03-workspace-project.md` across the full stack: database, backend API routes with Zod validation, and frontend pages/components all following the patterns established in previous phases. This also includes the multi-tag status pipeline with drag-and-drop reordering, inline editing, and member selection from existing workspace users — all implemented iteratively from user feedback.

---

## Phase 1: Database Schema

### New Enums
- **WorkspaceMemberRole**: `Owner`, `Admin`, `Member`
- **ProjectMemberRole**: `Owner`, `Member`

**Why these roles for Workspace?** Workspaces are organization-level containers (above Teams). The person who creates a workspace is the Owner with full control. They can promote others to Admin for shared management. Regular members can access but not manage.

### New Models

**Workspace** — Top-level container. Multiple per user. Admin-only creation.
```
id, name, description?, createdBy (FK User), timestamps
Relations: creator (User, onDelete: Restrict), members (WorkspaceMember[], cascade), projects (Project[], cascade)
```

**WorkspaceMember** — Join table. Composite unique `[workspaceId, userId]`. Cascade delete.

**Project** — Lives inside a workspace. Has `statuses: String[]` (PostgreSQL array — not a separate table). Created by any workspace member.
```
id, name, description?, statuses (String[]), workspaceId, createdBy, timestamps
Relations: workspace (cascade), creator (Restrict), members (ProjectMember[], cascade)
```

**ProjectMember** — Join table. Composite unique `[projectId, userId]`. Cascade delete.

### Why String[] for statuses instead of a relation table?
User wanted custom, free-form status tags that they type in ("In Progress", "Under Development", etc.). A PostgreSQL array preserves order naturally (index = sequence number) without needing a separate `ProjectStatus` table with an `order` column. The array `String[]` in Prisma maps directly to PostgreSQL's native array type — zero extra queries, zero joins needed.

### Why onDelete: Restrict for creator relations?
Prevents accidental data loss. If a user who created a workspace or project is deleted, the workspace/project data survives. For member join tables, cascade is correct — removing a workspace removes all memberships and projects.

---

## Phase 2: Backend API

### Workspace Routes (`apps/api/src/routes/workspaces.ts`) — 8 endpoints

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/api/workspaces` | Auth | Lists workspaces where user is a member |
| POST | `/api/workspaces` | Admin only | Creator becomes Owner |
| GET | `/:id` | Auth | Returns workspace + members + projects |
| PATCH | `/:id` | Owner/Admin | Update name/description |
| DELETE | `/:id` | Owner/Admin | Cascades to members and projects |
| POST | `/:id/members` | Owner/Admin | Add member by email |
| DELETE | `/:id/members/:userId` | Owner/Admin | Cannot remove Owner |
| GET | `/:id/members` | Auth | Lightweight member list (for selectors) |

**Key decisions:**
- Only Admins can create workspaces. This prevents workspace sprawl — admins control the organizational structure.
- System Admin (`UserRole.Admin`) always has bypass on any workspace operation (same pattern as Teams).
- Cannot remove the workspace Owner — prevents orphaned workspaces.
- The `GET /:id/members` endpoint was added later to support the MemberSelector component without loading the full workspace (which includes all projects).

### Project Routes (`apps/api/src/routes/projects.ts`) — 7 endpoints

All scoped under `/api/workspaces/:workspaceId/projects`.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/` | Workspace member | List projects with members |
| POST | `/` | Workspace member | Creator becomes Owner; **statuses array included** |
| GET | `/:id` | Workspace member | Single project with members |
| PATCH | `/:id` | Owner/WS Admin/Sys Admin | Update name, description, statuses |
| DELETE | `/:id` | Owner/WS Admin/Sys Admin | Cascades to members |
| POST | `/:id/members` | Can manage | User must be workspace member first |
| DELETE | `/:id/members/:userId` | Can manage | Cannot remove Owner |

**Key decisions:**
- Projects are URL-nested: `/api/workspaces/:workspaceId/projects`. This enforces the hierarchical relationship in the API contract — you can never access a project outside its workspace context.
- Any workspace member can create projects (not restricted to Admin). Projects are collaborative units.
- Project members must first be workspace members. The add-member endpoint explicitly checks `WorkspaceMember.findUnique` before allowing addition.
- "Can manage" gates: Project Owner OR Workspace Owner/Admin OR System Admin. Three-tier authorization provides flexible project governance.

**Bug fixed during iteration**: The create handler was destructuring `{ name, description }` from parsed data but dropping `statuses`. The Zod validator accepted `statuses` correctly but the route never passed it to `prisma.project.create`. Fixed by adding `statuses` to destructure and the `data` object.

### Validation (Zod) — Updated in `apps/api/src/lib/validators.ts`
```
createWorkspaceSchema    — name (1-100 chars), description (max 500)
updateWorkspaceSchema    — both optional
addWorkspaceMemberSchema — email, role (Admin|Member, default Member)
createProjectSchema      — name, description?, statuses (string[], max 20, default [])
updateProjectSchema      — all optional
addProjectMemberSchema   — email, role (Owner|Member, default Member)
```

**Why Zod `.default([])` on statuses?** Makes statuses truly optional — a project without status stages is valid (they can add them later). Zero-config default prevents null checks everywhere downstream.

---

## Phase 3: Frontend Architecture

### WorkspaceContext (`apps/web/src/context/WorkspaceContext.tsx`)

State shape:
```
activeWorkspace: Workspace | null  — current selection
workspaces: Workspace[]            — all user's workspaces
isLoading: boolean                 — initial fetch
switchWorkspace(id): void          — persist to localStorage
refreshWorkspaces(): Promise       — re-fetch from API
```

**Key decisions:**
- Separate context from AuthContext. Workspace is application state, auth is session state — different lifecycles, different consumers.
- `activeWorkspace` persisted as `active_workspace_id` in localStorage (mirrors `auth_token` pattern).
- Auto-selects first workspace on login if none was previously selected.
- Cleared on logout and on 401 (both `AuthContext.logout()` and `axios.ts` interceptor).

### WorkspaceGuard (`components/layout/WorkspaceGuard.tsx`)

Placed between `ProtectedRoute` and page content in the route tree:
```
<AuthProvider>
  <WorkspaceProvider>
    <Routes>
      <ProtectedRoute>        ← checks user auth
        <WorkspaceGuard>      ← checks workspace selection
          <Page />            ← renders only if both pass
        </WorkspaceGuard>
      </ProtectedRoute>
    </Routes>
  </WorkspaceProvider>
</AuthProvider>
```

**Why a guard instead of a route?** The workspace selection screen isn't a navigable page — it's a modal-like gate. No URL for it, no back-button confusion. It renders inline when the condition fails.

### WorkspaceSelection Page
Standalone page (no sidebar/topbar) shown when no workspace is active:
- Admin: shows workspace list + "Create Workspace" button (always visible)
- Non-admin empty state: "Contact your admin" message
- Uses its own `useQuery(["workspaces"])` independent of context

### Topbar Workspace Switcher
Dropdown between search bar and profile. Shows `Building` icon + current workspace name. Lists all workspaces with `Check` icon on the active one. Clicking switches workspace and updates all workspace-scoped data.

### Sidebar Nav Items
Added `Workspaces` (Building icon, `/workspaces`) and `Projects` (FolderKanban icon, `/projects`) to the nav items array. Both visible to all authenticated users.

---

## Phase 4: Project Status Pipeline

### Evolution

**v1 (initial)**: Single `ProjectStatus` enum dropdown — user picks one status from a fixed list.

**v2 (user feedback)**: Multi-tag system — users type custom status names, add them as chips/tags. Stored as `String[]` in PostgreSQL. Color auto-assigned via hash function for consistency.

**v3 (user feedback)**: Full-width rows with drag-and-drop reordering. Each status is a draggable row with grip handle, name, and remove button. Reordering persists immediately.

### SortableStatusChips Component

Uses HTML5 Drag and Drop API (no library dependency) with critical implementation details:

**Bug that broke drag in Sheets**: Initially used `useState` for `dragIndex`, which triggered re-renders during drag. The Sheet component (Radix Dialog) captures pointer events, and React re-renders during drag caused the dragged element to lose its drag state. **Fix**: Switched to `useRef` for drag tracking — zero re-renders during drag operations.

**Key stability**: Initially used `key={`${status}-${i}`}`, which caused React to unmount/remount elements when the array was reordered (since `i` changes). **Fix**: Switched to `key={status}` (stable by content). When React sees the same keys in a different order, it preserves the DOM nodes and just repositions them — exactly what we want for drag-and-drop.

### Status Color System (`lib/projectStatus.ts`)

Known statuses get consistent branded colors (mapped lowercase):
| Status | Color |
|---|---|
| Brainstorming | Purple |
| Planning | Blue |
| In Progress | Yellow |
| Under Development | Orange |
| Under Testing | Cyan |
| In Review | Pink |
| Completed | Green |
| On Hold | Gray |
| Cancelled | Red |

Unknown/custom statuses get a stable color from a 12-color palette using a simple hash function (`hash * 31 + charCode`). Same string always gets the same color.

---

## Phase 5: Member Selection

### Evolution

**v1**: Free-text email input. User types an email, clicks Add. Prone to typos and requires knowing exact emails.

**v2 (user feedback)**: Searchable dropdown showing workspace members who aren't already in the project.

### MemberSelector Component

- Fetches from `GET /api/workspaces/:id/members` (lightweight endpoint — just member list, no projects)
- Filters out `excludeUserIds` (current project members)
- Searchable by name or email
- Click to instantly add (no separate "Add" button needed)
- Shows avatar, name, and email for each result
- Outside click closes the dropdown
- Stale time: 30 seconds (member list doesn't change often)

**Why a separate endpoint instead of fetching the full workspace?** `GET /api/workspaces/:id` returns members + all projects with their members. That's potentially large payload. The `/members` endpoint returns just `[{ id, role, user: { id, email, name, avatarUrl } }]` — minimal, fast, perfect for a dropdown.

---

## Phase 6: ProjectDetailSheet — Central Hub

The sheet is designed as the single place to manage everything about a project:

### Inline Editing
- **Name**: Click pencil icon → input appears with auto-focus and text selected → Enter saves, Escape cancels
- **Description**: Same pattern
- Both only available to Owner/Admin
- Changes persist on Enter/blur via PATCH

### Status Pipeline Section
- Sortable full-width rows (SortableStatusChips with `editable={canManage}`)
- Drag grip handle → reorder → persists on drop
- Add new stage: input + Plus button
- Remove: X button on each row
- Shows count: "3 stages"
- Read-only for non-managers

### Info Section
Small card showing:
- Workspace name (from WorkspaceContext)
- Project owner (from members array, with Crown icon)
- Creation date (formatted via date-fns)

### Members Section
- Avatar + name + email for each member
- "(you)" label on current user
- Role badge (Owner gets yellow Crown icon)
- Remove button (Owner/Admin only; cannot remove Owner)
- Add member: MemberSelector dropdown + role chooser

### Data Sync
**Problem**: After mutations (add status, remove member, etc.), the query cache refetches but the `selectedProject` state in the parent (`Projects.tsx`) still held the old data. The sheet received the old `project` prop.

**Fix**: Two mechanisms working together:
1. `useEffect` in `Projects.tsx` watches `projects` array and auto-updates `selectedProject` when the data changes (finds by ID)
2. `onUpdate` callback prop — update mutations pass the API response directly to the parent for instant update without waiting for refetch

---

## Phase 7: CreateProjectDialog

Dialog form with:
- Name (required)
- Description (optional)
- SortableStatusChips for status tags with inline add/remove
- Status input: type + Enter or click Plus → chip appears → drag to reorder
- All statuses submitted as array on create

**Bug fixed**: Backend wasn't saving statuses on create (see Phase 2). After backend fix, statuses flow: input → state array → form submit → POST body → Zod validation → Prisma create.

---

## Phase 8: Workspace Components

Following the exact same patterns as Team components:

### CreateWorkspaceDialog
- Admin-only dialog with name + description
- On success: invalidates both workspace query cache AND workspace context state
- Auto-switches to the newly created workspace

### WorkspaceCard
- Grid card with name, description (2-line clamp), member count + avatar stack
- Hover-reveal delete button (Owner/Admin only)
- Click opens detail sheet

### WorkspaceDetailSheet
- Member list with avatars, role badges (Crown for Owner), remove buttons
- Add member: email input + role select
- Created date footer

---

## Files Changed

### New Files (16)
| File | Purpose |
|---|---|
| `apps/api/src/routes/workspaces.ts` | 8 workspace endpoints |
| `apps/api/src/routes/projects.ts` | 7 project endpoints |
| `apps/web/src/context/WorkspaceContext.tsx` | Workspace state management |
| `apps/web/src/hooks/useWorkspace.ts` | Re-export barrel |
| `apps/web/src/components/layout/WorkspaceGuard.tsx` | Workspace selection gate |
| `apps/web/src/pages/WorkspaceSelection.tsx` | Post-login workspace picker |
| `apps/web/src/pages/Workspaces.tsx` | Workspace CRUD page |
| `apps/web/src/pages/Projects.tsx` | Project CRUD page (workspace-scoped) |
| `apps/web/src/components/workspaces/CreateWorkspaceDialog.tsx` | Create form |
| `apps/web/src/components/workspaces/WorkspaceCard.tsx` | Grid card |
| `apps/web/src/components/workspaces/WorkspaceDetailSheet.tsx` | Detail sheet |
| `apps/web/src/components/projects/CreateProjectDialog.tsx` | Create form with status tags |
| `apps/web/src/components/projects/ProjectCard.tsx` | Grid card with status badges |
| `apps/web/src/components/projects/ProjectDetailSheet.tsx` | Central hub sheet |
| `apps/web/src/components/projects/SortableStatusChips.tsx` | Drag-and-drop status rows |
| `apps/web/src/components/projects/MemberSelector.tsx` | Searchable user dropdown |
| `apps/web/src/lib/projectStatus.ts` | Status color config + hash function |

### Modified Files (10)
| File | Change |
|---|---|
| `packages/db/prisma/schema.prisma` | Added 2 enums, 4 models, User relations |
| `packages/db/src/index.ts` | Export new types |
| `apps/api/src/lib/validators.ts` | 6 new Zod schemas + inferred types |
| `apps/api/src/app.ts` | Register workspace + project routes |
| `apps/web/src/App.tsx` | WorkspaceProvider, WorkspaceGuard, new routes |
| `apps/web/src/components/layout/Topbar.tsx` | Workspace switcher dropdown |
| `apps/web/src/components/layout/Sidebar.tsx` | Workspaces + Projects nav items |
| `apps/web/src/context/AuthContext.tsx` | Clear `active_workspace_id` on logout |
| `apps/web/src/lib/axios.ts` | Clear `active_workspace_id` on 401 |
| `apps/web/src/pages/Projects.tsx` | Added useEffect sync + onUpdate callback |

---

## Key Technical Decisions & Rationale

1. **String[] for statuses vs relation table**: Array preserves order naturally (index = sequence), zero joins, perfect for drag-and-drop reorder. A `ProjectStatus` table with `order` column would require updating `order` on every row during reorder.

2. **Refs over state for drag tracking**: Drag-and-drop inside Radix Dialog/Sheet breaks when React re-renders during drag. Refs bypass the render cycle entirely.

3. **Stable keys using content**: `key={status}` preserves DOM nodes during reorder. `key={`${status}-${i}`}` destroys and recreates nodes because `i` changes.

4. **Separate WorkspaceContext from AuthContext**: Different lifecycles. Auth is session-level (login/logout). Workspace is app-level (switching during session). Decoupled for clarity.

5. **Guard pattern over route**: Workspace selection is a gate, not a page. No URL means no browser-back navigation to "no workspace selected" state.

6. **URL-nested project routes**: `/api/workspaces/:id/projects` enforces hierarchy in the API contract. Impossible to access a project outside its workspace context.

7. **Three-tier project authorization**: Project Owner → Workspace Admin/Owner → System Admin. Each tier provides escalating access, preventing single-point-of-failure in access control.

8. **Lightweight /members endpoint**: Avoids loading full workspace (with all projects) just to populate a dropdown. 30-second stale time reduces unnecessary refetches.

---

## Verification

| Check | Status |
|---|---|
| Backend TypeScript | ✅ Clean |
| Frontend TypeScript | ✅ Clean |
| Database schema push | ✅ Synced |
| Workspace CRUD | ✅ Create, list, detail, update, delete |
| Workspace member mgmt | ✅ Add, remove (Owner protected) |
| Project CRUD | ✅ Create (with statuses), list, detail, update, delete |
| Project member mgmt | ✅ Add (from workspace members), remove |
| Status pipeline DnD | ✅ Drag to reorder, persists on drop |
| Status inline add/remove | ✅ From sheet and create dialog |
| Member selector dropdown | ✅ Searchable, filters already-added |
| Workspace selection flow | ✅ Post-login gate, auto-select |
| Workspace switcher | ✅ Topbar dropdown with checkmark |
| Inline name/desc editing | ✅ Click pencil, Enter/Escape, auto-save |
| Logout cleanup | ✅ Both `auth_token` and `active_workspace_id` cleared |
