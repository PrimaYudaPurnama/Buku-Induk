import User from "../models/user.js";
import Salary from "../models/salary.js";
import EmployeeHistory from "../models/employeeHistory.js";
import Division from "../models/division.js";
import Role from "../models/role.js";
import argon2 from "argon2";
import mongoose from "mongoose";
import { logAudit } from "../utils/auditLogger.js";
import { maskSalaryForUsers, populateSalaryForUsers } from "../services/userService.js";


class UserController {
  /**
   * GET /api/v1/users
   * List users with pagination, filtering, and sorting
   */

  async getUsers(c) {
    try {
      const currentUser = c.get("user");
      const userPermissions = currentUser?.role_id?.permissions || [];

      const isSuperAdmin = currentUser?.role_id?.hierarchy_level === 1; 

  
      const has = (perm) => userPermissions.includes(perm);
  
      // ===============================
      // Pagination
      // ===============================
      const page = parseInt(c.req.query("page[number]")) || 1;
      const limit = parseInt(c.req.query("page[size]")) || 10;
      const skip = (page - 1) * limit;
  
      const filters = {};
  
      // ===============================
      // Filters
      // ===============================

      if (!isSuperAdmin) {
        const superAdminRole = await Role.findOne({ hierarchy_level: 1 })
          .select("_id")
          .lean();
      
        if (superAdminRole) {
          filters.role_id = {
            ...(filters.role_id || {}),
            $ne: superAdminRole._id,
          };
        }
      }      

      const safeQuery = (q) => {
        if (!q || typeof q !== "string") return null;
        const v = q.trim();
        return v === "" || v === "null" ? null : v;
      };
  
      const divisionQuery = safeQuery(c.req.query("filter[division_id]"));
      if (divisionQuery) filters.division_id = divisionQuery;
  
      const statusQuery = safeQuery(c.req.query("filter[status]"));
      if (statusQuery) filters.status = statusQuery;
  
      const roleQuery = safeQuery(c.req.query("filter[role_id]"));
      if (roleQuery) filters.role_id = roleQuery;
  
      const search = safeQuery(c.req.query("search"));
      if (search) filters.$text = { $search: search };
  
      // ===============================
      // READ PERMISSION
      // ===============================
      let divisionId = null;
  
      if (has("user:read:any") || has("dashboard:read")) {
        // full access
      } else if (has("user:read:own_division")) {
        const division = await Division.findOne({ manager_id: currentUser._id })
          .select("_id")
          .lean();
  
        if (!division) {
          filters._id = { $in: [] };
        } else {
          divisionId = division._id.toString();
          filters.division_id = divisionId;
        }
      } else if (has("user:read:self")) {
        filters._id = currentUser._id;
      } else {
        return c.json({ error: "Access denied" }, 403);
      }

      let finalFilters = filters;

      if (!isSuperAdmin) {
        finalFilters = {
          ...filters,
          status: { $nin: ["terminated", "pending"] },
        };
      }      
    
      // ===============================
      // Query DB
      // ===============================
      const [users, total] = await Promise.all([
        User.find(finalFilters)
          .populate("role_id", "name hierarchy_level")
          .populate("division_id", "name")
          .select("-password")
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(finalFilters),
      ]);
  
      // ===============================
      // POPULATE SALARY DATA
      // ===============================
      const usersWithSalary = await populateSalaryForUsers(users);
  
      // ===============================
      // SALARY MASKING CONTEXT
      // ===============================
      const salaryContext = {
        canViewAny: has("user:view_salary:any"),
        canViewOwnDivision: has("user:view_salary:own_division"),
        canViewSelf: has("user:view_salary:self"),
        divisionId,
        currentUserId: currentUser._id.toString(),
      };
  
      const usersMasked = maskSalaryForUsers(usersWithSalary, salaryContext);
  
      return c.json({
        success: true,
        data: usersMasked,
        meta: {
          pagination: {
            page,
            page_size: limit,
            total_items: total,
            total_pages: Math.ceil(total / limit),
          },
        },
      });
  
    } catch (error) {
      console.error("getUsers error:", error);
      return c.json(
        {
          success: false,
          error: {
            message: error.message,
            code: "USER_LIST_ERROR",
          },
        },
        500
      );
    }
  }
  


