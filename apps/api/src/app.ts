import express from "express";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import usersRoutes from "./routes/users";
import teamsRoutes from "./routes/teams";
import workspaceRoutes from "./routes/workspaces";
import projectRoutes from "./routes/projects";
import taskRoutes from "./routes/tasks";
import { errorHandler } from "./middleware/errorHandler";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:7650",
    credentials: true,
  })
);
app.use(express.json());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/me", meRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/teams", teamsRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api", projectRoutes);
app.use("/api", taskRoutes);

// Serve uploaded files statically
app.use("/uploads", express.static(join(__dirname, "..", "uploads")));

// Global error handler (must be last)
app.use(errorHandler);

export default app;
