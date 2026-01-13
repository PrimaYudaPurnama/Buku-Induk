import Approval from "../models/approval.js";
import AccountRequest from "../models/accountRequest.js";
import User from "../models/user.js";
import Role from "../models/role.js";
import Division from "../models/division.js";
import { generateApprovalSteps } from "../lib/approvalWorkflows.js";
import { getRoleHierarchyLevel } from "../lib/roleHierarchy.js";
import { notifyUser } from "./notificationService.js";

/**
 * Generate approval steps for a request type
 * @param {string} requestType - Type of request
 * @param {object} userData - User data
 * @param {object} payload - Additional payload
 * @returns {Array} Array of approval steps
 */
export const generateApprovalStepsForRequest = (requestType, userData = {}, payload = {}) => {
  return generateApprovalSteps(requestType, userData, payload);
};

/**
 * Create approvals for a request
 * @param {object} accountRequest - AccountRequest document
 * @returns {Promise<Array>} Array of created Approval documents
 */
export const createApprovalsForRequest = async (accountRequest) => {
  const requestType = accountRequest.request_type || "account_request";
  
  // Get user data if user_id exists
  let userData = {};
  let user = null;

  if (accountRequest.user_id) {
    user = await User.findById(accountRequest.user_id)
      .populate("role_id")
      .populate("division_id");
      
    if (user) {
      userData = {
        currentRole: user.role_id?.name,
        currentDivision: user.division_id?._id,
      };
    }
  }

  // Generate approval steps
  const steps = generateApprovalStepsForRequest(requestType, userData, {
    requested_role: accountRequest.requested_role,
    division_id: accountRequest.division_id,
  });

  const approvals = [];
  const requestedBy = await User.findOne({ _id: accountRequest.requested_by }).select("full_name");

  // Renumber levels starting from 1 (in case level 1 was skipped)
  let actualLevel = 1;
  
  for (const step of steps) {
    const role = await Role.findOne({ name: step.approver_role });
    if (!role && step.approver_role !== "Manager") {
      throw new Error(`Role not found: ${step.approver_role}`);
    }

    let approverUsers = [];

    // ===== TRANSFER CASE =====
    if (requestType === "transfer" && step.level === 1) {
      // Step 1: Current Manager (only if user has current division)
      if (userData.currentDivision) {
        const division = await Division.findById(userData.currentDivision).populate("manager_id");
        if (division?.manager_id) approverUsers = [division.manager_id];
      } else {
        // Skip this step if no current division
        continue;
      }
    }
    else if (requestType === "transfer" && step.level === 2) {
      // Step 2: Target Division Manager
      if (accountRequest.division_id) {
        const targetDivision = await Division.findById(accountRequest.division_id).populate("manager_id");
        if (targetDivision?.manager_id) approverUsers = [targetDivision.manager_id];
      } else {
        console.warn("Transfer request has no target division_id");
        continue;
      }
    }

    // ===== MANAGER DIVISION (Normal Requests: Promotion, Termination) =====
    else if (step.approver_role === "Manager" && requestType !== "transfer") {
      // Manager = manager divisi user, bukan role Manager
      // This should only be called if userData.currentDivision exists (already filtered in workflow)
      if (userData.currentDivision) {
        const division = await Division.findById(userData.currentDivision).populate("manager_id");
        if (division?.manager_id) approverUsers = [division.manager_id];
      } else {
        // This shouldn't happen if workflow is correct, but skip just in case
        console.warn("Cannot assign Manager approver: user has no division");
        continue;
      }
    }

    // ===== NORMAL ROLES (Manager HR, Director, CFO, dll) =====
    else {
      approverUsers = await User.find({
        role_id: role._id,
        status: "active",
      });
    }

    // ===== CREATE APPROVAL =====
    const approver = approverUsers[0];
    if (!approver) {
      console.warn(`No approver found for level ${step.level}, role ${step.approver_role}`);
      continue;
    }

    
    const approval = await Approval.create({
      request_type: requestType,
      request_id: accountRequest._id,
      user_id: accountRequest.user_id || accountRequest._id,
      approver_id: approver._id,
      status: "pending",
      approval_level: actualLevel, // Use renumbered level
      comments: "",
    });
    
    approvals.push(approval);
    actualLevel++; // Increment for next approval level
    
    await notifyUser(
      approver._id,
      "approval_pending",
      `New ${requestType} request requires your approval`,
      `A new ${requestType} request has been submitted by ${approver.full_name}`,
      { action_url: `/approvals/${accountRequest._id}` }
    );
  }

  return approvals;
};


/**
 * Approve a step
 * @param {string} approvalId - Approval ID
 * @param {object} approverUser - User approving
 * @param {string} comments - Optional comments
 * @returns {Promise<object>} Updated approval and request
 */
