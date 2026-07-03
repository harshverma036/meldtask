import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import meRoutes from "./routes/me";
import usersRoutes from "./routes/users";
import teamsRoutes from "./routes/teams";
import workspaceRoutes from "./routes/workspaces";
import projectRoutes from "./routes/projects";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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

// Global error handler (must be last)
app.use(errorHandler);

export default app;
