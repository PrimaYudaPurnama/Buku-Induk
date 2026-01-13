import Notification from "../models/notification.js";
import User from "../models/user.js";
import Approval from "../models/approval.js";
import Role from "../models/role.js";
import { Resend } from "resend";

/**
 * Send in-app notification to a user
 * @param {string} userId - User ID
 * @param {string} type - Notification type
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {object} metadata - Optional metadata (action_url, etc.)
 * @returns {Promise<object>} Created notification
 */
export const notifyUser = async (userId, type, title, message, metadata = {}) => {
  console.log("[DEBUG notifyUser] userId:", userId);

  if (!userId) {
    throw new Error("notifyUser called with invalid userId");
  }

  const notification = await Notification.create({
    user_id: userId,
    type,
    title,
    message,
    action_url: metadata.action_url || null,
    is_read: false,
  });

  return notification;
};

/**
 * Notify approvers at a specific level
 * @param {number} level - Approval level
 * @param {string} title - Notification title
 * @param {string} message - Notification message
 * @param {string} link - Action URL
 * @param {string} requestType - Request type
 * @param {string} requestId - Request ID
 * @returns {Promise<Array>} Array of created notifications
 */
export const notifyApprovers = async (level, title, message, link, requestType, requestId) => {
  // Find approvals at this level for this request
  const approvals = await Approval.find({
    request_type: requestType,
    request_id: requestId,
    approval_level: level,
    status: "pending",
  }).populate("approver_id");

  const notifications = [];
  for (const approval of approvals) {
    if (approval.approver_id) {
      const notification = await notifyUser(
        approval.approver_id._id,
        "approval_pending",
        title,
        message,
        { action_url: link }
      );
      notifications.push(notification);
    }
  }

  return notifications;
};

/**
 * Send email notification using Resend
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} message - Email message (HTML or plain text)
 * @param {object} options - Optional email options (html, attachments, etc.)
 * @returns {Promise<object>} Email send result
 */