  /**
   * GET /api/v1/users/:id
   * Get user by ID
   */
  async getUserById(c) {
    try {
      const userId = c.req.param("id");

      const user = await User.findById(userId)
        .populate("role_id", "name description hierarchy_level permissions")
        .populate("division_id", "name description")
        .populate("full_name email phone")
        .select("-password")
        .lean();

      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              message: "User not found",
              code: "USER_NOT_FOUND",
            },
          },
          404
        );
      }

      // Populate salary data
      const [userWithSalary] = await populateSalaryForUsers([user]);

      return c.json({
        success: true,
        data: userWithSalary,
      });
    } catch (error) {
      if (error.name === "CastError") {
        return c.json(
          {
            success: false,
            error: {
              message: "Invalid user ID format",
              code: "INVALID_USER_ID",
            },
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: {
            message: error.message,
            code: "USER_FETCH_ERROR",
          },
        },
        500
      );
    }
  }

  /**
   * POST /api/v1/users
   * Create new user
   */
  async createUser(c) {
    try {
      const currentUser = c.get("user");
      const currentPermission = c.get("currentPermission");

      if (currentPermission !== "user:create") {
        return c.json(
          {
            success: false,
            error: {
              message: `Access Denied`,
              code: "PERMISSION_ERROR",
            },
          },
          400
        );
      }

      const data = await c.req.json();

      // Validasi required fields
      const requiredFields = ["email", "password", "full_name", "role_id"];
      const missingFields = requiredFields.filter(field => !data[field]);
      
      if (missingFields.length > 0) {
        return c.json(
          {
            success: false,
            error: {
              message: `Missing required fields: ${missingFields.join(", ")}`,
              code: "VALIDATION_ERROR",
            },
          },
          400
        );
      }

      // Check if email already exists
      const existingUser = await User.findOne({ email: data.email });
      if (existingUser) {
        return c.json(
          {
            success: false,
            error: {
              message: "Email already registered",
              code: "EMAIL_EXISTS",
            },
          },
          409
        );
      }

      // Hash password
      const hashedPassword = await argon2.hash(data.password);

      // Generate employee code
      const { generateEmployeeCode } = await import("../utils/employeeCode.js");
      const employeeCode = await generateEmployeeCode();

      // Create user (no salary field - salary is managed separately)
      const newUser = await User.create({
        email: data.email,
        password: hashedPassword,
        full_name: data.full_name,
        phone: data.phone || null,
        role_id: data.role_id,
        division_id: data.division_id || null,
        status: data.status || "pending",
        employment_type: data.employment_type || "unspecified",
        employee_code: employeeCode,
        hire_date: data.hire_date || new Date(),
        profile_photo_url: data.profile_photo_url || null,
        emergency_contact_name: data.emergency_contact_name || null,
        emergency_contact_phone: data.emergency_contact_phone || null,
        emergency_contact_relation: data.emergency_contact_relation || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        postal_code: data.postal_code || null,
        country: data.country || "Indonesia",
        date_of_birth: data.date_of_birth || null,
        national_id: data.national_id || null,
        npwp: data.npwp || null,
        gender: data.gender || "male",
      });

      // Create history record (no salary - salary will be created when user is approved)
      await EmployeeHistory.create({
        user_id: newUser._id,
        event_type: "hired",
        new_role: data.role_id,
        new_division: data.division_id || null,
        effective_date: data.hire_date || new Date(),
        notes: "Initial hiring",
        created_by: currentUser._id,
      });

      // Fetch populated user data
      const populatedUser = await User.findById(newUser._id)
        .populate("role_id", "name description hierarchy_level")
        .populate("division_id", "name")
        .populate("full_name email")
        .select("-password")
        .lean();

      // Populate salary data
      const [populatedWithSalary] = await populateSalaryForUsers([populatedUser]);

      await logAudit(
        c,
        "user_create",
        "user",
        newUser._id,
        null,
        populatedWithSalary
      );

      return c.json(
        {
          success: true,
          data: populatedWithSalary,
          message: "User created successfully",
        },
        201
      );
    } catch (error) {
      console.error("createUser error:", error);

      if (error.name === "ValidationError") {
        return c.json(
          {
            success: false,
            error: {
              message: error.message,
              code: "VALIDATION_ERROR",
            },
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Internal server error",
            code: "USER_CREATE_ERROR",
          },
        },
        500
      );
    }
  }

  /**
   * PATCH /api/v1/users/:id
   * Update user
   */
  async updateUser(c) {
    try {

      const currentUser = c.get("user");
      const currentPermission = c.get("currentPermission");

      if (currentPermission !== "user:update") {
        return c.json(
          {
            success: false,
            error: {
              message: `Access Denied`,
              code: "PERMISSION_ERROR",
            },
          },
          400
        );
      }
      const userId = c.req.param("id");
      const data = await c.req.json();

      // Find existing user
      const existingUser = await User.findById(userId).populate("role_id");
      if (!existingUser) {
        return c.json(
          {
            success: false,
            error: {
              message: "User not found",
              code: "USER_NOT_FOUND",
            },
          },
          404
        );
      }

      // Prepare update data (salary is managed separately via Salary model)
      const updateData = {};
      const allowedFields = [
        "full_name", "phone", "role_id", "division_id",
        "status", "hire_date", "expired_date", "termination_date", "profile_photo_url",
        "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
        "address", "city", "state", "postal_code", "country",
        "date_of_birth", "national_id", "npwp", "gender", "employment_type"
      ];

      allowedFields.forEach(field => {
        if (data[field] !== undefined) {
          updateData[field] = data[field];
        }
      });

      // Handle password update separately
      if (data.password) {
        updateData.password = await argon2.hash(data.password);
      }

      // Check for email update
      if (data.email && data.email !== existingUser.email) {
        const emailExists = await User.findOne({ email: data.email, _id: { $ne: userId } });
        if (emailExists) {
          return c.json(
            {
              success: false,
              error: {
                message: "Email already registered",
                code: "EMAIL_EXISTS",
              },
            },
            409
          );
        }
        updateData.email = data.email;
      }

      // Update user
      const oldSnapshot = existingUser.toObject();
      delete oldSnapshot.password;
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate("role_id", "name description hierarchy_level")
        .populate("division_id", "name")
        .populate("full_name email")
        .select("-password")
        .lean();

      // Create history record for significant changes
      const historyEvents = [];

      if (data.role_id && data.role_id !== existingUser.role_id._id.toString()) {
        historyEvents.push({
          user_id: userId,
          event_type: "promotion",
          old_role: existingUser.role_id._id,
          new_role: data.role_id,
          effective_date: new Date(),
          notes: data.notes || "Role change",
          created_by: currentUser._id,
        });
      }

      if (data.division_id && data.division_id !== existingUser.division_id?.toString()) {
        historyEvents.push({
          user_id: userId,
          event_type: "transfer",
          old_division: existingUser.division_id,
          new_division: data.division_id,
          effective_date: new Date(),
          notes: data.notes || "Division transfer",
          created_by: currentUser._id,
        });
      }

      if (data.status === "terminated" && existingUser.status !== "terminated") {
        historyEvents.push({
          user_id: userId,
          event_type: "termination",
          old_role: existingUser.role_id._id,
          old_division: existingUser.division_id,
          effective_date: data.termination_date || new Date(),
          notes: data.notes || "Employee termination",
          created_by: currentUser._id,
        });
      }

      if (historyEvents.length > 0) {
        await EmployeeHistory.insertMany(historyEvents);
      }

      await logAudit(
        c,
        "user_update",
        "user",
        userId,
        oldSnapshot,
        updatedUser
      );

      // Populate salary data
      const [userWithSalary] = await populateSalaryForUsers([updatedUser]);

      return c.json({
        success: true,
        data: userWithSalary,
        message: "User updated successfully",
      });
    } catch (error) {
      console.error("updateUser error:", error);

      if (error.name === "CastError") {
        return c.json(
          {
            success: false,
            error: {
              message: "Invalid user ID format",
              code: "INVALID_USER_ID",
            },
          },
          400
        );
      }

      if (error.name === "ValidationError") {
        return c.json(
          {
            success: false,
            error: {
              message: error.message,
              code: "VALIDATION_ERROR",
            },
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Internal server error",
            code: "USER_UPDATE_ERROR",
          },
        },
        500
      );
    }
  }

  /**
   * DELETE /api/v1/users/:id
   * Delete user (soft delete by setting status to inactive)
   */
  async deleteUser(c) {
    try {
      const currentUser = c.get("user");
      const currentPermission = c.get("currentPermission");

      if (currentPermission !== "user:delete") {
        return c.json(
          {
            success: false,
            error: {
              message: `Access Denied`,
              code: "PERMISSION_ERROR",
            },
          },
          400
        );
      }

      const userId = c.req.param("id");

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              message: "User not found",
              code: "USER_NOT_FOUND",
            },
          },
          404
        );
      }

      // Prevent self-deletion
      if (userId === currentUser._id.toString()) {
        return c.json(
          {
            success: false,
            error: {
              message: "You cannot delete your own account",
              code: "SELF_DELETE_FORBIDDEN",
            },
          },
          403
        );
      }

      // Soft delete: set status to terminated
      await User.findByIdAndUpdate(userId, {
        $set: {
          status: "terminated",
          termination_date: new Date(),
        },
      });

      // Create history record
      await EmployeeHistory.create({
        user_id: userId,
        event_type: "termination",
        old_role: user.role_id,
        old_division: user.division_id,
        effective_date: new Date(),
        notes: "Account terminated",
        created_by: currentUser._id,
      });

      await logAudit(
        c,
        "user_delete",
        "user",
        userId,
        user.toObject(),
        { status: "terminated" }
      );

      return c.json({
        success: true,
        message: "User deleted successfully",
      });
    } catch (error) {
      console.error("deleteUser error:", error);

      if (error.name === "CastError") {
        return c.json(
          {
            success: false,
            error: {
              message: "Invalid user ID format",
              code: "INVALID_USER_ID",
            },
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Internal server error",
            code: "USER_DELETE_ERROR",
          },
        },
        500
      );
    }
  }

  /**
   * GET /api/v1/users/:id/history
   * Get user history with pagination and filtering
   */
  /**
 * GET /api/v1/users/:id/history
 * Get user history with pagination and filtering
 */
  async getUserHistory(c) {
    try {
      const userId = c.req.param("id");
      const currentUser = c.get("user");
      const userPermissions = c.get("userPermissions") || [];
  
      const has = (perm) => userPermissions.includes(perm);
      const isSelf = currentUser._id.toString() === userId;
  
      // ===============================
      // LOAD TARGET USER
      // ===============================
      const objectiveUser = await User.findById(userId).lean();
      if (!objectiveUser) {
        return c.json({
          success: false,
          error: { message: "User not found", code: "USER_NOT_FOUND" },
        }, 404);
      }
  
      // ===============================
      // RESOLVE DIVISION (ONLY IF NEEDED)
      // ===============================
      let managerDivisionId = null;
  
      if (has("user:view_history:own_division") || has("user:view_salary:own_division")) {
        const division = await Division.findOne({ manager_id: currentUser._id })
          .select("_id")
          .lean();
  
        if (!division) {
          return c.json({
            success: false,
            error: { message: "Division not found", code: "DIVISION_NOT_FOUND" },
          }, 404);
        }
  
        managerDivisionId = division._id.toString();
      }
  
      // ===============================
      // HISTORY PERMISSION CHECK
      // ===============================
      let canViewHistory = false;
  
      if (has("user:view_history:any")) {
        canViewHistory = true;
      } else if (
        has("user:view_history:own_division") &&
        managerDivisionId &&
        objectiveUser.division_id?.toString() === managerDivisionId
      ) {
        canViewHistory = true;
      } else if (has("user:view_history:self") && isSelf) {
        canViewHistory = true;
      }
  
      if (!canViewHistory) {
        return c.json({ error: "Access Denied" }, 403);
      }
  
      // ===============================
      // SALARY PERMISSION CHECK
      // ===============================
      let canViewSalary = false;
  
      if (has("user:view_salary:any")) {
        canViewSalary = true;
      } else if (
        has("user:view_salary:own_division") &&
        managerDivisionId &&
        objectiveUser.division_id?.toString() === managerDivisionId
      ) {
        canViewSalary = true;
      } else if (has("user:view_salary:self") && isSelf) {
        canViewSalary = true;
      }
  
      // ===============================
      // PAGINATION
      // ===============================
      const page = parseInt(c.req.query("page[number]")) || 1;
      const limit = parseInt(c.req.query("page[size]")) || 10;
      const skip = (page - 1) * limit;
  
      // ===============================
      // FILTERS
      // ===============================
      const filters = { user_id: userId };
  
      const eventType = c.req.query("filter[event_type]");
      if (eventType) {
        filters.event_type = eventType;
      }
  
      // salary_change disembunyikan kalau tidak punya izin
      if (!canViewSalary) {
        if (filters.event_type === "salary_change") {
          return c.json({
            success: true,
            data: [],
            meta: {
              pagination: {
                page,
                page_size: limit,
                total_items: 0,
                total_pages: 0,
              },
            },
          });
        }
  
        filters.event_type = { $ne: "salary_change" };
      }
  
      // ===============================
      // QUERY DB
      // ===============================
      const [history, total] = await Promise.all([
        EmployeeHistory.find(filters)
          .populate("old_role", "name")
          .populate("new_role", "name")
          .populate("old_division", "name")
          .populate("new_division", "name")
          .populate("created_by", "full_name email")
          .sort({ effective_date: -1, created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
  
        EmployeeHistory.countDocuments(filters),
      ]);
  
      // ===============================
      // MASK SALARY FIELD
      // ===============================
      const data = history.map((item) => {
        if (!canViewSalary) {
          delete item.old_salary;
          delete item.new_salary;
          return item;
        }
  
        return {
          ...item,
          old_salary: item.old_salary?.toString() || null,
          new_salary: item.new_salary?.toString() || null,
        };
      });
  
      return c.json({
        success: true,
        data,
        meta: {
          pagination: {
            page,
            page_size: limit,
            total_items: total,
            total_pages: Math.ceil(total / limit),
          },
        },
      });
  
    } catch (error) {
      console.error("getUserHistory error:", error);
      return c.json({
        success: false,
        error: {
          message: error.message,
          code: "USER_HISTORY_ERROR",
        },
      }, 500);
    }
  }
  


  async changePassword(c) {
    try {
      const userId = c.req.param("id");
      const currentUser = c.get("user");
      const { currentPassword, newPassword } = await c.req.json();

      if (!currentPassword || !newPassword) {
        return c.json({
          success: false,
          error: {
            message: "Current password and new password are required",
            code: "MISSING_FIELDS",
          },
        }, 400);
      }

      if (newPassword.length < 8) {
        return c.json({
          success: false,
          error: {
            message: "New password must be at least 8 characters long",
            code: "INVALID_PASSWORD_LENGTH",
          },
        }, 400);
      }

      const currentPermission = c.get("currentPermission");
      const canChangeOthers = currentPermission === "user:change_password:any";

      if (!canChangeOthers && currentUser._id.toString() !== userId) {
        return c.json({
          success: false,
          error: {
            message: "You can only change your own password",
            code: "ACCESS_DENIED",
          },
        }, 403);
      }

      const user = await User.findById(userId);
      if (!user) {
        return c.json({
          success: false,
          error: {
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
        }, 404);
      }

      // Verifikasi password (hanya kalau ubah milik sendiri)
      if (currentUser._id.toString() === userId) {
        const isPasswordValid = await argon2.verify(user.password, currentPassword);
        if (!isPasswordValid) {
          return c.json({
            success: false,
            error: {
              message: "Current password is incorrect",
              code: "INVALID_CURRENT_PASSWORD",
            },
          }, 401);
        }
      }

      // Hash password baru
      const hashedPassword = await argon2.hash(newPassword);

      const oldUpdatedAt = user.updated_at;
      user.password = hashedPassword;
      user.updated_at = new Date();
      await user.save();

      // Log audit (don't log actual password, just that it was changed)
      await logAudit(
        c,
        "password_change",
        "user",
        userId,
        { password_changed_at: oldUpdatedAt },
        { password_changed_at: user.updated_at, changed_by: currentUser._id.toString() === userId ? "self" : "admin" }
      );

      return c.json({
        success: true,
        message: "Password changed successfully",
        data: {
          user_id: userId,
          updated_at: user.updated_at,
        },
      });
    } catch (error) {
      console.error("Change password error:", error);

      if (error.name === "CastError") {
        return c.json({
          success: false,
          error: {
            message: "Invalid user ID format",
            code: "INVALID_USER_ID",
          },
        }, 400);
      }

      return c.json({
        success: false,
        error: {
          message: error.message || "Failed to change password",
          code: "PASSWORD_CHANGE_ERROR",
        },
      }, 500);
    }
  }

  /**
   * GET /api/v1/users/:id/salary
   * Get user salary from Salary model
   */
  async getUserSalary(c) {
    try {
      const userId = c.req.param("id");
      const currentUser = c.get("user");
      const currentPermission = c.get("currentPermission");

      const targetUser = await User.findById(userId)
        .populate("role_id", "name")
        .populate("division_id", "name")
        .select("full_name email division_id role_id");

      if (!targetUser) {
        return c.json({
          success: false,
          error: {
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
        }, 404);
      }

      // Check permission
      let canView = false;
      if (currentPermission === "user:view_salary:any") {
        canView = true;
      } else if (currentPermission === "user:view_salary:own_division") {
        const userDivisionId = await Division.findOne({manager_id: currentUser._id});
        const targetDivisionId = targetUser?.division_id?.toString();
        if (userDivisionId && targetDivisionId && userDivisionId._id.toString() === targetDivisionId.toString()) {
          canView = true;
        }
      } else if (currentPermission === "user:view_salary:self") {
        if (currentUser._id.toString() === userId) {
          canView = true;
        }
      }
      

      if (!canView) {
        return c.json({
          success: false,
          error: {
            message: "Forbidden: Access denied",
            code: "ACCESS_DENIED",
          },
        }, 403);
      }

      // Get salary from Salary model
      const salary = await Salary.findOne({ 
        user_id: userId,
        status: "active"
      }).lean();

      if (!salary) {
        return c.json({
          success: true,
          data: {
            user_id: targetUser._id,
            full_name: targetUser.full_name,
            email: targetUser.email,
            division: targetUser.division_id?.name || null,
            role: targetUser.role_id?.name || null,
            salary: null,
            salary_data: null,
          },
        });
      }

      return c.json({
        success: true,
        data: {
          user_id: targetUser._id,
          full_name: targetUser.full_name,
          email: targetUser.email,
          division: targetUser.division_id?.name || null,
          role: targetUser.role_id?.name || null,
          salary: salary.take_home_pay?.toString() || null, // Backward compatibility
          salary_data: {
            _id: salary._id,
            base_salary: salary.base_salary?.toString() || null,
            currency: salary.currency,
            allowances: salary.allowances?.map(a => ({
              name: a.name,
              amount: a.amount?.toString() || null,
            })) || [],
            deductions: salary.deductions?.map(d => ({
              name: d.name,
              amount: d.amount?.toString() || null,
              category: d.category,
            })) || [],
            total_allowance: salary.total_allowance?.toString() || null,
            total_deduction: salary.total_deduction?.toString() || null,
            take_home_pay: salary.take_home_pay?.toString() || null,
            status: salary.status,
            bank_account: salary.bank_account,
            note: salary.note,
          },
        },
      });
    } catch (error) {
      console.error("Get user salary error:", error);
      if (error.name === "CastError") {
        return c.json({
          success: false,
          error: {
            message: "Invalid user ID format",
            code: "INVALID_USER_ID",
          },
        }, 400);
      }
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "SALARY_FETCH_ERROR",
        },
      }, 500);
    }
  }

  /**
   * PATCH /api/v1/users/:id/salary
   * Update user salary in Salary model
   */
  async updateUserSalary(c) {
    try {
      const userId = c.req.param("id");
      const currentUser = c.get("user");
      const currentPermission = c.get("currentPermission");
      const body = await c.req.json();
      const { 
        base_salary, 
        currency = "IDR", 
        allowances = [], 
        deductions = [],
        bank_account,
        note,
        reason, 
        effective_date 
      } = body;

      // Validate base_salary
      if (!base_salary || base_salary <= 0) {
        return c.json({
          success: false,
          error: {
            message: "base_salary is required and must be greater than 0",
            code: "VALIDATION_ERROR",
          },
        }, 400);
      }

      // Check permission
      const userPerms = currentUser?.role_id?.permissions || [];
      let canUpdate = false;

      if (userPerms.includes("user:update_salary:any")) {
        canUpdate = true;
      } else if (userPerms.includes("user:update_salary:own_division")) {
        const targetUser = await User.findById(userId).select("division_id");
        if (targetUser) {
          const division = await Division.findOne({ manager_id: currentUser._id });
          const targetDivisionId = targetUser?.division_id?.toString();
          if (division && targetDivisionId && division._id.toString() === targetDivisionId) {
            canUpdate = true;
          }
        }
      }

      if (!canUpdate) {
        return c.json({
          success: false,
          error: {
            message: "Forbidden: You don't have permission to update salary",
            code: "ACCESS_DENIED",
          },
        }, 403);
      }

      // Get existing user
      const existingUser = await User.findById(userId);
      if (!existingUser) {
        return c.json({
          success: false,
          error: {
            message: "User not found",
            code: "USER_NOT_FOUND",
          },
        }, 404);
      }

      // Get existing salary
      const existingSalary = await Salary.findOne({ user_id: userId /*, status: "active" */});
      const oldTakeHomePay = existingSalary?.take_home_pay;

      // Calculate totals
      const totalAllowance = allowances.reduce((sum, a) => {
        return sum + (parseFloat(a.amount) || 0);
      }, 0);
      const totalDeduction = deductions.reduce((sum, d) => {
        return sum + (parseFloat(d.amount) || 0);
      }, 0);
      const takeHomePay = parseFloat(base_salary) + totalAllowance - totalDeduction;

      // Update or create salary record
      const salaryData = {
        user_id: userId,
        base_salary: mongoose.Types.Decimal128.fromString(base_salary.toString()),
        currency: currency,
        allowances: allowances.map(a => ({
          name: a.name,
          amount: mongoose.Types.Decimal128.fromString(a.amount.toString()),
        })),
        deductions: deductions.map(d => ({
          name: d.name,
          amount: mongoose.Types.Decimal128.fromString(d.amount.toString()),
          category: d.category || "other",
        })),
        total_allowance: mongoose.Types.Decimal128.fromString(totalAllowance.toString()),
        total_deduction: mongoose.Types.Decimal128.fromString(totalDeduction.toString()),
        take_home_pay: mongoose.Types.Decimal128.fromString(takeHomePay.toString()),
        status: "active",
        bank_account: bank_account || existingSalary?.bank_account,
        note: note || existingSalary?.note || "",
      };

      let updatedSalary;
      if (existingSalary) {
        updatedSalary = await Salary.findOneAndUpdate(
          { user_id: userId },
          {
            ...salaryData,
            // status: "active",
          },
          { new: true, upsert: true }
        );
        
      } else {
        updatedSalary = await Salary.create(salaryData);
      }

      // Create history record
      await EmployeeHistory.create({
        user_id: userId,
        event_type: "salary_change",
        old_salary: oldTakeHomePay,
        new_salary: updatedSalary.take_home_pay,
        effective_date: effective_date ? new Date(effective_date) : new Date(),
        reason: reason || "Salary update",
        notes: `Salary updated from ${oldTakeHomePay ? oldTakeHomePay.toString() : "null"} to ${takeHomePay}`,
        created_by: currentUser._id,
      });

      // Log audit
      await logAudit(
        c,
        "salary_update",
        "user",
        userId,
        {
          salary_id: existingSalary?._id || null,
          old_take_home_pay: oldTakeHomePay ? oldTakeHomePay.toString() : null,
        },
        {
          salary_id: updatedSalary._id,
          new_take_home_pay: takeHomePay.toString(),
          base_salary: base_salary.toString(),
          effective_date: effective_date || new Date(),
        }
      );

      return c.json({
        success: true,
        message: "Salary updated successfully",
        data: {
          user_id: userId,
          old_salary: oldTakeHomePay ? oldTakeHomePay.toString() : null,
          new_salary: takeHomePay.toString(),
          salary_data: {
            _id: updatedSalary._id,
            base_salary: updatedSalary.base_salary.toString(),
            currency: updatedSalary.currency,
            take_home_pay: updatedSalary.take_home_pay.toString(),
          },
        },
      });
    } catch (error) {
      console.error("Update user salary error:", error);
      if (error.name === "CastError") {
        return c.json({
          success: false,
          error: {
            message: "Invalid user ID format",
            code: "INVALID_USER_ID",
          },
        }, 400);
      }
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "SALARY_UPDATE_ERROR",
        },
      }, 500);
    }
  }

  /**
   * GET /api/v1/users/pending
   * Get all pending users for HR approval
   */
  async getPendingUsers(c) {
    try {
      const currentUser = c.get("user");
      const userPermissions = currentUser?.role_id?.permissions || [];

      // Check permission - HR should have user:read:any or user:create permission
      const hasPermission = userPermissions.includes("user:read:any") || 
                           userPermissions.includes("user:create") ||
                           userPermissions.includes("user:update");

      if (!hasPermission) {
        return c.json(
          {
            success: false,
            error: {
              message: "Access denied",
              code: "PERMISSION_ERROR",
            },
          },
          403
        );
      }

      const page = parseInt(c.req.query("page[number]")) || 1;
      const limit = parseInt(c.req.query("page[size]")) || 10;
      const skip = (page - 1) * limit;

      const filters = { status: "pending" };

      // Optional search
      const search = c.req.query("search");
      if (search && search.trim() !== "") {
        filters.$text = { $search: search.trim() };
      }

      const [users, total] = await Promise.all([
        User.find(filters)
          .populate("role_id", "name hierarchy_level")
          .populate("division_id", "name")
          .select("-password")
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        User.countDocuments(filters),
      ]);

      return c.json({
        success: true,
        data: users,
        meta: {
          pagination: {
            page,
            page_size: limit,
            total_items: total,
            total_pages: Math.ceil(total / limit),
          },
        },
      });
    } catch (error) {
      console.error("getPendingUsers error:", error);
      return c.json(
        {
          success: false,
          error: {
            message: error.message,
            code: "PENDING_USERS_ERROR",
          },
        },
        500
      );
    }
  }

  /**
   * POST /api/v1/users/:id/approve
   * HR approve user: update status to active, set employment_type, generate employee_code, create salary
   */
  async approveUser(c) {
    try {
      const currentUser = c.get("user");
      const userPermissions = currentUser?.role_id?.permissions || [];

      // Check permission
      const hasPermission = userPermissions.includes("user:read:any") || 
                           userPermissions.includes("user:create") ||
                           userPermissions.includes("user:update");

      if (!hasPermission) {
        return c.json(
          {
            success: false,
            error: {
              message: "Access denied",
              code: "PERMISSION_ERROR",
            },
          },
          403
        );
      }

      const userId = c.req.param("id");
      const body = await c.req.json();
      const { employment_type, base_salary, currency = "IDR", allowances = [], deductions = [], /*bpjs = {},*/ note = "", hire_date, expired_date } = body;

      // Validation
      if (!employment_type) {
        return c.json(
          {
            success: false,
            error: {
              message: "employment_type is required",
              code: "VALIDATION_ERROR",
            },
          },
          400
        );
      }

      if (!base_salary || base_salary <= 0) {
        return c.json(
          {
            success: false,
            error: {
              message: "base_salary is required and must be greater than 0",
              code: "VALIDATION_ERROR",
            },
          },
          400
        );
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              message: "User not found",
              code: "USER_NOT_FOUND",
            },
          },
          404
        );
      }

      if (user.status !== "pending") {
        return c.json(
          {
            success: false,
            error: {
              message: `User status is ${user.status}, not pending`,
              code: "INVALID_STATUS",
            },
          },
          400
        );
      }

      // Generate employee code
      const { generateEmployeeCode } = await import("../utils/employeeCode.js");
      const employeeCode = await generateEmployeeCode();

      // Update user
      user.status = "active";
      user.employment_type = employment_type;
      user.employee_code = employeeCode;
      user.hire_date = hire_date ? new Date(hire_date) : new Date();
      if (expired_date && employment_type !== "full-time") {
        user.expired_date = new Date(expired_date);
      }
      await user.save();

      // Calculate totals for salary
      const totalAllowance = allowances.reduce((sum, a) => {
        return sum + (parseFloat(a.amount) || 0);
      }, 0);
      const totalDeduction = deductions.reduce((sum, d) => {
        return sum + (parseFloat(d.amount) || 0);
      }, 0);
      const takeHomePay = parseFloat(base_salary) + totalAllowance - totalDeduction;

      // Create salary record
      const salaryData = {
        user_id: user._id,
        base_salary: mongoose.Types.Decimal128.fromString(base_salary.toString()),
        currency: currency,
        allowances: allowances.map(a => ({
          name: a.name,
          amount: mongoose.Types.Decimal128.fromString(a.amount.toString()),
        })),
        deductions: deductions.map(d => ({
          name: d.name,
          amount: mongoose.Types.Decimal128.fromString(d.amount.toString()),
          category: d.category || "other",
        })),
        total_allowance: mongoose.Types.Decimal128.fromString(totalAllowance.toString()),
        total_deduction: mongoose.Types.Decimal128.fromString(totalDeduction.toString()),
        take_home_pay: mongoose.Types.Decimal128.fromString(takeHomePay.toString()),
        status: "active",
        note: note || "",
      };

      const salary = await Salary.create(salaryData);

      // Create employee history
      await EmployeeHistory.create({
        user_id: user._id,
        event_type: "hired",
        new_role: user.role_id,
        new_division: user.division_id || null,
        new_salary: salary.take_home_pay, // Use take_home_pay instead of base_salary
        effective_date: hire_date ? new Date(hire_date) : new Date(),
        notes: "User approved and activated by HR",
        created_by: currentUser._id,
      });

      // Fetch populated user data
      const populatedUser = await User.findById(user._id)
        .populate("role_id", "name description hierarchy_level")
        .populate("division_id", "name")
        .select("-password")
        .lean();

      await logAudit(
        c,
        "user_approve",
        "user",
        user._id,
        { status: "pending" },
        { status: "active", employee_code: employeeCode, employment_type }
      );

      return c.json({
        success: true,
        data: {
          user: populatedUser,
          salary: {
            _id: salary._id,
            base_salary: salary.base_salary.toString(),
            currency: salary.currency,
            take_home_pay: salary.take_home_pay.toString(),
            status: salary.status,
          },
        },
        message: "User approved successfully",
      });
    } catch (error) {
      console.error("approveUser error:", error);

      if (error.name === "CastError") {
        return c.json(
          {
            success: false,
            error: {
              message: "Invalid user ID format",
              code: "INVALID_USER_ID",
            },
          },
          400
        );
      }

      if (error.name === "ValidationError") {
        return c.json(
          {
            success: false,
            error: {
              message: error.message,
              code: "VALIDATION_ERROR",
            },
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Internal server error",
            code: "USER_APPROVE_ERROR",
          },
        },
        500
      );
    }
  }

  /**
   * POST /api/v1/users/:id/reject
   * HR reject user: update status to inactive with reason
   */
  async rejectUser(c) {
    try {
      const currentUser = c.get("user");
      const userPermissions = currentUser?.role_id?.permissions || [];

      // Check permission
      const hasPermission = userPermissions.includes("user:read:any") || 
                           userPermissions.includes("user:create") ||
                           userPermissions.includes("user:update");

      if (!hasPermission) {
        return c.json(
          {
            success: false,
            error: {
              message: "Access denied",
              code: "PERMISSION_ERROR",
            },
          },
          403
        );
      }

      const userId = c.req.param("id");
      const body = await c.req.json();
      const { reason = "" } = body;

      if (!reason || reason.trim() === "") {
        return c.json(
          {
            success: false,
            error: {
              message: "reason is required",
              code: "VALIDATION_ERROR",
            },
          },
          400
        );
      }

      // Find user
      const user = await User.findById(userId);
      if (!user) {
        return c.json(
          {
            success: false,
            error: {
              message: "User not found",
              code: "USER_NOT_FOUND",
            },
          },
          404
        );
      }

      if (user.status !== "pending") {
        return c.json(
          {
            success: false,
            error: {
              message: `User status is ${user.status}, not pending`,
              code: "INVALID_STATUS",
            },
          },
          400
        );
      }

      // Update user status to inactive
      const oldStatus = user.status;
      user.status = "inactive";
      await user.save();

      // Create employee history
      await EmployeeHistory.create({
        user_id: user._id,
        event_type: "status_change",
        old_status: oldStatus,
        new_status: "inactive",
        effective_date: new Date(),
        notes: `User rejected: ${reason}`,
        reason: reason,
        created_by: currentUser._id,
      });

      await logAudit(
        c,
        "user_reject",
        "user",
        user._id,
        { status: "pending" },
        { status: "inactive", reason }
      );

      return c.json({
        success: true,
        message: "User rejected successfully",
        data: {
          user: {
            _id: user._id,
            email: user.email,
            full_name: user.full_name,
            status: user.status,
          },
        },
      });
    } catch (error) {
      console.error("rejectUser error:", error);

      if (error.name === "CastError") {
        return c.json(
          {
            success: false,
            error: {
              message: "Invalid user ID format",
              code: "INVALID_USER_ID",
            },
          },
          400
        );
      }

      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Internal server error",
            code: "USER_REJECT_ERROR",
          },
        },
        500
      );
    }
  }

  /**
 * GET /api/v1/users/salary-report
 * Get salary report with filtering
 */
  async getSalaryReport(c) {
    try {
      const currentUser = c.get("user");
      const userPerms = currentUser?.role_id?.permissions || [];

      const query = c.req.query();
      const { page = 1, limit = 50, division_id, status, search } = query;

      const filters = {};

      // ============================================================
      // 1️⃣ PERMISSION: user:view_salary:any → TAMPILKAN SEMUA
      // ============================================================
      if (userPerms.includes("user:view_salary:any")) {
        // Kalau ANY, tetapi user juga mengirim division_id, gunakan filter manual
        if (division_id && division_id !== "" && division_id !== "null") {
          filters.division_id = division_id;
        }

      } else if (userPerms.includes("user:view_salary:own_division")) {
        // ============================================================
        // 2️⃣ PERMISSION: user:view_salary:own_division
        // Cari division dengan manager_id == currentUser._id
        // ============================================================

        const division = await Division.findOne({
          manager_id: currentUser._id,
        }).select("_id");

        if (!division) {
          // Manager tidak memimpin division manapun → tidak boleh lihat siapapun
          return c.json({
            success: true,
            data: [],
            meta: {
              pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: 0,
                total_pages: 0,
              },
            },
          });
        }

        // filter user dalam division tersebut
        filters.division_id = division._id;
      } else if (userPerms.includes("user:view_salary:self")) {
        filters._id = currentUser._id;
      } else {
        return c.json({
          success: false,
          error: {
            message: "Forbidden: Access denied",
            code: "ACCESS_DENIED",
          },
        }, 403);
      }

      // ============================================================
      // 3️⃣ FILTER TAMBAHAN (status, search)
      // ============================================================

      if (status) filters.status = status;

      if (search) {
        filters.$or = [
          { full_name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const [users, total] = await Promise.all([
        User.find(filters)
          .populate("role_id", "name")
          .populate("division_id", "name")
          .select("full_name email status division_id role_id")
          .sort({ created_at: -1 })
          .skip(skip)
          .limit(parseInt(limit))
          .lean(),
        User.countDocuments(filters),
      ]);

      // Populate salary data
      const usersWithSalary = await populateSalaryForUsers(users);

      const report = usersWithSalary.map((user) => ({
        user_id: user._id,
        full_name: user.full_name,
        email: user.email,
        salary: user.salary || null, // take_home_pay from salary_data
        status: user.status,
        division: user.division_id?.name || null,
        role: user.role_id?.name || null,
      }));

      await logAudit(c, "export", "salary_report", null, null, {
        filters,
        page: parseInt(page),
        limit: parseInt(limit),
        total,
      });

      return c.json({
        success: true,
        data: report,
        meta: {
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            total_pages: Math.ceil(total / parseInt(limit)),
          },
        },
      });
    } catch (error) {
      console.error("Get salary report error:", error);
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Internal server error",
            code: "SALARY_REPORT_ERROR",
          },
        },
        500
      );
    }
  }

}

export default new UserController();