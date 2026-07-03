import { z } from "zod";

/** Schema for POST /api/auth/google */
export const googleAuthSchema = z.object({
  idToken: z.string().min(1, "idToken is required"),
});

/** Schema for POST /api/auth/email */
export const emailAuthSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  name: z.string().optional(),
});

/** Schema for PATCH /api/users/:id/role */
export const updateRoleSchema = z.object({
  role: z.enum(["Admin", "Developer", "Manager"]),
});

/** Schema for POST /api/teams */
export const createTeamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100),
  description: z.string().max(500).optional(),
  memberEmails: z.array(z.string().email()).max(50).optional(),
});

/** Schema for PATCH /api/teams/:id */
export const updateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

/** Schema for POST /api/users/invite */
export const inviteUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["Admin", "Developer", "Manager"]),
  teamId: z.string().optional(),
});

/** Schema for POST /api/teams/:id/members */
export const addMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["Lead", "Member"]).default("Member"),
});

// ── Workspace Schemas ──────────────────────────────────────────────────────────

/** Schema for POST /api/workspaces */
export const createWorkspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required").max(100),
  description: z.string().max(500).optional(),
});

/** Schema for PATCH /api/workspaces/:id */
export const updateWorkspaceSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

/** Schema for POST /api/workspaces/:id/members */
export const addWorkspaceMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["Admin", "Member"]).default("Member"),
});

// ── Project Schemas ────────────────────────────────────────────────────────────

/** Schema for POST /api/workspaces/:workspaceId/projects */
export const createProjectSchema = z.object({
  name: z.string().min(1, "Project name is required").max(100),
  description: z.string().max(500).optional(),
  statuses: z.array(z.string().min(1).max(50)).max(20).default([]),
});

/** Schema for PATCH /api/workspaces/:workspaceId/projects/:id */
export const updateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  statuses: z.array(z.string().min(1).max(50)).max(20).optional(),
});

/** Schema for POST /api/workspaces/:workspaceId/projects/:id/members */
export const addProjectMemberSchema = z.object({
  email: z.string().email("Invalid email address"),
  role: z.enum(["Owner", "Member"]).default("Member"),
});

export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type EmailAuthInput = z.infer<typeof emailAuthSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type AddMemberInput = z.infer<typeof addMemberSchema>;
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;
export type AddWorkspaceMemberInput = z.infer<typeof addWorkspaceMemberSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