export const approveStep = async (approvalId, approverUser, comments = "") => {
  const approval = await Approval.findById(approvalId)
    .populate("request_id")
    .populate("approver_id");

  if (!approval) {
    throw new Error("Approval not found");
  }

  // Check if already processed
  if (approval.status !== "pending") {
    throw new Error(`Approval already ${approval.status}`);
  }

  // Check if request_id exists
  if (!approval.request_id) {
    throw new Error("Approval request_id is missing");
  }

  // Get request_id (handle both populated and non-populated cases)
  const requestId = approval.request_id._id || approval.request_id;

  // Check if approver matches
  if (approval.approver_id && approval.approver_id._id) {
    if (approval.approver_id._id.toString() !== approverUser._id.toString()) {
      throw new Error("You are not authorized to approve this step");
    }
  } else if (approval.approver_id && approval.approver_id.toString() !== approverUser._id.toString()) {
    throw new Error("You are not authorized to approve this step");
  }

  // Check if previous levels are approved
  const previousApprovals = await Approval.find({
    request_type: approval.request_type,
    request_id: requestId,
    approval_level: { $lt: approval.approval_level },
  });

  const allPreviousApproved = previousApprovals.every((a) => a.status === "approved");
  if (!allPreviousApproved && previousApprovals.length > 0) {
    throw new Error("Previous approval levels must be approved first");
  }

  // Update approval
  approval.status = "approved";
  approval.comments = comments;
  approval.processed_at = new Date();
  await approval.save();

  // Check if all approvals are approved
  const allApproved = await checkIfAllApproved(requestId);
  
  if (allApproved) {
    // Finalize the request (need to get the actual request document)
    const request = approval.request_id._id 
      ? approval.request_id 
      : await (await import("../models/accountRequest.js")).default.findById(requestId);
    await finalizeRequest(request);
  } else {
    // Unlock next level
    const nextLevel = approval.approval_level + 1;
    const nextApprovals = await Approval.find({
      request_type: approval.request_type,
      request_id: requestId,
      approval_level: nextLevel,
    });

    // Next level approvals are now available (they were created but not yet pending)
    // In our current implementation, all are created as pending, so this is handled
  }

  // Get the actual request document if not populated
  const request = approval.request_id._id 
    ? approval.request_id 
    : await (await import("../models/accountRequest.js")).default.findById(requestId);

  return { approval, request };
};

/**
 * Reject a step
 * @param {string} approvalId - Approval ID
 * @param {object} approverUser - User rejecting
 * @param {string} comments - Rejection comments
 * @returns {Promise<object>} Updated approval and request
 */
export const rejectStep = async (approvalId, approverUser, comments = "") => {
  const approval = await Approval.findById(approvalId)
    .populate("request_id")
    .populate("approver_id");

  if (!approval) {
    throw new Error("Approval not found");
  }

  // Check if already processed
  if (approval.status !== "pending") {
    throw new Error(`Approval already ${approval.status}`);
  }

  // Check if request_id exists
  if (!approval.request_id) {
    throw new Error("Approval request_id is missing");
  }

  // Get request_id (handle both populated and non-populated cases)
  const requestId = approval.request_id._id || approval.request_id;

  // Check if approver matches
  if (approval.approver_id && approval.approver_id._id) {
    if (approval.approver_id._id.toString() !== approverUser._id.toString()) {
      throw new Error("You are not authorized to reject this step");
    }
  } else if (approval.approver_id && approval.approver_id.toString() !== approverUser._id.toString()) {
    throw new Error("You are not authorized to reject this step");
  }

  // Update approval
  approval.status = "rejected";
  approval.comments = comments;
  approval.processed_at = new Date();
  await approval.save();

  // Auto-reject all other approvals for this request
  const allApprovals = await Approval.find({
    request_type: approval.request_type,
    request_id: requestId,
  });

  for (const otherApproval of allApprovals) {
    if (otherApproval._id.toString() !== approvalId && otherApproval.status === "pending") {
      otherApproval.status = "rejected";
      otherApproval.comments = "Auto-rejected due to rejection at another level";
      otherApproval.processed_at = new Date();
      await otherApproval.save();
    }
  }

  // Reject the request
  const AccountRequest = (await import("../models/accountRequest.js")).default;
  const request = await AccountRequest.findById(requestId);
  if (request) {
    request.status = "rejected";
    request.processed_at = new Date();
    await request.save();
  }

  return { approval, request };
};

/**
 * Check if all approvals for a request are approved
 * @param {string} requestId - Request ID
 * @returns {Promise<boolean>} True if all approved
 */
export const checkIfAllApproved = async (requestId) => {
  const approvals = await Approval.find({
    request_id: requestId,
  });

  if (approvals.length === 0) {
    return false;
  }

  return approvals.every((a) => a.status === "approved");
};

/**
 * Finalize a request (create history, document if needed, send notification)
 * @param {object} request - AccountRequest or similar request document
 * @returns {Promise<object>} Finalized request
 */
export const finalizeRequest = async (request) => {
  // Import services (will be created in later prompts)
  // For now, we'll just update the request status
  // The actual history/document/notification creation will be handled by controllers
  
  if (request.status !== "approved") {
    request.status = "approved";
    request.processed_at = new Date();
    await request.save();
  }

  // Return request for further processing by controllers
  return request;
};

/**
 * Get pending approvals for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array>} Array of pending approvals
 */
export const getPendingApprovalsForUser = async (userId) => {
  const approvals = await Approval.find({
    approver_id: userId,
    status: "pending",
    request_id: { $ne: null }, // Only get approvals with valid request_id
  })
    .populate({
      path: "request_id",
      options: { strictPopulate: false }
    })
    .populate("user_id")
    .populate("approver_id")
    .sort({ approval_level: 1, created_at: 1 });

  // Filter to only show approvals where previous levels are approved
  const validApprovals = [];
  for (const approval of approvals) {
    // Skip if request_id is null or not populated
    if (!approval.request_id) {
      console.warn(`Approval ${approval._id} has null request_id, skipping`);
      continue;
    }

    // Get request_id (handle both populated and non-populated cases)
    const requestId = approval.request_id._id || approval.request_id;

    if (approval.approval_level === 1) {
      validApprovals.push(approval);
    } else {
      const previousApprovals = await Approval.find({
        request_type: approval.request_type,
        request_id: requestId,
        approval_level: { $lt: approval.approval_level },
      });
      
      const allPreviousApproved = previousApprovals.every((a) => a.status === "approved");
      if (allPreviousApproved) {
        validApprovals.push(approval);
      }
    }
  }

  return validApprovals;
};

