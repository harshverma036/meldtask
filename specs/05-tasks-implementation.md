# Task Management Implementation — Decisions & Documentation

## Date
2026-07-03

## Overview
Implemented the full Task Management feature end-to-end as specified in `specs/04-tasks.md`. Tasks live inside Projects and support unlimited nesting (subtasks), comments with mentions, file/link attachments, and two views: List View (with grouping) and Board View (drag-and-drop Kanban).

---

## Architecture Decisions

### 1. Database Schema
**New models added to Prisma schema:**
- `Task` — self-referencing via `parentId` for unlimited nesting depth. Uses `onDelete: SetNull` so deleting a parent doesn't cascade-delete children (they become top-level tasks).
- `TaskComment` — linked to Task via `taskId`, cascade deletes with task.
- `TaskAsset` — supports both file uploads (`type: "file"`) and link attachments (`type: "link"`). File assets have size and mimeType.
- `TaskPriority` enum — `Low`, `Medium`, `High`, `Urgent`.

**Key schema choices:**
- `position Int @default(0)` for ordering tasks within a parent/column. New tasks get `maxPosition + 1000` to leave room for reordering without rebalancing.
- Task status is a free-text string, not an enum — this allows projects to define custom statuses per the spec.
- Reverse relations on `User`: `assignedTasks` (Assignee), `assignedByTasks` (Assigner), `createdTasks` (TaskCreator), `taskComments` — using named relations to avoid ambiguity.

### 2. Backend API

**File: `apps/api/src/routes/tasks.ts`**
- All routes nested under `/api/projects/:projectId/tasks`
- 13 endpoints covering: CRUD, reorder (drag-drop), comments (CRUD), file upload, link attach
- Auth: any project member (any role) can create/edit/delete tasks — per spec "any user role will be able to add and manage task"
- Comment deletion restricted to: comment author, project Owner, workspace Admin/Owner, system Admin
- File upload via multer (disk storage, 25MB limit) — served statically at `/uploads`

**Validation: `apps/api/src/lib/validators/tasks.ts`**
- Separate validation file per module, following CLAUDE.md instructions
- 5 schemas: createTask, updateTask, reorderTask, createComment, createAssetLink

**Upload middleware: `apps/api/src/middleware/upload.ts`**
- Multer with disk storage in `apps/api/uploads/`
- Allowlist of common MIME types (images, PDFs, documents, code, archives, media)
- Files named with `timestamp-uuid.ext` pattern

### 3. Frontend Architecture

**Pages:**
- `Tasks.tsx` — main page at `/tasks`. Contains project selector, view toggle (Board/List), filters, task creation, task detail sheet.
- `TaskFullPage.tsx` — dedicated full-screen task view at `/tasks/:projectId/:taskId`

**Components (in `components/tasks/`):**
- `TaskCard.tsx` — compact card with priority badge, status chip, due date, assignee avatar, counts
- `TaskListView.tsx` — grouped task list with collapsible sections. Supports groupBy: status, priority, assignedTo, createdAt
- `TaskBoardView.tsx` — Kanban board using `@hello-pangea/dnd`. Drag tasks between columns to change status/position
- `TaskDetailSheet.tsx` — Slide-over sheet with breadcrumb, inline editing, subtasks, comments, assets. Close (X) and full-screen (Maximize) buttons
- `CreateTaskDialog.tsx` — Modal form using react-hook-form + yup for validation
- `CommentSection.tsx` — Comment thread with @mention rendering (`@userId:name` pattern)
- `AssetSection.tsx` — File upload + link attachment management
- `TaskFilters.tsx` — Search + priority/status/assignee filter dropdowns
- `Breadcrumb.tsx` — Clickable navigation breadcrumb

**Hooks: `hooks/useTasks.ts`**
- 12 TanStack Query hooks covering all API operations
- Each mutation invalidates relevant query keys on success
- Error handling with toast notifications

### 4. New Dependencies Installed

**Backend:**
- `multer` + `@types/multer` — file upload handling

