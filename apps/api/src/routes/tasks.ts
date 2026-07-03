import { Router, Response } from "express";
import { prisma } from "@repo/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { upload } from "../middleware/upload";
import {
  createTaskSchema,
  updateTaskSchema,
  reorderTaskSchema,
  createCommentSchema,
  createAssetLinkSchema,
} from "../lib/validators/tasks";

const router = Router();

// All routes require authentication
router.use(authenticate);

/** Helper: extract a typed route param */
function param(req: AuthRequest, key: string): string {
  return req.params[key] as string;
}

/**
 * Helper: check if a user is a member of a project.
 * Returns the membership record or null.
 */
async function getProjectMembership(projectId: string, userId: string) {
  return prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
}

/**
 * Helper: check if the requester can manage a project resource.
 * Project Owner, workspace Admin/Owner, or system Admin.
 */
async function canManageProject(
  projectId: string,
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const projectMembership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (projectMembership?.role === "Owner") return true;

  const workspaceMembership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });

  if (
    workspaceMembership?.role === "Owner" ||
    workspaceMembership?.role === "Admin"
  )
    return true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  return user?.role === "Admin";
}

/**
 * Helper: get the project's workspaceId for context.
 */
async function getProjectWorkspaceId(
  projectId: string
): Promise<string | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { workspaceId: true },
  });
  return project?.workspaceId ?? null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Task CRUD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/projects/:projectId/tasks — List tasks for a project.
 * Supports optional query filters: status, priority, assignedTo, parentId, search, groupBy.
 * User must be a project member.
 */
router.get(
  "/projects/:projectId/tasks",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const userId = req.userId!;

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to view tasks" });
        return;
      }

      const { status, priority, assignedTo, parentId, search } =
        req.query as Record<string, string | undefined>;

      // Build filter
      const where: Record<string, unknown> = { projectId };
      if (status) where.status = status;
      if (priority) where.priority = priority;
      if (assignedTo) where.assignedTo = assignedTo;
      if (parentId !== undefined) {
        where.parentId = parentId === "null" ? null : parentId;
      }
      if (search) {
        where.title = { contains: search, mode: "insensitive" };
      }

      const tasks = await prisma.task.findMany({
        where: where as any,
        include: {
          assignee: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          assigner: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          creator: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { children: true, comments: true, assets: true },
          },
        },
        orderBy: { position: "asc" },
      });

      res.json({ tasks });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch tasks";
      console.error("GET /api/projects/:projectId/tasks error:", message);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/projects/:projectId/tasks — Create a new task.
 * Any project member can create a task. Creator becomes the assigner.
 */
