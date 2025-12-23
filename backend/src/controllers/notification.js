import {
  notifyUser,
  notifyEmail,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "../services/notificationService.js";

class NotificationController {
  /**
   * POST /api/v1/notifications/send
   * Send in-app notification
   */
  static async sendInAppNotification(c) {
    try {
      const body = await c.req.json();
      const { user_id, type, title, message, action_url } = body;

      if (!user_id || !type || !title || !message) {
        return c.json({ message: "Missing required fields" }, 400);
      }

      const notification = await notifyUser(user_id, type, title, message, {
        action_url,
      });

      return c.json({
        message: "Notification sent successfully",
        data: notification,
      });
    } catch (error) {
      console.error("Send in-app notification error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * POST /api/v1/notifications/send-email
   * Send email notification
   */
  static async sendEmailNotification(c) {
    try {
      const body = await c.req.json();
      const { email, subject, message } = body;

      if (!email || !subject || !message) {
        return c.json({ message: "Missing required fields" }, 400);
      }

      const result = await notifyEmail(email, subject, message);

      return c.json({
        message: "Email notification sent successfully",
        data: result,
      });
    } catch (error) {
      console.error("Send email notification error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/notifications
   * Get notifications for current user
   */
  static async getNotifications(c) {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const query = c.req.query();
      const { limit = 20, offset = 0, unread_only = false } = query;

      const result = await getUserNotifications(user._id, {
        limit: parseInt(limit),
        offset: parseInt(offset),
        unreadOnly: unread_only === "true",
      });

      return c.json({
        data: result.notifications,
        pagination: result.pagination,
        unreadCount: result.unreadCount,
      });
    } catch (error) {
      console.error("Get notifications error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * POST /api/v1/notifications/mark-read
   * Mark notification(s) as read
   */
  static async markRead(c) {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const body = await c.req.json();
      const { notification_id, mark_all = false } = body;

      if (mark_all) {
        const result = await markAllNotificationsAsRead(user._id);
        return c.json({
          message: "All notifications marked as read",
          data: result,
        });
      } else {
        if (!notification_id) {
          return c.json({ message: "notification_id is required" }, 400);
        }

        const notification = await markNotificationAsRead(
          notification_id,
          user._id
        );
        return c.json({
          message: "Notification marked as read",
          data: notification,
        });
      }
    } catch (error) {
      console.error("Mark notification as read error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }
}

export default NotificationController;

