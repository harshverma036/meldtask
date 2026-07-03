import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "@repo/db";
import { verifyGoogleToken } from "../lib/google";
import { generateToken } from "../lib/jwt";
import { googleAuthSchema, emailAuthSchema } from "../lib/validators";

const router = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Allowed email domains and whitelisted emails */
const ALLOWED_DOMAINS = ["youngun.in", "meldit.ai"];
const WHITELISTED_EMAILS = ["harshverma0362@gmail.com"];

/**
 * Check if an email is authorized to access the platform.
 * Returns an error message string if NOT authorized, or null if authorized.
 */
function checkEmailAuthorized(email: string): string | null {
  // Whitelist check (exact match)
  if (WHITELISTED_EMAILS.includes(email.toLowerCase())) {
    return null; // authorized
  }

  // Domain check
  const domain = email.split("@")[1]?.toLowerCase();
  if (domain && ALLOWED_DOMAINS.includes(domain)) {
    return null; // authorized
  }

  return `This email domain is not authorized. Allowed domains: ${ALLOWED_DOMAINS.join(", ")}`;
}

/** Extract domain from email */
function extractDomain(email: string): string {
  return email.split("@")[1]?.toLowerCase() || "";
}

/**
 * Determine the initial role and status for a new user based on email.
 * Whitelisted users get Admin + Active. Others get Developer + Pending.
 */
function getInitialRoleAndStatus(email: string): {
  role: "Admin" | "Developer";
  status: "Active" | "Pending";
} {
  if (WHITELISTED_EMAILS.includes(email.toLowerCase())) {
    return { role: "Admin", status: "Active" };
  }
  return { role: "Developer", status: "Pending" };
}

// ── POST /api/auth/google ──────────────────────────────────────────────────────

router.post("/google", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsed = googleAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const { idToken } = parsed.data;

    // Verify the Google ID token and extract user info
    const googleUser = await verifyGoogleToken(idToken);

    // Check if this email is authorized
    const authError = checkEmailAuthorized(googleUser.email);
    if (authError) {
      res.status(403).json({ error: authError });
      return;
    }

    const domain = extractDomain(googleUser.email);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { googleId: googleUser.googleId },
          { email: googleUser.email },
        ],
      },
    });

    if (existingUser) {
      // Existing user — check status
      if (existingUser.status === "Pending") {
        res.status(403).json({ error: "Your account is pending admin approval. You'll be notified when approved." });
        return;
      }
      if (existingUser.status === "Rejected") {
        res.status(403).json({ error: "Your account has been rejected. Contact an administrator." });
        return;
      }

      // Active user — update profile info and log in
      const user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          name: googleUser.name ?? existingUser.name,
          avatarUrl: googleUser.avatarUrl ?? existingUser.avatarUrl,
          googleId: googleUser.googleId,
          domain: existingUser.domain || domain,
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
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        },
      });
      return;
    }

    // New user — determine role/status based on email
    const { role, status } = getInitialRoleAndStatus(googleUser.email);

    const user = await prisma.user.create({
      data: {
        email: googleUser.email,
        name: googleUser.name,
        avatarUrl: googleUser.avatarUrl,
        googleId: googleUser.googleId,
        domain,
        role,
        status,
      },
    });

    // Whitelisted users get immediate access
    if (status === "Active") {
      const token = generateToken({ userId: user.id });
      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          role: user.role,
          status: user.status,
          createdAt: user.createdAt,
        },
      });
      return;
    }

    // Non-whitelisted users go into pending
    res.status(403).json({
      error: "Your account has been created and is pending admin approval. You'll be notified when approved.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    console.error("Google auth error:", message);
    res.status(401).json({ error: "Authentication failed" });
  }
});

// ── POST /api/auth/email ───────────────────────────────────────────────────────

router.post("/email", async (req: Request, res: Response) => {
  try {
    // Validate request body
    const parsed = emailAuthSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid request" });
      return;
    }

    const { email, password, name } = parsed.data;

    // Check if this email is authorized
    const authError = checkEmailAuthorized(email);
    if (authError) {
      res.status(403).json({ error: authError });
      return;
    }

    const domain = extractDomain(email);

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // Login flow
      if (!existingUser.password) {
        res.status(400).json({ error: "This account uses Google Sign-In. Please sign in with Google." });
        return;
      }

      // Check status
      if (existingUser.status === "Pending") {
        res.status(403).json({ error: "Your account is pending admin approval. You'll be notified when approved." });
        return;
      }
      if (existingUser.status === "Rejected") {
        res.status(403).json({ error: "Your account has been rejected. Contact an administrator." });
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
          role: existingUser.role,
          status: existingUser.status,
          createdAt: existingUser.createdAt,
        },
      });
      return;
    }

    // Register flow — new user
    const { role, status } = getInitialRoleAndStatus(email);
    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: name || null,
        domain,
        role,
        status,
      },
    });

    // Whitelisted users get immediate access
    if (status === "Active") {
      const token = generateToken({ userId: newUser.id });
      res.status(201).json({
        token,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          avatarUrl: newUser.avatarUrl,
          role: newUser.role,
          status: newUser.status,
          createdAt: newUser.createdAt,
        },
      });
      return;
    }

    res.status(403).json({
      error: "Your account has been created and is pending admin approval.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Authentication failed";
    console.error("Email auth error:", message);
    res.status(500).json({ error: "Authentication failed" });
  }
});

export default router;
