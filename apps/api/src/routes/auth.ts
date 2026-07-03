import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { verifyGoogleToken } from "../lib/google";
import { generateToken } from "../lib/jwt";

const router = Router();

// Google OAuth login
router.post("/google", async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken) {
      res.status(400).json({ error: "idToken is required" });
      return;
    }

    const googleUser = await verifyGoogleToken(idToken);

    const user = await prisma.user.upsert({
      where: { googleId: googleUser.googleId },
      update: {
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
      },
      create: {
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
        googleId: googleUser.googleId,
      },
    });

    const token = generateToken({ userId: user.id });

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    console.error("Google auth error:", message);
    res.status(401).json({ error: message });
  }
});

// Email + password login / register
router.post("/email", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // Login flow: verify password
      if (!existingUser.password) {
        res.status(400).json({ error: "This account uses Google Sign-In. Please sign in with Google." });
        return;
      }

      const isValid = await bcrypt.compare(password, existingUser.password);
      if (!isValid) {
        res.status(401).json({ error: "Invalid email or password" });
        return;
      }

      const token = generateToken({ userId: existingUser.id });

      res.json({
        token,
        user: {
          id: existingUser.id,
          email: existingUser.email,
          name: existingUser.name,
          avatarUrl: existingUser.avatarUrl,
        },
      });
      return;
    }

    // Register flow: create new user
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
      },
    });

    const token = generateToken({ userId: newUser.id });

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        avatarUrl: newUser.avatarUrl,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    console.error("Email auth error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
