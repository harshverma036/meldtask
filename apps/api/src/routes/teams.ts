import { Router, Response } from "express";
import { prisma } from "@repo/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { createTeamSchema, updateTeamSchema, addMemberSchema } from "../lib/validators";

const router = Router();

// All routes require authentication
router.use(authenticate);

// Helper: extract a typed route param
function param(req: AuthRequest, key: string): string {
  return req.params[key] as string;
}

/**
 * GET /api/teams — List all teams the authenticated user is a member of.
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const teams = await prisma.team.findMany({
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

    res.json({ teams });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch teams";
    console.error("GET /api/teams error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/teams — Create a new team. Creator becomes the Lead.
 */
router.post("/", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const { name, description, memberEmails } = parsed.data;
    const userId = req.userId!;

    // Look up users by email if memberEmails provided
    const membersToAdd: { userId: string; role: "Member" }[] = [];
    if (memberEmails && memberEmails.length > 0) {
      const users = await prisma.user.findMany({
        where: { email: { in: memberEmails }, status: "Active" },
        select: { id: true },
      });
      membersToAdd.push(...users.map((u) => ({ userId: u.id, role: "Member" as const })));
    }

    const team = await prisma.team.create({
      data: {
        name,
        description: description || null,
        createdBy: userId,
        members: {
          create: [
            { userId, role: "Lead" as const },
            ...membersToAdd,
          ],
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

    res.status(201).json({ team });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create team";
    console.error("POST /api/teams error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * GET /api/teams/:id — Get a single team with its members.
 */
router.get("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");

    const team = await prisma.team.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            id: true,
            role: true,
            joinedAt: true,
            user: {
              select: { id: true, email: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    res.json({ team });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch team";
    console.error("GET /api/teams/:id error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/teams/:id — Update team name or description.
 * Only the team Lead or an Admin can update.
 */
router.patch("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const userId = req.userId!;

    const parsed = updateTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!membership && user?.role !== "Admin") {
      res.status(403).json({ error: "Only team leads or admins can update the team" });
      return;
    }

    if (membership && membership.role !== "Lead" && user?.role !== "Admin") {
      res.status(403).json({ error: "Only team leads or admins can update the team" });
      return;
    }

    const team = await prisma.team.update({
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

    res.json({ team });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update team";
    console.error("PATCH /api/teams/:id error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/teams/:id — Delete a team.
 * Only the team Lead or an Admin can delete.
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");
    const userId = req.userId!;

    const membership = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId: id, userId } },
    });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!membership && user?.role !== "Admin") {
      res.status(403).json({ error: "Only team leads or admins can delete the team" });
      return;
    }

    if (membership && membership.role !== "Lead" && user?.role !== "Admin") {
      res.status(403).json({ error: "Only team leads or admins can delete the team" });
      return;
    }

    await prisma.team.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete team";
    console.error("DELETE /api/teams/:id error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/teams/:id/members — Add a member to a team by email.
 */
router.post("/:id/members", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = param(req, "id");

    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
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

    const existing = await prisma.teamMember.findUnique({
      where: { teamId_userId: { teamId, userId: userToAdd.id } },
    });

    if (existing) {
      res.status(400).json({ error: "User is already a member of this team" });
      return;
    }

    const member = await prisma.teamMember.create({
      data: {
        teamId,
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
    const message = error instanceof Error ? error.message : "Failed to add member";
    console.error("POST /api/teams/:id/members error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/teams/:id/members/:userId — Remove a member from a team.
 */
router.delete("/:id/members/:userId", async (req: AuthRequest, res: Response) => {
  try {
    const teamId = param(req, "id");
    const userId = param(req, "userId");

    await prisma.teamMember.delete({
      where: { teamId_userId: { teamId, userId } },
    });

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    console.error("DELETE /api/teams/:id/members/:userId error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
