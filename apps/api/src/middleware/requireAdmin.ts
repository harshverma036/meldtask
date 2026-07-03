import { Response, NextFunction } from "express";
import { prisma } from "@repo/db";
import { AuthRequest } from "./auth";

/**
 * Middleware that must run AFTER authenticate.
 * Checks that the authenticated user has the Admin role.
 * Returns 403 if not an admin.
 */
export async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { role: true, status: true },
    });

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    if (user.status !== "Active") {
      res.status(403).json({ error: "Account is not active" });
      return;
    }

    if (user.role !== "Admin") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    next();
  } catch (error) {
    console.error("requireAdmin error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