export const notifyEmail = async (email, subject, message, options = {}) => {
  const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;


  // If no Resend client (API key not configured), just log
  if (!resend) {
    console.log("Email notification (not sent - Resend API key not configured):", {
      to: email,
      subject,
      message,
      options,
    });

    return {
      success: true,
      message: "Email logged (Resend API key not configured)",
    };
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";
    
    const emailData = {
      from: fromEmail,
      to: [email],
      subject,
    };

    // Set html or text based on options
    if (options.html) {
      emailData.html = options.html;
      // Also include text version if provided
      if (message && message !== options.html) {
        emailData.text = message;
      }
    } else {
      emailData.text = message;
    }

    // Add attachments if provided
    if (options.attachments) {
      emailData.attachments = options.attachments;
    }

    const { data, error } = await resend.emails.send(emailData);

    if (error) {
      console.error("Resend API error:", error);
      throw new Error(`Failed to send email: ${error.message}`);
    }

    console.log("Email sent successfully:", {
      to: email,
      subject,
      messageId: data?.id,
    });

    return {
      success: true,
      message: "Email sent successfully",
      messageId: data?.id,
    };
  } catch (error) {
    console.error("Email send error:", error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

/**
 * Event handlers for approval workflow
 */

/**
 * Handle account request submitted
 */
export const handleAccountRequestSubmitted = async (request, requester) => {
  // Notify approvers
  // const approvals = await Approval.find({
  //   request_type: "account_request",
  //   request_id: request._id,
  //   approval_level: 1,
  // }).populate("approver_id");

  // for (const approval of approvals) {
  //   if (approval.approver_id) {
  //     await notifyUser(
  //       approval.approver_id._id,
  //       "approval_pending",
  //       "New Account Request",
  //       `A new account request has been submitted by ${request.requester_name}`,
  //       { action_url: `/approvals/${request._id}` }
  //     );
  //   }
  // }

  // Send email to requester
  if (requester?.email) {
    await notifyEmail(
      requester.email,
      "Account Request Submitted",
      `Your account request has been submitted and is pending approval.`
    );
  }
};

/**
 * Handle account request approved - send email with setup link
 * This is called when account request is approved but user hasn't completed setup yet
 */
export const handleAccountRequestApproved = async (request, setupToken, frontendUrl = null) => {
  const baseUrl = frontendUrl || process.env.FRONTEND_URL || "http://localhost:5173";
  const setupLink = `${baseUrl}/account-setup?token=${setupToken}`;

  const emailSubject = "Selamat! Permintaan Akun Anda Telah Disetujui";
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Selamat! Permintaan Akun Disetujui</h1>
        </div>
        <div class="content">
          <p>Halo <strong>${request.requester_name}</strong>,</p>
          <p>Kami dengan senang hati memberitahu bahwa permintaan akun Anda telah <strong>disetujui</strong>!</p>
          <p>Untuk menyelesaikan proses pendaftaran, silakan lengkapi informasi akun Anda dengan mengklik tombol di bawah ini:</p>
          <p style="text-align: center;">
            <a href="${setupLink}" class="button">Lengkapi Informasi Akun</a>
          </p>
          <div class="warning">
            <strong>Penting:</strong> Link ini akan kedaluwarsa dalam 7 hari. Silakan lengkapi informasi akun Anda segera.
          </div>
          <p>Jika tombol di atas tidak berfungsi, salin dan tempel link berikut ke browser Anda:</p>
          <p style="word-break: break-all; color: #4CAF50;">${setupLink}</p>
          <p>Terima kasih,<br>Tim HR</p>
        </div>
        <div class="footer">
          <p>Email ini dikirim secara otomatis. Mohon jangan membalas email ini.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const emailText = `
Selamat! Permintaan Akun Anda Telah Disetujui

Halo ${request.requester_name},

Kami dengan senang hati memberitahu bahwa permintaan akun Anda telah disetujui!

Untuk menyelesaikan proses pendaftaran, silakan lengkapi informasi akun Anda dengan mengakses link berikut:
${setupLink}

Penting: Link ini akan kedaluwarsa dalam 7 hari. Silakan lengkapi informasi akun Anda segera.

Terima kasih,
Tim HR
  `;

  if (request.email) {
    await notifyEmail(
      request.email,
      emailSubject,
      emailText,
      { html: emailHtml }
    );
  }
};

/**
 * Handle account request approved - user has completed setup
 * This is called after user completes the setup form
 */
export const handleAccountSetupCompleted = async (user, temporaryPassword = null) => {
  if (user) {
    let message = `Akun Anda telah berhasil dibuat. Anda sekarang dapat masuk ke sistem.`;
    let emailMessage = `Akun Anda telah berhasil dibuat. Anda sekarang dapat masuk ke sistem.`;

    if (temporaryPassword) {
      message += `\n\nPassword sementara Anda adalah: ${temporaryPassword}\nSilakan ubah password setelah login pertama kali.`;
      emailMessage += `\n\nPassword sementara Anda adalah: ${temporaryPassword}\nSilakan ubah password setelah login pertama kali untuk keamanan.`;
    }

    await notifyUser(
      user._id,
      "account_approved",
      "Akun Berhasil Dibuat",
      message,
      { action_url: "/login" }
    );

    if (user.email) {
      const emailSubject = temporaryPassword 
        ? "Akun Anda Telah Berhasil Dibuat - Informasi Login"
        : "Akun Anda Telah Berhasil Dibuat";
      
      await notifyEmail(
        user.email,
        emailSubject,
        emailMessage
      );
    }
  }
};

/**
 * Handle account request rejected
 */
export const handleAccountRequestRejected = async (request, user, reason = "") => {
  if (user) {
    await notifyUser(
      user._id,
      "account_rejected",
      "Account Request Rejected",
      `Your account request has been rejected.${reason ? ` Reason: ${reason}` : ""}`,
      { action_url: "/account-request" }
    );

    if (user.email) {
      await notifyEmail(
        user.email,
        "Account Request Rejected",
        `Your account request has been rejected.${reason ? ` Reason: ${reason}` : ""}`
      );
    }
  }
};

/**
 * Handle promotion event
 */
export const handlePromotion = async (user, oldRole, newRole) => {
  if (user) {
    await notifyUser(
      user._id,
      "promotion",
      "Promotion Approved",
      `Congratulations! You have been promoted to ${newRole?.name || "new role"}.`,
      { action_url: `/profile/${user._id}` }
    );

    if (user.email) {
      await notifyEmail(
        user.email,
        "Promotion Approved",
        `Congratulations! You have been promoted to ${newRole?.name || "new role"}.`
      );
    }
  }
};

/**
 * Handle demotion event
 */
export const handleDemotion = async (user, oldRole, newRole) => {
  if (user) {
    await notifyUser(
      user._id,
      "promotion", // Using promotion type for now, can add demotion type later
      "Role Change",
      `Your role has been changed to ${newRole?.name || "new role"}.`,
      { action_url: `/profile/${user._id}` }
    );

    if (user.email) {
      await notifyEmail(
        user.email,
        "Role Change",
        `Your role has been changed to ${newRole?.name || "new role"}.`
      );
    }
  }
};

/**
 * Handle transfer event
 */
export const handleTransfer = async (user, oldDivision, newDivision) => {
  if (user) {
    await notifyUser(
      user._id,
      "transfer",
      "Division Transfer Approved",
      `You have been transferred to ${newDivision?.name || "new division"}.`,
      { action_url: `/profile/${user._id}` }
    );

    if (user.email) {
      await notifyEmail(
        user.email,
        "Division Transfer Approved",
        `You have been transferred to ${newDivision?.name || "new division"}.`
      );
    }
  }
};

/**
 * Handle termination notice
 */
export const handleTerminationNotice = async (user, terminationDate, reason = "") => {
  if (user) {
    await notifyUser(
      user._id,
      "termination",
      "Termination Notice",
      `Your employment has been terminated.${reason ? ` Reason: ${reason}` : ""}`,
      { action_url: `/profile/${user._id}` }
    );

    if (user.email) {
      await notifyEmail(
        user.email,
        "Termination Notice",
        `Your employment has been terminated effective ${terminationDate}.${reason ? ` Reason: ${reason}` : ""}`
      );
    }
  }
};

/**
 * Handle document uploaded
 */
export const handleDocumentUploaded = async (user, documentType) => {
  if (user) {
    await notifyUser(
      user._id,
      "document_uploaded",
      "Document Uploaded",
      `A new ${documentType} document has been uploaded to your profile.`,
      { action_url: `/profile/${user._id}/documents` }
    );

    if (user.email) {
      await notifyEmail(
        user.email,
        "Document Uploaded",
        `A new ${documentType} document has been uploaded to your profile.`
      );
    }
  }
};

/**
 * Handle performance review due
 */
export const handlePerformanceReviewDue = async (user, reviewDate) => {
  if (user) {
    await notifyUser(
      user._id,
      "action_required",
      "Performance Review Due",
      `Your performance review is due on ${reviewDate}.`,
      { action_url: `/performance-review` }
    );

    if (user.email) {
      await notifyEmail(
        user.email,
        "Performance Review Due",
        `Your performance review is due on ${reviewDate}. Please complete it before the deadline.`
      );
    }
  }
};

/**
 * Handle approval step approved
 */
export const handleApprovalStepApproved = async (approval, request, nextLevel) => {
  // Notify next level approvers
  if (nextLevel) {
    const nextApprovals = await Approval.find({
      request_type: approval.request_type,
      request_id: approval.request_id,
      approval_level: nextLevel,
      status: "pending",
    }).populate("approver_id");

    for (const nextApproval of nextApprovals) {
      if (nextApproval.approver_id) {
        await notifyUser(
          nextApproval.approver_id._id,
          "approval_pending",
          "Approval Required",
          `A ${approval.request_type} request requires your approval.`,
          { action_url: `/approvals/${nextApproval.request_id}` }
        );
      }
    }
  }
};

/**
 * Handle approval step rejected
 */
export const handleApprovalStepRejected = async (approval, request, requester) => {

  // Notify requester
  if (requester) {
    await notifyUser(
      requester._id,
      "account_rejected",
      "Request Rejected",
      `Your ${approval.request_type} request has been rejected.`,
      { action_url: `/requests/${approval.request_id}` }
    );

    if (requester.email) {
      await notifyEmail(
        requester.email,
        "Request Rejected",
        `Your ${approval.request_type} request has been rejected.`
      );
    }
  }
};

/**
 * Get notifications for a user
 * @param {string} userId - User ID
 * @param {object} options - Options (limit, offset, unreadOnly)
 * @returns {Promise<object>} Notifications and pagination info
 */
export const getUserNotifications = async (userId, options = {}) => {
  const { limit = 20, offset = 0, unreadOnly = false } = options;

  const query = { user_id: userId };
  if (unreadOnly) {
    query.is_read = false;
  }

  const notifications = await Notification.find(query)
    .sort({ created_at: -1 })
    .limit(limit)
    .skip(offset);

  const total = await Notification.countDocuments(query);
  const unreadCount = await Notification.countDocuments({
    user_id: userId,
    is_read: false,
  });

  return {
    notifications,
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
    unreadCount,
  };
};

/**
 * Mark notification as read
 * @param {string} notificationId - Notification ID
 * @param {string} userId - User ID (for security)
 * @returns {Promise<object>} Updated notification
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  const notification = await Notification.findOne({
    _id: notificationId,
    user_id: userId,
  });

  if (!notification) {
    throw new Error("Notification not found");
  }

  notification.is_read = true;
  notification.read_at = new Date();
  await notification.save();

  return notification;
};

/**
 * Mark all notifications as read for a user
 * @param {string} userId - User ID
 * @returns {Promise<object>} Update result
 */
export const markAllNotificationsAsRead = async (userId) => {
  const result = await Notification.updateMany(
    { user_id: userId, is_read: false },
    { is_read: true, read_at: new Date() }
  );

  return result;
};

