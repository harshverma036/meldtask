import { z } from "zod";

/**
 * Zod validation schemas for the Task Management module.
 * All request bodies for task endpoints are validated here.
 */

/**
 * Helper: accepts ISO datetime, date-only strings (e.g. "2026-07-03"),
 * or null/undefined. Refines to ensure the string is a valid parseable date.
 */
const dueDateSchema = z
  .string()
  .refine(
    (val) => {
      // Accept date-only (YYYY-MM-DD) or ISO datetime
      const parsed = new Date(val);
      return !isNaN(parsed.getTime());
    },
    { message: "Invalid date string" }
  )
  .optional()
  .nullable();

/** Schema for POST /api/projects/:projectId/tasks */
export const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title must be at most 200 characters"),
  description: z.string().max(2000, "Description must be at most 2000 characters").optional(),
  status: z.string().min(1).max(50).optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  dueDate: dueDateSchema,
  assignedTo: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

/** Schema for PATCH /api/projects/:projectId/tasks/:id */
export const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  status: z.string().min(1).max(50).optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  dueDate: dueDateSchema,
  assignedTo: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

/** Schema for PATCH /api/projects/:projectId/tasks/:id/reorder */
export const reorderTaskSchema = z.object({
  position: z.number().int().min(0),
  status: z.string().min(1).max(50).optional(),
});

/** Schema for POST /api/projects/:projectId/tasks/:id/comments */
export const createCommentSchema = z.object({
  content: z.string().min(1, "Comment cannot be empty").max(5000, "Comment must be at most 5000 characters"),
});

/** Schema for POST /api/projects/:projectId/tasks/:id/assets/link */
export const createAssetLinkSchema = z.object({
  url: z.string().url("Must be a valid URL"),
  name: z.string().min(1, "Link name is required").max(200),
});

/** Schema for query params on GET /api/projects/:projectId/tasks */
export const taskQuerySchema = z.object({
  status: z.string().optional(),
  priority: z.enum(["Low", "Medium", "High", "Urgent"]).optional(),
  assignedTo: z.string().optional(),
  parentId: z.string().optional().nullable(),
  search: z.string().optional(),
  groupBy: z.enum(["status", "priority", "assignedTo", "createdAt"]).optional(),
});

// ── Inferred Types ──────────────────────────────────────────────────────────

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type ReorderTaskInput = z.infer<typeof reorderTaskSchema>;
export type CreateCommentInput = z.infer<typeof createCommentSchema>;
export type CreateAssetLinkInput = z.infer<typeof createAssetLinkSchema>;
export type TaskQueryInput = z.infer<typeof taskQuerySchema>;
