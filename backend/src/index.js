import { connectDB } from '@/lib/db'
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import argon2 from "argon2"

import userRouter from "./routes/user.js";
import authRouter from "./routes/auth.js"
import cloudinaryRouter from './routes/cloudinary.js';
import accountRequestRouter from './routes/accountRequest.js';
import approvalRouter from './routes/approval.js';
import documentRouter from './routes/document.js';
import notificationRouter from './routes/notification.js';
import auditLogRouter from './routes/auditLog.js';
import roleRouter from './routes/role.js';
import analyticsRouter from './routes/analytics.js';
import orgChartRouter from './routes/orgChart.js';
import publicRouter from './routes/public.js';
import attendanceRouter from "./routes/attendance.js";
import scheduleRouter from "./routes/schedule.js";

import Role from "./models/role.js";
import divisionRouter from './routes/division.js';
import activityRouter from './routes/activity.js';
import projectRouter from './routes/project.js';
import { startProjectCronJob } from './services/projectCronService.js';
import importRouter from './routes/importRoutes.js';

const app = new Hono();

try {
  await connectDB();
  console.log("DB ready");
} catch (err) {
  console.error("DB FAILED:", err);
  process.exit(1); // stop daripada zombie server
}

// Initialize cron jobs
try {
  startProjectCronJob();
} catch (err) {
  console.error("CRON INIT FAILED:", err);
}

// Middlewares
app.use("*", logger());
app.use(
  '/*',
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  allowMethods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
}));

app.route("/api/v1/files", cloudinaryRouter);
app.route("/api/v1/users", userRouter);
app.route("/api/v1/divisions", divisionRouter);
app.route("/api/v1/activities", activityRouter);
app.route("/api/v1/projects", projectRouter);
app.route("/api/v1/auth", authRouter);
app.route("/api/v1/account-requests", accountRequestRouter);
app.route("/api/v1/approvals", approvalRouter);
app.route("/api/v1/documents", documentRouter);
app.route("/api/v1/notifications", notificationRouter);
app.route("/api/v1/audit-logs", auditLogRouter);
app.route("/api/v1/roles", roleRouter);
app.route("/api/v1/analytics", analyticsRouter);
app.route("/api/v1/org-chart", orgChartRouter);
app.route("/api/v1/public", publicRouter);
app.route("/api/v1/attendance", attendanceRouter);
app.route("/api/v1/admin/schedule", scheduleRouter);
app.route("/api/v1/import", importRouter);


// app.post("/tes/masukin", async (c) => {
//   const body = await c.req.json();
//   const data = await Role.create(body);
//   return c.json(data, 201);
// })

app.post("/toargon2", async(c) => {
  const body = await c.req.json();
  const hash = await argon2.hash(body.password);

  return c.json({
    success: true,
    hash,
  });
})

// Health check
app.get("/health", (c) => {
  return c.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        message: "Route not found",
        code: "NOT_FOUND",
      },
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    },
    500
  );
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED:", err.stack);
});

export default app;