router.post(
  "/projects/:projectId/tasks",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const userId = req.userId!;

      // Validate request body
      const parsed = createTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to create tasks" });
        return;
      }

      const { title, description, status, priority, dueDate, assignedTo, parentId } =
        parsed.data;

      // If parentId is provided, verify the parent task exists in this project
      if (parentId) {
        const parentTask = await prisma.task.findFirst({
          where: { id: parentId, projectId },
        });
        if (!parentTask) {
          res
            .status(404)
            .json({ error: "Parent task not found in this project" });
          return;
        }
      }

      // Calculate next position (max position under same parent + 1000)
      const maxPositionTask = await prisma.task.findFirst({
        where: { projectId, parentId: parentId ?? null },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const nextPosition = (maxPositionTask?.position ?? 0) + 1000;

      const task = await prisma.task.create({
        data: {
          title,
          description: description ?? null,
          status: status ?? "Backlog",
          priority: priority ?? "Medium",
          dueDate: dueDate ? new Date(dueDate) : null,
          projectId,
          parentId: parentId ?? null,
          assignedTo: assignedTo ?? null,
          assignedBy: userId,
          createdBy: userId,
          position: nextPosition,
        },
        include: {
          assignee: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          assigner: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          creator: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { children: true, comments: true, assets: true },
          },
        },
      });

      res.status(201).json({ task });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create task";
      console.error("POST /api/projects/:projectId/tasks error:", message);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /api/projects/:projectId/tasks/:id — Get a single task with full details.
 * Includes assignee, assigner, creator, children (2 levels), comments, and assets.
 * User must be a project member.
 */
router.get(
  "/projects/:projectId/tasks/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to view tasks" });
        return;
      }

      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
        include: {
          assignee: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          assigner: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          creator: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          children: {
            include: {
              assignee: {
                select: { id: true, email: true, name: true, avatarUrl: true },
              },
              _count: {
                select: { children: true, comments: true, assets: true },
              },
            },
            orderBy: { position: "asc" },
          },
          comments: {
            include: {
              author: {
                select: { id: true, email: true, name: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: "asc" },
          },
          assets: {
            orderBy: { createdAt: "desc" },
          },
          _count: {
            select: { children: true, comments: true, assets: true },
          },
        },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      res.json({ task });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch task";
      console.error(
        "GET /api/projects/:projectId/tasks/:id error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * PATCH /api/projects/:projectId/tasks/:id — Update a task.
 * Any project member can update task fields.
 */
router.patch(
  "/projects/:projectId/tasks/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      const parsed = updateTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to update tasks" });
        return;
      }

      // Build update data, converting date strings
      const updateData: Record<string, unknown> = {};
      if (parsed.data.title !== undefined) updateData.title = parsed.data.title;
      if (parsed.data.description !== undefined)
        updateData.description = parsed.data.description;
      if (parsed.data.status !== undefined) updateData.status = parsed.data.status;
      if (parsed.data.priority !== undefined)
        updateData.priority = parsed.data.priority;
      if (parsed.data.dueDate !== undefined)
        updateData.dueDate = parsed.data.dueDate
          ? new Date(parsed.data.dueDate)
          : null;
      if (parsed.data.assignedTo !== undefined)
        updateData.assignedTo = parsed.data.assignedTo;
      if (parsed.data.parentId !== undefined)
        updateData.parentId = parsed.data.parentId;

      // Set assignedBy whenever assignedTo changes
      if (parsed.data.assignedTo !== undefined) {
        updateData.assignedBy = userId;
      }

      const task = await prisma.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
          assignee: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          assigner: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          creator: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { children: true, comments: true, assets: true },
          },
        },
      });

      res.json({ task });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update task";
      console.error(
        "PATCH /api/projects/:projectId/tasks/:id error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * DELETE /api/projects/:projectId/tasks/:id — Delete a task.
 * Any project member can delete. Cascade deletes children, comments, assets.
 */
router.delete(
  "/projects/:projectId/tasks/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to delete tasks" });
        return;
      }

      // Verify task exists in this project
      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
      });
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      await prisma.task.delete({ where: { id: taskId } });

      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete task";
      console.error(
        "DELETE /api/projects/:projectId/tasks/:id error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * PATCH /api/projects/:projectId/tasks/:id/reorder — Update task position and optionally status.
 * Used for drag-and-drop in board/list views.
 */
router.patch(
  "/projects/:projectId/tasks/:id/reorder",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      const parsed = reorderTaskSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to reorder tasks" });
        return;
      }

      const updateData: Record<string, unknown> = {
        position: parsed.data.position,
      };
      if (parsed.data.status !== undefined) {
        updateData.status = parsed.data.status;
      }

      const task = await prisma.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
          assignee: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
          _count: {
            select: { children: true, comments: true, assets: true },
          },
        },
      });

      res.json({ task });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reorder task";
      console.error(
        "PATCH /api/projects/:projectId/tasks/:id/reorder error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Comments
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/projects/:projectId/tasks/:id/comments — List comments for a task.
 * User must be a project member.
 */
router.get(
  "/projects/:projectId/tasks/:id/comments",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to view comments" });
        return;
      }

      const comments = await prisma.taskComment.findMany({
        where: { taskId },
        include: {
          author: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      });

      res.json({ comments });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch comments";
      console.error(
        "GET /api/projects/:projectId/tasks/:id/comments error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/projects/:projectId/tasks/:id/comments — Add a comment to a task.
 * Any project member can comment.
 */
router.post(
  "/projects/:projectId/tasks/:id/comments",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      const parsed = createCommentSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to add comments" });
        return;
      }

      // Verify task exists in project
      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
      });
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      const comment = await prisma.taskComment.create({
        data: {
          content: parsed.data.content,
          taskId,
          authorId: userId,
        },
        include: {
          author: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });

      res.status(201).json({ comment });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add comment";
      console.error(
        "POST /api/projects/:projectId/tasks/:id/comments error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * DELETE /api/projects/:projectId/tasks/:id/comments/:commentId — Delete a comment.
 * Only the comment author, project Owner, workspace Admin/Owner, or system Admin can delete.
 */
router.delete(
  "/projects/:projectId/tasks/:id/comments/:commentId",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const commentId = param(req, "commentId");
      const userId = req.userId!;

      // Find the comment
      const comment = await prisma.taskComment.findUnique({
        where: { id: commentId },
      });

      if (!comment) {
        res.status(404).json({ error: "Comment not found" });
        return;
      }

      // Authorization: author, project owner, workspace admin, or system admin
      const isAuthor = comment.authorId === userId;

      const workspaceId = await getProjectWorkspaceId(projectId);
      const canManage = workspaceId
        ? await canManageProject(projectId, workspaceId, userId)
        : false;

      if (!isAuthor && !canManage) {
        res
          .status(403)
          .json({
            error:
              "Only the comment author, project owner, workspace admin, or system admin can delete comments",
          });
        return;
      }

      await prisma.taskComment.delete({ where: { id: commentId } });

      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete comment";
      console.error(
        "DELETE /api/projects/:projectId/tasks/:id/comments/:commentId error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Assets
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/projects/:projectId/tasks/:id/assets — List assets for a task.
 * User must be a project member.
 */
router.get(
  "/projects/:projectId/tasks/:id/assets",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to view assets" });
        return;
      }

      const assets = await prisma.taskAsset.findMany({
        where: { taskId },
        orderBy: { createdAt: "desc" },
      });

      res.json({ assets });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch assets";
      console.error(
        "GET /api/projects/:projectId/tasks/:id/assets error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/projects/:projectId/tasks/:id/assets/upload — Upload a file as a task asset.
 * Uses multer middleware for multipart form-data.
 * Any project member can upload.
 */
router.post(
  "/projects/:projectId/tasks/:id/assets/upload",
  upload.single("file"),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to upload files" });
        return;
      }

      // Verify task exists
      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
      });
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const asset = await prisma.taskAsset.create({
        data: {
          type: "file",
          url: `/uploads/${req.file.filename}`,
          name: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          taskId,
        },
      });

      res.status(201).json({ asset });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to upload file";
      console.error(
        "POST /api/projects/:projectId/tasks/:id/assets/upload error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/projects/:projectId/tasks/:id/assets/link — Attach a link to a task.
 * Any project member can add links.
 */
router.post(
  "/projects/:projectId/tasks/:id/assets/link",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const taskId = param(req, "id");
      const userId = req.userId!;

      const parsed = createAssetLinkSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to add links" });
        return;
      }

      // Verify task exists
      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId },
      });
      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      const asset = await prisma.taskAsset.create({
        data: {
          type: "link",
          url: parsed.data.url,
          name: parsed.data.name,
          taskId,
        },
      });

      res.status(201).json({ asset });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add link";
      console.error(
        "POST /api/projects/:projectId/tasks/:id/assets/link error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * DELETE /api/projects/:projectId/tasks/:id/assets/:assetId — Remove an asset.
 * Any project member can remove assets.
 */
router.delete(
  "/projects/:projectId/tasks/:id/assets/:assetId",
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = param(req, "projectId");
      const assetId = param(req, "assetId");
      const userId = req.userId!;

      // Verify project membership
      const membership = await getProjectMembership(projectId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a project member to remove assets" });
        return;
      }

      const asset = await prisma.taskAsset.findUnique({
        where: { id: assetId },
      });

      if (!asset) {
        res.status(404).json({ error: "Asset not found" });
        return;
      }

      // Delete the file from disk if it's a file type
      if (asset.type === "file") {
        const fs = await import("fs/promises");
        const path = await import("path");
        const filePath = path.join(
          __dirname,
          "..",
          "..",
          "uploads",
          path.basename(asset.url)
        );
        try {
          await fs.unlink(filePath);
        } catch {
          // File may already be deleted; ignore
        }
      }

      await prisma.taskAsset.delete({ where: { id: assetId } });

      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove asset";
      console.error(
        "DELETE /api/projects/:projectId/tasks/:id/assets/:assetId error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

export default router;
