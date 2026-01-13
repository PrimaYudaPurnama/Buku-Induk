import AccountRequest from "../models/accountRequest.js";
import User from "../models/user.js";
import Approval from "../models/approval.js";
import Role from "../models/role.js";
import Division from "../models/division.js";
import {
  createApprovalsForRequest,
  finalizeRequest,
} from "../services/approvalService.js";
import {
  handleAccountRequestSubmitted,
  handleAccountRequestApproved,
  handleAccountRequestRejected,
  handleAccountSetupCompleted,
  handlePromotion,
  handleTransfer,
  handleTerminationNotice,
} from "../services/notificationService.js";
import argon2 from "argon2";
import crypto from "crypto";
import { autoCreateHistory } from "../services/employeeHistoryService.js";
import { mapEventToDocumentType, createDocumentForEvent } from "../services/documentService.js";
import { canAccessResource } from "../middleware/auth.js";
import { generateApprovalSteps, isValidRequestType } from "../lib/approvalWorkflows.js";
import { getRoleHierarchyLevel } from "../lib/roleHierarchy.js";
import { logAudit } from "../utils/auditLogger.js";

class AccountRequestController {
  /**
   * POST /api/v1/account-requests
   * Create a new account request
   */
  static async createAccountRequest(c) {
    try {
      const body = await c.req.json();
      const {
        requester_name: raw_requester_name,
        email: raw_email,
        phone,
        requested_role: raw_requested_role,
        division_id: raw_division_id,
        request_type = "account_request",
        user_id, // For promotion/termination/transfer
        notes,
      } = body;

      // Resolve target user (for promotion/termination/transfer/transfer on existing user)
      let targetUser = null;
      if (user_id) {
        targetUser = await User.findById(user_id);
        if (!targetUser) {
          return c.json({ message: "Target user not found" }, 404);
        }
      }

      // Normalize core fields; for existing user we can fallback to target user's data
      const requester_name = raw_requester_name || targetUser?.full_name || "";
      const email = raw_email || targetUser?.email || "";
      const requested_role = raw_requested_role || targetUser?.role_id || null;
      const division_id = raw_division_id || targetUser?.division_id || null;

      // Validation (after normalization)
      if (!requester_name || !email || !requested_role) {
        return c.json({ message: "Missing required fields" }, 400);
      }

      // division_id is required for account_request and transfer, optional for promotion/termination
      if ((request_type === "account_request" || request_type === "transfer") && !division_id) {
        return c.json({ message: "division_id is required for account_request and transfer" }, 400);
      }

      // Validate request type against configured workflows
      if (!isValidRequestType(request_type)) {
        return c.json({ message: `Invalid request type: ${request_type}` }, 400);
      }

      // Resolve requested role document (needed for hierarchy check)
      const requestedRoleDoc = await Role.findById(requested_role);
      if (!requestedRoleDoc) {
        return c.json({ message: "Requested role not found" }, 400);
      }

      // Resolve requester role + hierarchy (default very low authority)
      const currentUser = c.get("user");


      let requesterRoleName = "";
      let requesterLevel = 999;
      if (currentUser?.role_id) {
        let roleDoc = currentUser.role_id;
        if (!roleDoc?.name) {
          roleDoc = await Role.findById(currentUser.role_id);
        }
        requesterRoleName = roleDoc?.name || "";
        requesterLevel = roleDoc?.hierarchy_level ?? getRoleHierarchyLevel(roleDoc?.name);
      }

      // Prevent lower-level requester from proposing a role above their authority
      const requestedLevel = requestedRoleDoc.hierarchy_level ?? getRoleHierarchyLevel(requestedRoleDoc.name);
      if (
        requesterRoleName &&
        requesterRoleName !== "Superadmin" &&
        requestedLevel < requesterLevel
      ) {
        return c.json(
          { message: "Anda tidak memiliki otoritas untuk mengajukan role setinggi itu" },
          403
        );
      }

      // If targeting an existing user, ensure requester outranks them
      if (targetUser) {
        await targetUser.populate("role_id");
        const targetLevel =
          targetUser.role_id?.hierarchy_level ??
          getRoleHierarchyLevel(targetUser.role_id?.name);

        if (
          requesterRoleName &&
          requesterRoleName !== "Superadmin" &&
          requesterLevel >= targetLevel
        ) {
          return c.json(
            { message: "Tidak bisa mengajukan perubahan untuk user dengan level sama atau lebih tinggi" },
            403
          );
        }

        // Prevent transfer for division manager (only members can be transferred)
        if (request_type === "transfer") {
          const managesDivision = await Division.exists({ manager_id: targetUser._id });
          if (managesDivision) {
            return c.json(
              { message: "Tidak bisa mengajukan transfer untuk manager divisi. Transfer hanya untuk anggota divisi." },
              400
            );
          }
        }
      }

      // Create account request
      const request = await AccountRequest.create({
        requester_name,
        email,
        phone,
        requested_role,
        division_id,
        request_type,
        user_id,
        notes,
        requested_by: currentUser?._id || null,
        status: "pending",
      });

      // Generate approvals for this request
      await createApprovalsForRequest(request);

      // ============================================
      // Auto-approve if requester is Director
      // ============================================
      if (requesterRoleName === "Director") {
        try {
          // Mark all approvals as approved
          const approvals = await Approval.find({
            request_type,
            request_id: request._id,
          });

          const now = new Date();
          for (const approval of approvals) {
            approval.status = "approved";
            approval.comments =
              approval.comments || "Auto-approved (requested by Director)";
            approval.processed_at = now;
            await approval.save();
          }

          // Reload request with requester info
          const byRequest = await AccountRequest.findById(request._id).populate(
            "requested_by",
            "email full_name"
          );
          const by = byRequest?.requested_by || null;

          // Finalize base request status
          await finalizeRequest(request);

          // Apply business effect based on request type
          if (request.request_type === "promotion") {
            const targetUser = await User.findById(request.user_id).populate(
              "role_id"
            );
            if (targetUser) {
              const oldRole = targetUser.role_id;
              targetUser.role_id = request.requested_role;
              await targetUser.save();

              const newRole = await Role.findById(request.requested_role);

              await autoCreateHistory(
                "promotion",
                { role_id: oldRole?._id },
                { role_id: newRole?._id },
                by,
                {
                  user_id: targetUser._id,
                  effective_date: new Date(),
                  reason: request.notes || "Promotion approved (auto by Director)",
                }
              );

              await handlePromotion(targetUser, oldRole, newRole);
            }
          } else if (request.request_type === "transfer") {
            const targetUser = await User.findById(request.user_id)
              .populate("division_id")
              .populate("role_id");
            if (targetUser) {
              const oldDivision = targetUser.division_id;
              targetUser.division_id = request.division_id;
              await targetUser.save();

              const newDivision = await Division.findById(
                request.division_id
              );

              await autoCreateHistory(
                "transfer",
                { division_id: oldDivision?._id },
                { division_id: newDivision?._id },
                by,
                {
                  user_id: targetUser._id,
                  effective_date: new Date(),
                  reason: request.notes || "Transfer approved (auto by Director)",
                }
              );

              await handleTransfer(targetUser, oldDivision, newDivision);
            }
          } else if (request.request_type === "termination") {
            const targetUser = await User.findById(request.user_id).populate(
              "role_id"
            );
            if (targetUser) {
              const oldStatus = targetUser.status;
              targetUser.status = "terminated";
              targetUser.termination_date = new Date();
              await targetUser.save();

              await autoCreateHistory(
                "terminated",
                { status: oldStatus },
                { status: "terminated" },
                by,
                {
                  user_id: targetUser._id,
                  effective_date: targetUser.termination_date,
                  reason:
                    request.notes || "Termination approved (auto by Director)",
                }
              );

              await handleTerminationNotice(
                targetUser,
                targetUser.termination_date,
                request.notes
              );
            }
          }

          // Ensure request is marked approved
          request.status = "approved";
          request.processed_at = new Date();
          await request.save();
        } catch (autoErr) {
          console.error(
            "Auto-approve by Director failed, request will stay pending:",
            autoErr
          );
        }
      }

      // Notify approvers
      // const requester = currentUser || { email };
      // await handleAccountRequestSubmitted(request, requester);

      // Log audit
      await logAudit(
        c,
        "account_request_create",
        "account_request",
        request._id,
        null,
        {
          request_type: request.request_type,
          requester_name: request.requester_name,
          email: request.email,
          requested_role: request.requested_role,
          division_id: request.division_id,
          user_id: request.user_id,
        }
      );

      return c.json(
        {
          message: "Account request created successfully",
          data: request,
        },
        201
      );
    } catch (error) {
      console.error("Create account request error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/account-requests
   * List account requests with pagination and filters
   */
  static async listAccountRequests(c) {
    try {
      const query = c.req.query();
      const {
        page = 1,
        limit = 20,
        status,
        request_type,
        division_id,
        search,
      } = query;

      const filter = {};
      if (status) filter.status = status;
      if (request_type) filter.request_type = request_type;
      if (division_id) filter.division_id = division_id;

      // Search by name or email
      if (search) {
        filter.$or = [
          { requester_name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const currentUser = c.get("user");
      const userPerms = currentUser?.role_id?.permissions || [];

      // Apply division filter based on permission
      if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
        // Filter by user's division
        if (currentUser?.division_id) {
          filter.division_id = currentUser.division_id;
        } else {
          // User has no division, return empty
          return c.json({
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0,
            },
          });
        }
      }

      const requests = await AccountRequest.find(filter)
        .populate("requested_role", "name")
        .populate("division_id", "name")
        .populate("requested_by", "full_name email")
        .populate("approved_by", "full_name email")
        .populate("user_id", "full_name email")
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      // Filter results based on self permission
      let filteredRequests = requests;
      if (userPerms.includes("user:read:self") && !userPerms.includes("user:read:any") && !userPerms.includes("user:read:own_division")) {
        // Only show requests created by current user
        filteredRequests = requests.filter(req => 
          req.requested_by?._id?.toString() === currentUser._id.toString()
        );
      }

      const total = await AccountRequest.countDocuments(filter);

      return c.json({
        data: filteredRequests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: filteredRequests.length,
          pages: Math.ceil(filteredRequests.length / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("List account requests error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/account-requests/:id
   * Get account request detail
   */
  static async getAccountRequestDetail(c) {
    try {
      const id = c.req.param("id");

      const request = await AccountRequest.findById(id)
        .populate("requested_role", "name description")
        .populate("division_id", "name description manager_id")
        .populate("requested_by", "full_name email")
        .populate("approved_by", "full_name email")
        .populate("user_id", "full_name email role_id division_id");

      if (!request) {
        return c.json({ message: "Account request not found" }, 404);
      }

      // Check access permission
      const currentUser = c.get("user");
      const userPerms = currentUser?.role_id?.permissions || [];

      // Check if user can access this request
      if (!userPerms.includes("user:read:any")) {
        if (userPerms.includes("user:read:own_division")) {
          // Check if request division matches user division
          const requestDivisionId = request.division_id?._id?.toString() || request.division_id?.toString();
          const userDivisionId = currentUser?.division_id?.toString();
          if (requestDivisionId !== userDivisionId) {
            return c.json({ message: "Forbidden: Access denied" }, 403);
          }
        } else if (userPerms.includes("user:read:self")) {
          // Check if request was created by current user
          const requestedById = request.requested_by?._id?.toString();
          const userId = currentUser?._id?.toString();
          if (requestedById !== userId) {
            return c.json({ message: "Forbidden: Access denied" }, 403);
          }
        } else {
          return c.json({ message: "Forbidden: Access denied" }, 403);
        }
      }

      // Get approvals for this request
      const Approval = (await import("../models/approval.js")).default;
      const approvals = await Approval.find({
        request_type: request.request_type,
        request_id: request._id,
      })
        .populate("approver_id", "full_name email role_id")
        .populate("user_id", "full_name email")
        .sort({ approval_level: 1 });

      return c.json({
        data: {
          ...request.toObject(),
          approvals,
        },
      });
    } catch (error) {
      console.error("Get account request detail error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/account-requests/approvable
   * Get account requests that can be approved by current user based on their role
   */
  static async getApprovableRequests(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser || !currentUser.role_id) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      // Ensure role_id is populated
      let userRole;
      if (typeof currentUser.role_id === "object" && currentUser.role_id.name) {
        userRole = currentUser.role_id.name;
      } else {
        // If not populated, fetch it
        const populatedUser = await User.findById(currentUser._id).populate("role_id", "name");
        userRole = populatedUser?.role_id?.name;
      }
      
      if (!userRole) {
        return c.json({
          data: [],
          pagination: {
            page: 1,
            limit: 20,
            total: 0,
            pages: 0,
          },
        });
      }
      
      const query = c.req.query();
      const {
        page = 1,
        limit = 20,
        request_type,
        status,
        search,
      } = query;

      // Get all request types that this user can approve based on workflow
      const approvableRequestTypes = [];
      const allRequestTypes = ["account_request", "promotion", "termination", "transfer", "salary_change"];

      for (const reqType of allRequestTypes) {
        try {
          const workflowSteps = generateApprovalSteps(reqType);
          // Check if user's role matches any approver_role in the workflow
          const canApprove = workflowSteps.some(
            (step) => step.approver_role === userRole
          );
          if (canApprove) {
            approvableRequestTypes.push(reqType);
          }
        } catch (error) {
          // Skip request types that don't have workflow
          continue;
        }
      }


      if (approvableRequestTypes.length === 0) {
        return c.json({
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
        });
      }

      // Find pending approvals where user is the approver
      const pendingApprovals = await Approval.find({
        approver_id: currentUser._id,
        status: "pending",
      })
        .populate("request_id")
        .sort({ approval_level: 1, created_at: -1 });


      // Filter approvals where previous levels are approved (if any)
      const validApprovals = [];
      for (const approval of pendingApprovals) {
        if (approval.approval_level === 1) {
          // Level 1 is always valid
          validApprovals.push(approval);
        } else {
          // Check if previous levels are approved
          const previousApprovals = await Approval.find({
            request_type: approval.request_type,
            request_id: approval.request_id?._id || approval.request_id,
            approval_level: { $lt: approval.approval_level },
          });
          
          const allPreviousApproved = previousApprovals.length > 0 && 
            previousApprovals.every((a) => a.status === "approved");
          
          if (allPreviousApproved) {
            validApprovals.push(approval);
          }
        }
      }

      // Get unique request IDs from valid approvals
      const requestIds = [...new Set(validApprovals.map((a) => {
        const reqId = a.request_id?._id || a.request_id;
        return reqId ? reqId.toString() : null;
      }).filter(Boolean))];

      if (requestIds.length === 0) {
        return c.json({
          data: [],
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: 0,
            pages: 0,
          },
        });
      }

      // Build filter
      const filter = {
        _id: { $in: requestIds },
      };

      if (status) {
        filter.status = status;
      } else {
        filter.status = { $in: ["pending"] };
      }

      if (request_type) {
        filter.request_type = request_type;
      } else {
        filter.request_type = { $in: approvableRequestTypes };
      }

      // Search by name or email
      if (search) {
        filter.$or = [
          { requester_name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get requests
      const requests = await AccountRequest.find(filter)
        .populate("requested_role", "name")
        .populate("division_id", "name")
        .populate("requested_by", "full_name email")
        .populate("approved_by", "full_name email")
        .populate({
          path: "user_id",
          select: "full_name email role_id division_id",
          populate: [
            { path: "role_id", select: "name hierarchy_level" },
            { path: "division_id", select: "name" }
          ]
        })
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      // For each request, get the approval that user can approve
      const requestsWithApprovals = await Promise.all(
        requests.map(async (request) => {
          // Find the approval for this request where user is approver and status is pending
          const userApproval = await Approval.findOne({
            request_type: request.request_type,
            request_id: request._id,
            approver_id: currentUser._id,
            status: "pending",
          })
            .populate("approver_id", "full_name email role_id")
            .populate("user_id", "full_name email");

          // Get all approvals for this request to show timeline
          const allApprovals = await Approval.find({
            request_type: request.request_type,
            request_id: request._id,
          })
            .populate("approver_id", "full_name email role_id")
            .sort({ approval_level: 1 });

          return {
            ...request.toObject(),
            user_approval: userApproval,
            approvals: allApprovals,
          };
        })
      );

      const total = await AccountRequest.countDocuments(filter);

      return c.json({
        data: requestsWithApprovals,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Get approvable requests error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/account-requests/setup/:token
   * Verify setup token and get account request data for form
   */
  static async verifySetupToken(c) {
    try {
      const token = c.req.param("token");

      if (!token) {
        return c.json({ message: "Token is required" }, 400);
      }

      // Find account request with valid token
      const request = await AccountRequest.findOne({
        setup_token: token,
        status: "approved",
        setup_token_expires_at: { $gt: new Date() }, // Token not expired
      })
        .populate("requested_role", "name description")
        .populate("division_id", "name description");

      if (!request) {
        return c.json(
          { 
            message: "Token tidak valid atau sudah kedaluwarsa",
            valid: false 
          },
          404
        );
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: request.email });
      if (existingUser) {
        return c.json(
          { 
            message: "Akun dengan email ini sudah terdaftar",
            valid: false 
          },
          400
        );
      }

      // Return request data (without sensitive info)
      return c.json({
        valid: true,
        data: {
          requester_name: request.requester_name,
          email: request.email,
          phone: request.phone || "",
          requested_role: request.requested_role,
          division_id: request.division_id,
          request_id: request._id,
        },
      });
    } catch (error) {
      console.error("Verify setup token error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * POST /api/v1/account-requests/setup/:token
   * Submit account setup form and create user
   */
  static async submitAccountSetup(c) {
    try {
      const token = c.req.param("token");
      const body = await c.req.json();
      const {
        password,
        profile_photo_url,
        date_of_birth,
        national_id,
        address,
        city,
        state,
        postal_code,
        country,
        emergency_contact_name,
        emergency_contact_phone,
        emergency_contact_relation,
      } = body;

      if (!token) {
        return c.json({ message: "Token is required" }, 400);
      }

      // Validate password
      if (!password || password.length < 8) {
        return c.json(
          { message: "Password harus minimal 8 karakter" },
          400
        );
      }

      // Find account request with valid token
      const request = await AccountRequest.findOne({
        setup_token: token,
        status: "approved",
        setup_token_expires_at: { $gt: new Date() },
      });

      if (!request) {
        return c.json(
          { message: "Token tidak valid atau sudah kedaluwarsa" },
          404
        );
      }

      // Check if user already exists
      const existingUser = await User.findOne({ email: request.email });
      if (existingUser) {
        return c.json(
          { message: "Akun dengan email ini sudah terdaftar" },
          400
        );
      }

      // Hash password
      const hashedPassword = await argon2.hash(password);

      // Create user account
      const newUser = await User.create({
        email: request.email,
        password: hashedPassword,
        full_name: request.requester_name,
        phone: request.phone || null,
        role_id: request.requested_role,
        division_id: request.division_id,
        status: "active",
        hire_date: new Date(),
        profile_photo_url: profile_photo_url || null,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        national_id: national_id || null,
        address: address || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country || "Indonesia",
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        emergency_contact_relation: emergency_contact_relation || null,
      });

      // Link documents from account_request to user
      const Document = (await import("../models/document.js")).default;
      await Document.updateMany(
        { account_request_id: request._id },
        { 
          $set: { user_id: newUser._id },
          $unset: { account_request_id: "" }
        }
      );

      // Create employee history
      await autoCreateHistory(
        "hired",
        {},
        {
          role_id: request.requested_role,
          division_id: request.division_id,
        },
        request.approved_by || null,
        {
          user_id: newUser._id,
          effective_date: new Date(),
          reason: "Account request approved",
          notes: "User account created from account request",
        }
      );

      // Clear setup token
      request.setup_token = null;
      request.setup_token_expires_at = null;
      await request.save();

      // Log audit
      await logAudit(
        c,
        "account_setup_complete",
        "account_request",
        request._id,
        { status: "approved", setup_token: request.setup_token },
        { status: "approved", user_id: newUser._id, setup_completed: true }
      );

      // Notify user that setup is completed
      // await handleAccountSetupCompleted(newUser);

      return c.json(
        {
          message: "Akun berhasil dibuat",
          data: {
            user_id: newUser._id,
            email: newUser.email,
            full_name: newUser.full_name,
          },
        },
        201
      );
    } catch (error) {
      console.error("Submit account setup error:", error);
      
      // Handle duplicate email error
      if (error.code === 11000 || error.message.includes("duplicate")) {
        return c.json(
          { message: "Email sudah terdaftar" },
          400
        );
      }

      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }
}

export default AccountRequestController;

