import { Hono } from "hono";
import NotificationController from "../controllers/notification.js";
import { authenticate, authorize } from "../middleware/auth.js";

const notificationRouter = new Hono();

// GET /api/v1/notifications
notificationRouter.get(
  "/",
  authenticate(),
  (c) => NotificationController.getNotifications(c)
);

// POST /api/v1/notifications/mark-read
notificationRouter.post(
  "/mark-read",
  authenticate(),
  (c) => NotificationController.markRead(c)
);

// POST /api/v1/notifications/send (admin only - Superadmin, Admin)
notificationRouter.post(
  "/send",
  authenticate(),
  authorize({
    permissions: ["user:create", "user:update"], // Only Superadmin and Admin have these
  }),
  (c) => NotificationController.sendInAppNotification(c)
);

// POST /api/v1/notifications/send-email (admin only - Superadmin, Admin)
notificationRouter.post(
  "/send-email",
  authenticate(),
  authorize({
    permissions: ["user:create", "user:update"], // Only Superadmin and Admin have these
  }),
  (c) => NotificationController.sendEmailNotification(c)
);

export default notificationRouter;

