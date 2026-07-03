import { Router, Response } from "express";
import { prisma } from "@repo/db";
import { authenticate, AuthRequest } from "../middleware/auth";

const router = Router();

/**
 * GET /api/me — Returns the authenticated user's profile.
 * Includes role, status, and created date.
 */
router.get("/", authenticate, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      name: true,
      avatarUrl: true,
      role: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

export default router;
