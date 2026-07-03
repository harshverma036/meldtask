import { Router, Response } from "express";
import { prisma } from "@repo/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import {
  createWorkspaceSchema,
  updateWorkspaceSchema,
  addWorkspaceMemberSchema,
} from "../lib/validators";

const router = Router();

// All routes require authentication
router.use(authenticate);

/** Helper: extract a typed route param */
function param(req: AuthRequest, key: string): string {
  return req.params[key] as string;
}

/**
 * GET /api/workspaces — List all workspaces the authenticated user is a member of.
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const workspaces = await prisma.workspace.findMany({
      where: {
        members: {
          some: { userId: req.userId },
        },
      },
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

    res.json({ workspaces });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch workspaces";
    console.error("GET /api/workspaces error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/workspaces — Create a new workspace. Creator becomes the Owner.
 * Only Admins can create workspaces.
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const userId = req.userId!;

    // Check if user is Admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user || user.role !== "Admin") {
      res
        .status(403)
        .json({ error: "Only admins can create workspaces" });
      return;
    }

    const { name, description } = parsed.data;

    const workspace = await prisma.workspace.create({
      data: {
        name,
        description: description || null,
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
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    res.status(201).json({ workspace });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create workspace";
    console.error("POST /api/workspaces error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/workspaces/:id — Get a single workspace with members and projects.
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");

    const workspace = await prisma.workspace.findUnique({
      where: { id },
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
        projects: {
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
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!workspace) {
      res.status(404).json({ error: "Workspace not found" });
      return;
    }

    res.json({ workspace });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch workspace";
    console.error("GET /api/workspaces/:id error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/workspaces/:id — Update workspace name or description.
 * Only the workspace Owner or a system Admin can update.
 */
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const userId = req.userId!;

    const parsed = updateWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    // Only workspace Owner or system Admin can update
    const isOwner = membership?.role === "Owner";
    const isAdmin = user?.role === "Admin";

    if (!isOwner && !isAdmin) {
      res
        .status(403)
        .json({ error: "Only workspace owners or admins can update the workspace" });
      return;
    }

    const workspace = await prisma.workspace.update({
      where: { id },
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

    res.json({ workspace });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update workspace";
    console.error("PATCH /api/workspaces/:id error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/workspaces/:id — Delete a workspace.
 * Only the workspace Owner or a system Admin can delete.
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const userId = req.userId!;

    const membership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const isOwner = membership?.role === "Owner";
    const isAdmin = user?.role === "Admin";

    if (!isOwner && !isAdmin) {
      res
        .status(403)
        .json({ error: "Only workspace owners or admins can delete the workspace" });
      return;
    }

    await prisma.workspace.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete workspace";
    console.error("DELETE /api/workspaces/:id error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/workspaces/:id/members — Add a member to a workspace by email.
 * Only workspace Owner or Admin can add members.
 */
router.post("/:id/members", async (req: AuthRequest, res: Response) => {
  try {
    const workspaceId = param(req, "id");
    const userId = req.userId!;

    const parsed = addWorkspaceMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    // Check if requester has permission (Owner or Admin of workspace)
    const requesterMembership = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    const requesterUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const canManage =
      requesterMembership?.role === "Owner" ||
      requesterMembership?.role === "Admin" ||
      requesterUser?.role === "Admin";

    if (!canManage) {
      res
        .status(403)
        .json({ error: "Only workspace owners or admins can add members" });
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

    const existing = await prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId: userToAdd.id },
      },
    });

    if (existing) {
      res
        .status(400)
        .json({ error: "User is already a member of this workspace" });
      return;
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId,
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
      error instanceof Error ? error.message : "Failed to add member";
    console.error("POST /api/workspaces/:id/members error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/workspaces/:id/members/:userId — Remove a member from a workspace.
 * Only workspace Owner or Admin can remove members. Cannot remove the Owner.
 */
router.delete(
  "/:id/members/:userId",
  async (req: AuthRequest, res: Response) => {
    try {
      const workspaceId = param(req, "id");
      const targetUserId = param(req, "userId");
      const requesterId = req.userId!;

      // Check if requester has permission
      const requesterMembership = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: requesterId } },
      });

      const requesterUser = await prisma.user.findUnique({
        where: { id: requesterId },
        select: { role: true },
      });

      const canManage =
        requesterMembership?.role === "Owner" ||
        requesterMembership?.role === "Admin" ||
        requesterUser?.role === "Admin";

      if (!canManage) {
        res
          .status(403)
          .json({ error: "Only workspace owners or admins can remove members" });
        return;
      }

      // Prevent removing the workspace Owner
      const targetMembership = await prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: { workspaceId, userId: targetUserId },
        },
      });

      if (!targetMembership) {
        res.status(404).json({ error: "Member not found" });
        return;
      }

      if (targetMembership.role === "Owner") {
        res
          .status(400)
          .json({ error: "Cannot remove the workspace owner" });
        return;
      }

      await prisma.workspaceMember.delete({
        where: {
          workspaceId_userId: { workspaceId, userId: targetUserId },
        },
      });

      res.json({ success: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to remove member";
      console.error(
        "DELETE /api/workspaces/:id/members/:userId error:",
        message
      );
      res.status(500).json({ error: message });
    }
  }
);

/**
 * GET /api/workspaces/:id/members — Get lightweight member list for a workspace.
 * Used by the frontend to show available users when adding project members.
 */
router.get("/:id/members", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { joinedAt: "asc" },
    });

    res.json({ members });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch members";
    console.error("GET /api/workspaces/:id/members error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
