import "express-async-errors";
import express from "express";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import workspacesRoutes from "./routes/workspaces.routes.js";
import eventsRoutes, { workspaceEventsRouter } from "./routes/events.routes.js";
import tasksRoutes, { workspaceTasksRouter } from "./routes/tasks.routes.js";
import taskStatusesRoutes from "./routes/taskStatuses.routes.js";
import messagesRoutes from "./routes/messages.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import dashboardRoutes from "./routes/dashboard.routes.js";
import assetsRoutes from "./routes/assets.routes.js";
import foldersRoutes from "./routes/folders.routes.js";
import conversationsRoutes from "./routes/conversations.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import { notFoundHandler, errorHandler } from "./middleware/error.js";

export function createApp() {
  const app = express();

  app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
  app.use(express.json());

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api/auth", authRoutes);
  app.use("/api/users", usersRoutes);
  app.use("/api/workspaces", workspacesRoutes);
  app.use("/api/workspaces/:workspaceId/events", workspaceEventsRouter);
  app.use("/api/workspaces/:workspaceId/tasks", workspaceTasksRouter);
  app.use("/api/workspaces/:workspaceId/task-statuses", taskStatusesRoutes);
  app.use("/api/workspaces/:workspaceId/assets", assetsRoutes);
  app.use("/api/workspaces/:workspaceId/folders", foldersRoutes);
  app.use("/api/workspaces/:workspaceId/conversations", conversationsRoutes);
  app.use("/api/workspaces/:workspaceId/documents", documentsRoutes);
  app.use("/api/events", eventsRoutes);
  app.use("/api/tasks", tasksRoutes);
  app.use("/api/messages", messagesRoutes);
  app.use("/api/notifications", notificationsRoutes);
  app.use("/api/dashboard", dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp();