**Frontend:**
- `@hello-pangea/dnd` — drag-and-drop for board view
- `react-hook-form` + `@hookform/resolvers` + `yup` — form state management & validation
- `@radix-ui/react-select` — dropdown select component
- `@radix-ui/react-tabs` — view toggle tabs

### 5. Shadcn Components Added
`select`, `tabs`, `textarea`, `badge`, `avatar`, `separator`, `tooltip`, `dropdown-menu`

---

## Key Implementation Details

### Task Nesting
- API returns children 2 levels deep by default (task → children → grandchildren)
- For deeper nesting, frontend navigates to child tasks individually
- Parent task deletion sets child's `parentId` to null (doesn't cascade-delete)

### Board View Drag-and-Drop
- Uses `@hello-pangea/dnd` (maintained fork of react-beautiful-dnd)
- Position calculated as midpoint between surrounding tasks
- Moving between columns updates both status and position
- Optimistic UI: TanStack Query cache invalidation after successful mutation

### File Uploads
- Multipart form-data via axios
- Stored on local disk at `apps/api/uploads/`
- Served statically by Express
- MIME type allowlist prevents unsafe file types
- 25MB file size limit

### Mentions
- Stored as `@userId:name` markers in comment content
- Rendered as highlighted badges in the UI
- Simple text-based format — no complex autocomplete in v1

### Forms
- First use of react-hook-form + yup in the project
- CreateTaskDialog uses controlled Select components via react-hook-form's `Controller`
- Existing forms (useState-based) remain unchanged

---

## Files Created/Modified

### New Files
- `packages/db/prisma/schema.prisma` — added TaskPriority enum, Task, TaskComment, TaskAsset models
- `apps/api/src/lib/validators/tasks.ts` — Zod validation schemas
- `apps/api/src/middleware/upload.ts` — Multer configuration
- `apps/api/src/routes/tasks.ts` — All task API endpoints
- `apps/web/src/lib/types/task.ts` — TypeScript interfaces
- `apps/web/src/hooks/useTasks.ts` — TanStack Query hooks
- `apps/web/src/components/ui/select.tsx` — Shadcn Select
- `apps/web/src/components/ui/tabs.tsx` — Shadcn Tabs
- `apps/web/src/components/ui/textarea.tsx` — Shadcn Textarea
- `apps/web/src/components/ui/badge.tsx` — Shadcn Badge
- `apps/web/src/components/ui/avatar.tsx` — Shadcn Avatar
- `apps/web/src/components/ui/separator.tsx` — Shadcn Separator
- `apps/web/src/components/ui/tooltip.tsx` — Shadcn Tooltip
- `apps/web/src/components/ui/dropdown-menu.tsx` — Shadcn DropdownMenu
- `apps/web/src/components/tasks/TaskCard.tsx`
- `apps/web/src/components/tasks/TaskListView.tsx`
- `apps/web/src/components/tasks/TaskBoardView.tsx`
- `apps/web/src/components/tasks/TaskDetailSheet.tsx`
- `apps/web/src/components/tasks/CreateTaskDialog.tsx`
- `apps/web/src/components/tasks/CommentSection.tsx`
- `apps/web/src/components/tasks/AssetSection.tsx`
- `apps/web/src/components/tasks/TaskFilters.tsx`
- `apps/web/src/components/tasks/Breadcrumb.tsx`
- `apps/web/src/pages/Tasks.tsx`
- `apps/web/src/pages/TaskFullPage.tsx`

### Modified Files
- `apps/api/src/app.ts` — registered taskRoutes, static file serving for uploads
- `apps/web/src/App.tsx` — added `/tasks` and `/tasks/:projectId/:taskId` routes
- `.gitignore` — added `apps/api/uploads/*` exclusion

---

## Verification Checklist
- [x] Prisma schema pushed to database (`pnpm db:push` succeeded)
- [x] Backend TypeScript compiles with zero errors
- [x] Frontend TypeScript compiles with zero errors
- [x] All shadcn components created and importable
- [x] Routes registered in App.tsx
- [x] Sidebar already has Tasks link at `/tasks`
