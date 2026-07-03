# 03-execution-agent — Admin Invite + shadcn Dialogs + Members Section

## Overview

Three fixes from user feedback on the teams/users implementation:
1. Added admin invite flow (`POST /api/users/invite`) so admins can pre-approve users
2. Replaced custom modal markup with proper shadcn Dialog/Button/Input components
3. Restructured admin page with "Members" section (active users + invite) and "Pending" section (approvals)

---

## 1. shadcn UI Components Created

### `components/ui/dialog.tsx`
Standard shadcn Dialog wrapping `@radix-ui/react-dialog` (already installed). Exports: Dialog, DialogTrigger, DialogPortal, DialogOverlay, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription, DialogClose. Close button (X) in top-right of content. Animations via `data-[state=open/closed]` variants.

### `components/ui/button.tsx`
Standard shadcn Button with CVA variants: default (primary), destructive, outline, secondary, ghost, link. Sizes: default, sm, lg, icon. Uses `@radix-ui/react-slot` for `asChild` pattern.

### `components/ui/input.tsx`
Standard shadcn Input — styled `<input>` with dark theme border/bg/focus-ring.

---

## 2. Admin Invite Endpoint

### `POST /api/users/invite` (Admin only)
- Validates `{ email, role }` via Zod (`inviteUserSchema`)
- Checks email domain is allowed (`youngun.in`, `meldit.ai`, or whitelist)
- Creates User with `status: "Active"` (pre-approved), given role, no password/googleId
- Returns 201 with created user, or 409 if email already exists

---

## 3. Files Changed (Original 03)
- `apps/web/src/components/ui/dialog.tsx` (new)
- `apps/web/src/components/ui/button.tsx` (new)
- `apps/web/src/components/ui/input.tsx` (new)
- `apps/web/src/components/admin/InviteUserDialog.tsx` (new)
- `apps/api/src/lib/validators.ts` — added `inviteUserSchema`
- `apps/api/src/routes/users.ts` — added `POST /invite`
- `apps/web/src/components/teams/CreateTeamDialog.tsx` — shadcn Dialog refactor
- `apps/web/src/pages/AdminUsers.tsx` — Members + Pending tabs

---

# 03-execution-agent — Workspace & Project Implementation

## Overview

Implemented Workspace and Project features as specified in `specs/03-workspace-project.md`. This adds a new organizational layer above Teams — Workspaces contain multiple Projects, and users must select a workspace before accessing the app.

---

## Database Schema Changes

### New Enums
- **WorkspaceMemberRole**: Owner, Admin, Member
- **ProjectMemberRole**: Owner, Member

### New Models
- **Workspace**: id, name, description, createdBy (FK User), timestamps. Relations: creator (User), members (WorkspaceMember[]), projects (Project[])
- **WorkspaceMember**: id, workspaceId, userId, role, joinedAt. Composite unique: [workspaceId, userId]. Cascades on delete.
- **Project**: id, name, description, workspaceId, createdBy, timestamps. Relations: workspace (Workspace), creator (User), members (ProjectMember[])
- **ProjectMember**: id, projectId, userId, role, joinedAt. Composite unique: [projectId, userId]. Cascades on delete.

### User Model Updates
Added relation fields: `workspaces WorkspaceMember[]`, `projects ProjectMember[]`, `createdWorkspaces Workspace[]`, `createdProjects Project[]`

**Decision**: Used `onDelete: Restrict` for creator relations to prevent orphaned records when a user is deleted. Used `onDelete: Cascade` for member/project relations to auto-cleanup when parent is deleted.

---

## Backend API

### Workspace Routes (`apps/api/src/routes/workspaces.ts`) — 7 endpoints
All routes require authentication. Only Admins can create workspaces. Owner/Admin can manage.

### Project Routes (`apps/api/src/routes/projects.ts`) — 7 endpoints
Projects are URL-nested under workspaces. Users must be workspace members to access. Only Project Owner, Workspace Admin/Owner, or System Admin can manage.

### Key Authorization Decisions
- System Admin (UserRole.Admin) always has bypass permissions on any workspace/project
- Project members must first be workspace members
- Workspace Owner cannot be removed from their workspace
- Any workspace member can create projects (not restricted)

---

## Frontend Architecture

### WorkspaceContext
Separate context from AuthContext. Stores activeWorkspace + workspaces list. Persists `active_workspace_id` in localStorage. Auto-selects first workspace if none stored.

### Login → Workspace Flow
1. User logs in → AuthContext authenticates → ProtectedRoute passes
2. WorkspaceContext fetches workspaces from API
3. WorkspaceGuard: no active workspace → render WorkspaceSelection page
4. User selects/creates workspace → guard renders actual app content
5. WorkspaceSelection is NOT a route — rendered inline by the guard

### Components Created (10 new)
- WorkspaceGuard, WorkspaceSelection page
- CreateWorkspaceDialog, WorkspaceCard, WorkspaceDetailSheet
- Workspaces page (full CRUD)
- CreateProjectDialog, ProjectCard, ProjectDetailSheet
- Projects page (scoped to active workspace)

### Layout Changes
- **Topbar**: Workspace switcher dropdown with Building icon + workspace list + checkmark on active
- **Sidebar**: Added Workspaces + Projects nav items
- **Logout cleanup**: Both AuthContext.logout() and axios 401 interceptor clear `active_workspace_id`

---

## All Files Changed (Workspace/Project Implementation)

### New (14 files)
1. `apps/api/src/routes/workspaces.ts`
2. `apps/api/src/routes/projects.ts`
3. `apps/web/src/context/WorkspaceContext.tsx`
4. `apps/web/src/hooks/useWorkspace.ts`
5. `apps/web/src/components/layout/WorkspaceGuard.tsx`
6. `apps/web/src/pages/WorkspaceSelection.tsx`
7. `apps/web/src/components/workspaces/CreateWorkspaceDialog.tsx`
8. `apps/web/src/components/workspaces/WorkspaceCard.tsx`
9. `apps/web/src/components/workspaces/WorkspaceDetailSheet.tsx`
10. `apps/web/src/pages/Workspaces.tsx`
11. `apps/web/src/components/projects/CreateProjectDialog.tsx`
12. `apps/web/src/components/projects/ProjectCard.tsx`
13. `apps/web/src/components/projects/ProjectDetailSheet.tsx`
14. `apps/web/src/pages/Projects.tsx`

### Modified (8 files)
1. `packages/db/prisma/schema.prisma` — Added enums + 4 models + User relations
2. `packages/db/src/index.ts` — Export new types
3. `apps/api/src/lib/validators.ts` — Added 6 Zod schemas
4. `apps/api/src/app.ts` — Register workspace + project routes
5. `apps/web/src/App.tsx` — WorkspaceProvider, WorkspaceGuard, new routes
6. `apps/web/src/components/layout/Topbar.tsx` — Workspace switcher
7. `apps/web/src/components/layout/Sidebar.tsx` — Workspaces + Projects nav
8. `apps/web/src/context/AuthContext.tsx` — Clear active_workspace_id on logout
9. `apps/web/src/lib/axios.ts` — Clear active_workspace_id on 401

---

## Verification

| Check | Status |
|---|---|
| API TypeScript | ✅ Clean |
| Web TypeScript | ✅ Clean |
| DB Schema Push | ✅ Synced |
