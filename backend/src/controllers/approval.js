import Approval from "../models/approval.js";
import AccountRequest from "../models/accountRequest.js";
import User from "../models/user.js";
import Role from "../models/role.js";
import Division from "../models/division.js";
import argon2 from "argon2";
import crypto from "crypto";
import {
  approveStep,
  rejectStep,
  getPendingApprovalsForUser,
  checkIfAllApproved,
  finalizeRequest,
} from "../services/approvalService.js";
import {
  handleApprovalStepApproved,
  handleApprovalStepRejected,
  handleAccountRequestApproved,
  handleAccountRequestRejected,
  handleAccountSetupCompleted,
  handlePromotion,
  handleDemotion,
  handleTransfer,
  handleTerminationNotice,
} from "../services/notificationService.js";
import { autoCreateHistory } from "../services/employeeHistoryService.js";
import {
  mapEventToDocumentType,
  createDocumentForEvent,
} from "../services/documentService.js";
import { logAudit } from "../utils/auditLogger.js";
import accountRequest from "../models/accountRequest.js";

class ApprovalController {
  /**
   * GET /api/v1/approvals/mine
   * Get pending approvals for current user
   */
  static async getMyPendingApprovals(c) {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const approvals = await getPendingApprovalsForUser(user._id);

      // Populate additional data
      const populatedApprovals = await Promise.all(
        approvals.map(async (approval) => {
          await approval.populate([
            {
              path: "request_id",
              populate: [
                {
                  path: "requested_by",
                  select: "full_name email",
                },
                {
                  path: "requested_role",
                  select: "name description hierarchy_level",
                },
                {
                  path: "division_id",
                  select: "name",
                },
                {
                  path: "user_id",
                  select: "full_name email role_id division_id",
                  populate: [
                    { path: "role_id", select: "name hierarchy_level" },
                    { path: "division_id", select: "name" }
                  ]
                },
              ],
            },
            {
              path: "user_id",
              select: "full_name email role_id division_id",
              populate: [
                { path: "role_id", select: "name hierarchy_level" },
                { path: "division_id", select: "name" }
              ]
            },
            {
              path: "approver_id",
              select: "full_name email",
            },
          ]);
          

          // Get all approvals for this request to show timeline
          const allApprovals = await Approval.find({
            request_type: approval.request_type,
            request_id: approval.request_id._id,
          })
            .populate("approver_id", "full_name email")
            .sort({ approval_level: 1 });

          return {
            ...approval.toObject(),
            timeline: allApprovals,
          };
        })
      );

      return c.json({
        data: populatedApprovals,
      });
    } catch (error) {
      console.error("Get pending approvals error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * POST /api/v1/approvals/:id/approve
   * Approve an approval step
   */
  static async approveRequestStep(c) {
    try {
      const approvalId = c.req.param("id");
      const user = c.get("user");
      const body = await c.req.json();
      const { comments = "" } = body;

      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      // Approve the step
      const { approval, request } = await approveStep(
        approvalId,
        user,
        comments
      );

      await logAudit(
        c,
        "approve",
        "approval",
        approvalId,
        null,
        {
          request_type: request.request_type,
          request_id: request._id,
          comments,
        }
      );

      // Check if all approvals are done
      const allApproved = await checkIfAllApproved(request._id);
      
      if (allApproved) {
        const byRequest = await AccountRequest
          .findById(request._id)
          .populate("requested_by", "email full_name");

        const by = byRequest?.requested_by || null;

        // Finalize the request
        await finalizeRequest(request);

        // Handle different request types
        if (request.request_type === "account_request") {
          // Check if user already exists
          const existingUser = await User.findOne({ email: request.email });
          
          if (!existingUser) {
            // Generate unique setup token
            const setupToken = crypto.randomBytes(32).toString("hex");
            const tokenExpiresAt = new Date();
            tokenExpiresAt.setDate(tokenExpiresAt.getDate() + 7); // 7 days expiry

            // Save token to request
            request.setup_token = setupToken;
            request.setup_token_expires_at = tokenExpiresAt;
            request.approved_by = user._id;
            await request.save();

            // Send email with setup link
            await handleAccountRequestApproved(request, setupToken);
          } else {
            // User already exists, just activate and update
            const Document = (await import("../models/document.js")).default;
            
            existingUser.status = "active";
            existingUser.role_id = request.requested_role;
            existingUser.division_id = request.division_id;
            await existingUser.save();

            // Link documents from account_request to user
            await Document.updateMany(
              { account_request_id: request._id },
              { 
                $set: { user_id: existingUser._id },
                $unset: { account_request_id: "" }
              }
            );

            // Update request
            request.approved_by = user._id;
            await request.save();

            // Notify existing user that their account has been activated
            await handleAccountSetupCompleted(existingUser);
          }
        } else if (request.request_type === "promotion") {
          // Update user role
          const targetUser = await User.findById(request.user_id).populate("role_id");
          if (targetUser) {
            const oldRole = targetUser.role_id;
            targetUser.role_id = request.requested_role;
            await targetUser.save();

            const newRole = await Role.findById(request.requested_role);

            // Create history
            await autoCreateHistory(
              "promotion",
              { role_id: oldRole?._id },
              { role_id: newRole?._id },
              by,
              {
                user_id: targetUser._id,
                effective_date: new Date(),
                reason: request.notes || "Promotion approved",
              }
            );

            // Notify user
            await handlePromotion(targetUser, oldRole, newRole);
          }
        } else if (request.request_type === "transfer") {
          // Update user division
          const targetUser = await User.findById(request.user_id)
            .populate("division_id")
            .populate("role_id");
          if (targetUser) {
            const oldDivision = targetUser.division_id;
            targetUser.division_id = request.division_id;
            await targetUser.save();

            const newDivision = await Division.findById(request.division_id);

            // Create history
            await autoCreateHistory(
              "transfer",
              { division_id: oldDivision?._id },
              { division_id: newDivision?._id },
              by,
              {
                user_id: targetUser._id,
                effective_date: new Date(),
                reason: request.notes || "Transfer approved",
              }
            );

            // Notify user
            await handleTransfer(targetUser, oldDivision, newDivision);
          }
        } else if (request.request_type === "termination") {
          // Terminate user
          const targetUser = await User.findById(request.user_id).populate("role_id");
          if (targetUser) {
            const oldStatus = targetUser.status;
            targetUser.status = "terminated";
            targetUser.termination_date = new Date();
            await targetUser.save();

            // Create history
            await autoCreateHistory(
              "terminated",
              { status: oldStatus },
              { status: "terminated" },
              by,
              {
                user_id: targetUser._id,
                effective_date: new Date(),
                reason: request.notes || "Termination approved",
              }
            );

            // Notify user
            await handleTerminationNotice(
              targetUser,
              targetUser.termination_date,
              request.notes
            );
          }
        }

        // Update request status
        request.status = "approved";
        request.processed_at = new Date();
        await request.save();
      } else {
        // Notify next level approvers
        const nextLevel = approval.approval_level + 1;
        await handleApprovalStepApproved(approval, request, nextLevel);
      }

      return c.json({
        message: "Approval step approved successfully",
        data: approval,
      });
    } catch (error) {
      console.error("Approve request step error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * POST /api/v1/approvals/:id/reject
   * Reject an approval step
   */
  static async rejectRequestStep(c) {
    try {
      const approvalId = c.req.param("id");
      const user = c.get("user");
      const body = await c.req.json();
      const { comments = "" } = body;

      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      // Reject the step
      const { approval, request } = await rejectStep(approvalId, user, comments);

      await logAudit(
        c,
        "reject",
        "approval",
        approvalId,
        null,
        {
          request_type: request.request_type,
          request_id: request._id,
          comments,
        }
      );

      // Get requester
      let requester = null;
      if (request.request_type === "account_request") {
        requester = { email: request.email };
      } else if (request.user_id) {
        requester = await User.findById(request.user_id);
      }

      // Notify requester
      await handleApprovalStepRejected(approval, request, requester);

      // Handle account request rejection specifically
      if (request.request_type === "account_request") {
        await handleAccountRequestRejected(request, requester, comments);
      }

      return c.json({
        message: "Approval step rejected",
        data: approval,
      });
    } catch (error) {
      console.error("Reject request step error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }
}

export default ApprovalController;

