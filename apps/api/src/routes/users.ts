import { Router, Response } from "express";
import { prisma } from "@repo/db";
import { authenticate, AuthRequest } from "../middleware/auth";
import { requireAdmin } from "../middleware/requireAdmin";
import { updateRoleSchema, inviteUserSchema } from "../lib/validators";

/** Allowed email domains and whitelisted emails (mirrors auth.ts) */
const ALLOWED_DOMAINS = ["youngun.in", "meldit.ai"];
const WHITELISTED_EMAILS = ["harshverma0362@gmail.com"];

const router = Router();

// All routes require authentication + admin role
router.use(authenticate, requireAdmin);

// Helper: extract a typed route param
function param(req: AuthRequest, key: string): string {
  return req.params[key] as string;
}

/** Check if an email is authorized to be invited */
function isEmailAuthorized(email: string): boolean {
  if (WHITELISTED_EMAILS.includes(email.toLowerCase())) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? ALLOWED_DOMAINS.includes(domain) : false;
}

/**
 * GET /api/users — List all users.
 * Query params:
 *   ?status=Pending|Active|Rejected  — filter by status
 */
router.get("/", async (req: AuthRequest, res: Response) => {
  try {
    const statusFilter = req.query.status as string | undefined;

    if (statusFilter && !["Pending", "Active", "Rejected"].includes(statusFilter)) {
      res.status(400).json({ error: "Invalid status filter" });
      return;
    }

    const users = await prisma.user.findMany({
      where: statusFilter
        ? { status: statusFilter as "Pending" | "Active" | "Rejected" }
        : undefined,
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        role: true,
        status: true,
        domain: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch users";
    console.error("GET /api/users error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/users/invite — Invite a new user by email (admin only).
 * Creates a pre-approved user account. When the invited user logs in
 * via Google, their googleId/name/avatar are filled in on login.
 */
router.post("/invite", async (req: AuthRequest, res: Response) => {
  try {
    const parsed = inviteUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const { email, role, teamId } = parsed.data;

    // Check domain authorization
    if (!isEmailAuthorized(email)) {
      res.status(400).json({ error: `Email domain not authorized. Allowed: ${ALLOWED_DOMAINS.join(", ")}` });
      return;
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }

    // If teamId provided, verify the team exists
    if (teamId) {
      const team = await prisma.team.findUnique({ where: { id: teamId } });
      if (!team) {
        res.status(404).json({ error: "Team not found" });
        return;
      }
    }

    const domain = email.split("@")[1]?.toLowerCase() || "";

    const user = await prisma.user.create({
      data: {
        email,
        role,
        domain,
        status: "Active", // pre-approved
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        domain: true,
        createdAt: true,
      },
    });

    // Optionally add to a team
    if (teamId) {
      await prisma.teamMember.create({
        data: { teamId, userId: user.id, role: "Member" },
      });
    }

    res.status(201).json({ user });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to invite user";
    console.error("POST /api/users/invite error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/users/:id/approve — Approve a pending user.
 */
router.patch("/:id/approve", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.status !== "Pending") {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: "Active" },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    res.json({ user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to approve user";
    console.error("PATCH /api/users/:id/approve error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/users/:id/reject — Reject a pending user.
 */
router.patch("/:id/reject", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (user.status !== "Pending") {
      res.status(400).json({ error: "User is not in pending status" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: "Rejected" },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    res.json({ user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to reject user";
    console.error("PATCH /api/users/:id/reject error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * DELETE /api/users/:id — Remove a user's access (admin only).
 * Deletes the user and their team memberships.
 */
router.delete("/:id", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Prevent self-deletion
    if (user.id === req.userId) {
      res.status(400).json({ error: "You cannot remove your own access" });
      return;
    }

    await prisma.user.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove user";
    console.error("DELETE /api/users/:id error:", message);
    res.status(500).json({ error: message });
  }
});

/**
 * PATCH /api/users/:id/role — Update a user's role.
 */
router.patch("/:id/role", async (req: AuthRequest, res: Response) => {
  try {
    const id = param(req, "id");

    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const { role } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role },
      select: { id: true, email: true, name: true, role: true, status: true },
    });

    res.json({ user: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update role";
    console.error("PATCH /api/users/:id/role error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
