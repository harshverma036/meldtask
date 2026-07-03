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

All components use existing `@/lib/utils.ts` `cn()` utility and the dark theme CSS variables from `index.css`.

---

## 2. Admin Invite Endpoint

### `POST /api/users/invite` (Admin only)
- Validates `{ email, role }` via Zod (`inviteUserSchema`)
- Checks email domain is allowed (`youngun.in`, `meldit.ai`, or whitelist)
- Creates User with `status: "Active"` (pre-approved), given role, no password/googleId
- Returns 201 with created user, or 409 if email already exists
- Added `isEmailAuthorized()` helper (mirrors `checkEmailAuthorized` from auth.ts)

### Invite + Login flow:
1. Admin invites `dev@youngun.in` as Developer → User created (Active, no googleId)
2. User signs in via Google → `findFirst({ OR: [{ googleId }, { email }] })` finds by email
3. googleId/name/avatarUrl updated on login, JWT issued (already Active)

---

## 3. CreateTeamDialog Refactored

- Replaced custom `fixed` backdrop + centered `div` with `<Dialog>` + `<DialogContent>`
- Uses `<DialogHeader>`, `<DialogTitle>`, `<DialogDescription>`
- Cancel button: `<Button variant="outline">` (shadcn outline)
- Submit button: `<Button>` (shadcn default/primary)
- Text inputs: `<Input>` (shadcn)
- Textarea: kept as styled `<textarea>` (no shadcn Textarea component yet)
- Footer: `<DialogFooter>` for right-aligned actions

---

## 4. AdminUsers Page Restructured

### Two sections (tabs):
- **Members** (default): Shows all Active users with:
  - Role dropdown (editable)
  - Status badge (green)
  - "Invite User" button in header → opens `InviteUserDialog`
  - No approve/reject actions
  
- **Pending**: Shows all Pending users with:
  - Approve (checkmark) / Reject (X) buttons
  - Same role dropdown + status badge

### InviteUserDialog
- shadcn Dialog with form: Email input + Role select (Developer/Manager/Admin)
- TanStack Mutation: `useMutation` POSTs to `/api/users/invite`
- Invalidates `["admin-users"]` on success, shows success toast with email + role

---

## 5. Files Changed

### New (4):
- `apps/web/src/components/ui/dialog.tsx`
- `apps/web/src/components/ui/button.tsx`
- `apps/web/src/components/ui/input.tsx`
- `apps/web/src/components/admin/InviteUserDialog.tsx`

### Modified (4):
- `apps/api/src/lib/validators.ts` — added `inviteUserSchema`
- `apps/api/src/routes/users.ts` — added `POST /invite` endpoint
- `apps/web/src/components/teams/CreateTeamDialog.tsx` — shadcn Dialog refactor
- `apps/web/src/pages/AdminUsers.tsx` — Members + Pending tabs, invite button

---

## 6. Verification

| Check | Status |
|---|---|
| API type-check | ✅ No errors |
| Web type-check | ✅ No errors |
