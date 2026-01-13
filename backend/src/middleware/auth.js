import jwt from "jsonwebtoken";
import User from "../models/user.js";
import { getCookie } from "hono/cookie";

export const authenticate = () => {
  return async (c, next) => {
    try {
      const token = getCookie(c, "access_token");

      if (!token) {
        return c.json({ message: "Unauthorized: No token" }, 401);
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).populate("role_id");
      if (!user) {
        return c.json({ message: "Unauthorized: User not found" }, 401);
      }

      c.set("user", user);
      await next();
    } catch (err) {
      console.error("Auth error:", err);
      return c.json({ message: "Unauthorized: Invalid token" }, 401);
    }
  };
};


export const authorize = ({ permissions }) => {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ message: "Unauthorized" }, 401);

    const userPerms = user.role_id?.permissions || [];

    // cari permission yang cocok (ambil first match)
    const matched = permissions.find((perm) => userPerms.includes(perm));

    if (!matched) {
      return c.json({ message: "Forbidden" }, 403);
    }

    // Simpan hanya permission yang match (string)
    c.set("currentPermission", matched);
    c.set("userPermissions", userPerms);

    await next();
  };
};



export const authorizeByLevel = (minLevel) => {
  return async (c, next) => {
    const user = c.get("user");

    if (!user || !user.role_id) {
      return c.json({ message: "Forbidden" }, 403);
    }

    const level = user.role_id.hierarchy_level;

    if (level > minLevel) {
      return c.json(
        { message: "Forbidden: Level too low" },
        403
      );
    }

    await next();
  };
};

export const restrictUserAccess = (req, res, next) => {
  const currentUser = req.user;
  const targetUser = req.targetUser;
  const targetId = req.params.id;

  const role = currentUser.role_id;
  const perms = role.permissions;

  // ANY → bypass
  if (perms.includes("user:read:any") || perms.includes("user:view_history:any")) {
    return next();
  }

  // Own division
  if (
    (perms.includes("user:read:own_division") || perms.includes("user:view_history:own_division")) &&
    targetUser &&
    currentUser.division?.toString() === targetUser.division?.toString()
  ) {
    return next();
  }

  // Self
  if (
    (perms.includes("user:read:self") || perms.includes("user:view_history:self")) &&
    currentUser._id.toString() === targetId
  ) {
    return next();
  }

  return res.status(403).json({ message: "Forbidden: Access denied" });
};

/**
 * Middleware to guard approval actions
 * Ensures user is the approver for the approval
 */
export const approvalGuard = () => {
  return async (c, next) => {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const approvalId = c.req.param("id");
      if (!approvalId) {
        return c.json({ message: "Approval ID is required" }, 400);
      }

      const Approval = (await import("../models/approval.js")).default;
      const approval = await Approval.findById(approvalId).populate("approver_id");

      if (!approval) {
        return c.json({ message: "Approval not found" }, 404);
      }

      // Check if user is the approver
      if (approval.approver_id._id.toString() !== user._id.toString()) {
        return c.json({ message: "You are not authorized to perform this action" }, 403);
      }

      // Check if approval is still pending
      if (approval.status !== "pending") {
        return c.json({ message: `Approval already ${approval.status}` }, 400);
      }

      c.set("approval", approval);
      await next();
    } catch (error) {
      console.error("Approval guard error:", error);
      return c.json({ message: "Internal server error" }, 500);
    }
  };
};

/**
 * Helper function to check if user can access a resource
 * Based on permission type: any, own_division, or self
 * @param {object} user - Current user object
 * @param {object} targetResource - Target resource (user, division, etc.)
 * @param {string} permissionType - Permission type (read, view_history, etc.)
 * @returns {boolean} - True if user can access
 */
export const canAccessResource = async (user, targetResource, permissionType = "read") => {
  const { default: Division } = await import("../models/division.js");
  if (!user || !user.role_id) return false;

  const perms = user.role_id.permissions || [];
  const userId = user._id
  const divisions = await Division.find({
    manager_id: userId,
  }).lean();
  const userDivisionId = divisions?._id?.toString();

  // Check for :any permission
  if (perms.includes(`user:${permissionType}:any`)) {
    return true;
  }

  // Check for :own_division permission
  if (perms.includes(`user:${permissionType}:own_division`)) {
    const targetDivisionId = targetResource?.division_id?.toString() || 
                            targetResource?.division?.toString() ||
                            targetResource?.division_id?._id?.toString();
    
    if (userDivisionId && targetDivisionId && userDivisionId === targetDivisionId) {
      return true;
    }
  }

  // Check for :self permission
  if (perms.includes(`user:${permissionType}:self`)) {
    const targetUserId = targetResource?._id?.toString() || 
                        targetResource?.user_id?.toString() ||
                        targetResource?.id?.toString();
    
    if (userId && targetUserId && userId === targetUserId) {
      return true;
    }
  }

  return false;
};

