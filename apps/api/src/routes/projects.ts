import { Router, Response } from "express";
import { prisma } from "@repo/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  createProjectSchema,
  updateProjectSchema,
  addProjectMemberSchema,
} from "../lib/validators";

const router = Router();

// All routes require authentication
router.use(authenticate);

/** Helper: extract a typed route param */
function param(req: AuthRequest, key: string): string {
  return req.params[key] as string;
}

/**
 * Helper: check if a user is a member of a workspace.
 * Returns the membership record or null.
 */
async function getWorkspaceMembership(
  workspaceId: string,
  userId: string
) {
  return prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

/**
 * GET /api/workspaces/:workspaceId/projects — List all projects in a workspace.
 * User must be a workspace member.
 */
router.get(
  "/workspaces/:workspaceId/projects",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const userId = req.userId!;

      // Verify user is a workspace member
      const membership = await getWorkspaceMembership(workspaceId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a workspace member to view projects" });
        return;
      }

      const projects = await prisma.project.findMany({
        where: { workspaceId },
        include: {
          members: {
            select: {
              id: true,
              role: true,
              joinedAt: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      res.json({ projects });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch projects";
      console.error("GET /api/workspaces/:workspaceId/projects error:", message);
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/workspaces/:workspaceId/projects — Create a new project.
 * Any workspace member can create a project. Creator becomes the Owner.
 */
router.post(
  "/workspaces/:workspaceId/projects",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const userId = req.userId!;

      const parsed = createProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Verify user is a workspace member
      const membership = await getWorkspaceMembership(workspaceId, userId);
      if (!membership) {
        res
          .status(403)
          .json({
            error: "You must be a workspace member to create projects",
          });
        return;
      }

      const { name, description, statuses } = parsed.data;

      const project = await prisma.project.create({
        data: {
          name,
          description: description || null,
          statuses: statuses || [],
          workspaceId,
          createdBy: userId,
          members: {
            create: [{ userId, role: "Owner" }],
          },
        },
        include: {
          members: {
            select: {
              id: true,
              role: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      res.status(201).json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create project";
      console.error(
        "POST /api/workspaces/:workspaceId/projects error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /api/workspaces/:workspaceId/projects/:id — Get a single project with members.
 * User must be a workspace member.
 */
router.get(
  "/workspaces/:workspaceId/projects/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const projectId = param(req, "id");
      const userId = req.userId!;

      // Verify user is a workspace member
      const membership = await getWorkspaceMembership(workspaceId, userId);
      if (!membership) {
        res
          .status(403)
          .json({ error: "You must be a workspace member to view projects" });
        return;
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId, workspaceId },
        include: {
          members: {
            select: {
              id: true,
              role: true,
              joinedAt: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
        },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch project";
      console.error(
        "GET /api/workspaces/:workspaceId/projects/:id error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * PATCH /api/workspaces/:workspaceId/projects/:id — Update a project.
 * Only the project Owner, workspace Admin/Owner, or system Admin can update.
 */
router.patch(
  "/workspaces/:workspaceId/projects/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const projectId = param(req, "id");
      const userId = req.userId!;

      const parsed = updateProjectSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Check project ownership
      const projectMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });

      // Check workspace membership for elevated roles
      const workspaceMembership = await getWorkspaceMembership(
        workspaceId,
        userId
      );

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const isProjectOwner = projectMembership?.role === "Owner";
      const isWorkspaceAdmin =
        workspaceMembership?.role === "Owner" ||
        workspaceMembership?.role === "Admin";
      const isSystemAdmin = user?.role === "Admin";

      if (!isProjectOwner && !isWorkspaceAdmin && !isSystemAdmin) {
        res
          .status(403)
          .json({
            error:
              "Only the project owner, workspace admin, or system admin can update this project",
          });
        return;
      }

      const project = await prisma.project.update({
        where: { id: projectId },
        data: parsed.data,
        include: {
          members: {
            select: {
              id: true,
              role: true,
              user: {
                select: { id: true, email: true, name: true },
              },
            },
          },
        },
      });

      res.json({ project });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to update project";
      console.error(
        "PATCH /api/workspaces/:workspaceId/projects/:id error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * DELETE /api/workspaces/:workspaceId/projects/:id — Delete a project.
 * Only the project Owner, workspace Admin/Owner, or system Admin can delete.
 */
router.delete(
  "/workspaces/:workspaceId/projects/:id",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const projectId = param(req, "id");
      const userId = req.userId!;

      // Check project ownership
      const projectMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });

      const workspaceMembership = await getWorkspaceMembership(
        workspaceId,
        userId
      );

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const isProjectOwner = projectMembership?.role === "Owner";
      const isWorkspaceAdmin =
        workspaceMembership?.role === "Owner" ||
        workspaceMembership?.role === "Admin";
      const isSystemAdmin = user?.role === "Admin";

      if (!isProjectOwner && !isWorkspaceAdmin && !isSystemAdmin) {
        res
          .status(403)
          .json({
            error:
              "Only the project owner, workspace admin, or system admin can delete this project",
          });
        return;
      }

      await prisma.project.delete({ where: { id: projectId } });

      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete project";
      console.error(
        "DELETE /api/workspaces/:workspaceId/projects/:id error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * POST /api/workspaces/:workspaceId/projects/:id/members — Add a member to a project.
 * User must already be a workspace member.
 * Only project Owner, workspace Admin/Owner, or system Admin can add.
 */
router.post(
  "/workspaces/:workspaceId/projects/:id/members",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const projectId = param(req, "id");
      const userId = req.userId!;

      const parsed = addProjectMemberSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            error: parsed.error.issues[0]?.message || "Invalid request",
          });
        return;
      }

      // Check requester permission
      const projectMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId } },
      });

      const workspaceMembership = await getWorkspaceMembership(
        workspaceId,
        userId
      );

      const requesterUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      const canManage =
        projectMembership?.role === "Owner" ||
        workspaceMembership?.role === "Owner" ||
        workspaceMembership?.role === "Admin" ||
        requesterUser?.role === "Admin";

      if (!canManage) {
        res
          .status(403)
          .json({
            error:
              "Only project owner, workspace admin, or system admin can add members",
          });
        return;
      }

      const { email, role } = parsed.data;

      const userToAdd = await prisma.user.findUnique({
        where: { email },
        select: { id: true, status: true },
      });

      if (!userToAdd) {
        res.status(404).json({ error: "User with this email not found" });
        return;
      }

      if (userToAdd.status !== "Active") {
        res.status(400).json({ error: "User is not active" });
        return;
      }

      // Verify target user is a workspace member
      const targetWorkspaceMembership = await getWorkspaceMembership(
        workspaceId,
        userToAdd.id
      );
      if (!targetWorkspaceMembership) {
        res
          .status(400)
          .json({
            error: "User must be a workspace member before being added to a project",
          });
        return;
      }

      // Check if already a project member
      const existing = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: userToAdd.id },
        },
      });

      if (existing) {
        res
          .status(400)
          .json({ error: "User is already a member of this project" });
        return;
      }

      const member = await prisma.projectMember.create({
        data: {
          projectId,
          userId: userToAdd.id,
          role,
        },
        include: {
          user: {
            select: { id: true, email: true, name: true, avatarUrl: true },
          },
        },
      });

      res.status(201).json({ member });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to add project member";
      console.error(
        "POST /api/workspaces/:workspaceId/projects/:id/members error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * DELETE /api/workspaces/:workspaceId/projects/:id/members/:userId — Remove a member.
 * Only project Owner, workspace Admin/Owner, or system Admin can remove.
 */
router.delete(
  "/workspaces/:workspaceId/projects/:id/members/:userId",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "workspaceId");
      const projectId = param(req, "id");
      const targetUserId = param(req, "userId");
      const requesterId = req.userId!;

      // Check requester permission
      const projectMembership = await prisma.projectMember.findUnique({
        where: { projectId_userId: { projectId, userId: requesterId } },
      });

      const workspaceMembership = await getWorkspaceMembership(
        workspaceId,
        requesterId
      );

      const requesterUser = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { role: true },
      });

      const canManage =
        projectMembership?.role === "Owner" ||
        workspaceMembership?.role === "Owner" ||
        workspaceMembership?.role === "Admin" ||
        requesterUser?.role === "Admin";

      if (!canManage) {
        res
          .status(403)
          .json({
            error:
              "Only project owner, workspace admin, or system admin can remove members",
          });
        return;
      }

      const targetMembership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: { projectId, userId: targetUserId },
        },
      });

      if (!targetMembership) {
        res.status(404).json({ error: "Member not found" });
        return;
      }

      await prisma.projectMember.delete({
        where: {
          projectId_userId: { projectId, userId: targetUserId },
        },
      });

      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to remove project member";
      console.error(
        "DELETE /api/workspaces/:workspaceId/projects/:id/members/:userId error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

export default router;