/**
 * Helper function to check if user can approve based on permission
 * @param {object} user - Current user object
 * @param {string} requestType - Request type (account_request, promotion, termination, transfer)
 * @param {object} targetResource - Target resource (user, division, etc.)
 * @returns {boolean} - True if user can approve
 */
export const canApprove = (user, requestType, targetResource = null) => {
  if (!user || !user.role_id) return false;

  const perms = user.role_id.permissions || [];
  const userDivisionId = user.division_id?.toString();

  // Check for account approval
  if (requestType === "account_request") {
    if (perms.includes("account:approve:any")) {
      return true;
    }
    if (perms.includes("account:approve:own_division") && targetResource) {
      const targetDivisionId = targetResource?.division_id?.toString() || 
                              targetResource?.division?.toString();
      return userDivisionId && targetDivisionId && userDivisionId === targetDivisionId;
    }
  }

  // Check for employee actions
  if (requestType === "promotion") {
    if (perms.includes("employee:promote:any")) return true;
    if (perms.includes("employee:promote:own_division") && targetResource) {
      const targetDivisionId = targetResource?.division_id?.toString() || 
                              targetResource?.division?.toString();
      return userDivisionId && targetDivisionId && userDivisionId === targetDivisionId;
    }
  }

  if (requestType === "termination") {
    if (perms.includes("employee:terminate:any")) return true;
    if (perms.includes("employee:terminate:own_division") && targetResource) {
      const targetDivisionId = targetResource?.division_id?.toString() || 
                              targetResource?.division?.toString();
      return userDivisionId && targetDivisionId && userDivisionId === targetDivisionId;
    }
  }

  if (requestType === "transfer") {
    if (perms.includes("employee:transfer:any")) return true;
    // Transfer might need special handling
  }

  return false;
};

/**
 * Middleware to automatically log actions to audit log
 * @param {string} action - Action type (create, update, delete, approve, reject)
 * @param {string} resourceType - Resource type (user, role, division, account_request, approval, document)
 * @param {function} getResourceId - Function to get resource ID from context
 * @param {function} getOldValue - Optional function to get old value before change
 * @param {function} getNewValue - Optional function to get new value after change
 * @returns {function} Middleware function
 */
export const auditAction = (
  action,
  resourceType,
  getResourceId = (c) => c.req.param("id"),
  getOldValue = null,
  getNewValue = null
) => {
  return async (c, next) => {
    // Store original response
    const originalJson = c.json.bind(c);
    let responseData = null;

    // Override c.json to capture response
    c.json = (body, status) => {
      responseData = body;
      return originalJson(body, status);
    };

    // Get old value before action (if provided)
    let oldValue = null;
    if (getOldValue) {
      try {
        oldValue = await getOldValue(c);
      } catch (error) {
        console.error("Error getting old value for audit:", error);
      }
    }

    // Execute the action
    await next();

    // Get new value after action (if provided)
    let newValue = null;
    if (getNewValue) {
      try {
        newValue = await getNewValue(c, responseData);
      } catch (error) {
        console.error("Error getting new value for audit:", error);
      }
    }

    // Get resource ID
    let resourceId = null;
    try {
      resourceId = getResourceId(c);
    } catch (error) {
      console.error("Error getting resource ID for audit:", error);
    }

    // Only log if action was successful (status 200-299)
    const status = c.res.status || 200;
    if (status >= 200 && status < 300 && resourceId) {
      try {
        const user = c.get("user");
        const userId = user?._id?.toString() || null;
        const ipAddress = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || null;
        const userAgent = c.req.header("user-agent") || null;

        // Import and create audit log
        const { createAuditLog } = await import("../services/auditLogService.js");
        await createAuditLog(
          userId,
          action,
          resourceType,
          resourceId,
          oldValue,
          newValue,
          ipAddress,
          userAgent
        );
      } catch (error) {
        // Don't fail the request if audit logging fails
        console.error("Error creating audit log:", error);
      }
    }

    // Restore original json
    c.json = originalJson;
  };
};

