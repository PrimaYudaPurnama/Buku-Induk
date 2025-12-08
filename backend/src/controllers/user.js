import User from "../models/user.js";
import EmployeeHistory from "../models/employeeHistory.js";
import Division from "../models/division.js";
import argon2 from "argon2";
import user from "../models/user.js";

class UserController {
  /**
   * GET /api/v1/users
   * List users with pagination, filtering, and sorting
   */
  async getUsers(c) {
  try {
    const currentUser = c.get("user");
    const currentPermission = c.get("currentPermission");
    const userPermission = c.get("userPermission");
    console.log("Permission matched:", currentPermission);

    // Pagination
    const page = parseInt(c.req.query("page[number]")) || 1;
    const limit = parseInt(c.req.query("page[size]")) || 10;
    const skip = (page - 1) * limit;

    // Base filters dari query (opsional)
    const filters = {};
    if (c.req.query("filter[division_id]")) filters.division_id = c.req.query("filter[division_id]");
    if (c.req.query("filter[status]")) filters.status = c.req.query("filter[status]");
    if (c.req.query("filter[role_id]")) filters.role_id = c.req.query("filter[role_id]");
    if (c.req.query("search")) filters.$text = { $search: c.req.query("search") };

    if (currentPermission === "user:read:any") {
      // tidak menambah filter apapun (lihat semua)
      console.log("Access: FULL — user:read:any");
    }

    else if (currentPermission === "user:read:own_division") {
      console.log("Access: OWN DIVISION ONLY");
      filters.division_id = currentUser.division_id;
    }

    else if (currentPermission === "user:read:self") {
      console.log("Access: SELF ONLY");
      filters._id = currentUser._id;
    }

    // ------------------------------------------

    // Sorting
    let sort = { created_at: -1 };
    const sortParam = c.req.query("sort");

    if (sortParam) {
      sort = {};
      sortParam.split(",").forEach((field) => {
        if (field.startsWith("-")) sort[field.substring(1)] = -1;
        else sort[field] = 1;
      });
    }

    // Query final
    const [users, total] = await Promise.all([
      User.find(filters)
        .populate("role_id", "name description hierarchy_level")
        .populate("division_id", "name")
        .populate("full_name email")
        .select("-password")
        .sort(sort)
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
    console.error("getUsers error:", error);
    return c.json(
      {
        success: false,
        error: {
          message: error.message || "Internal server error",
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
      console.log("id user: ", userId)

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

      return c.json({
        success: true,
        data: user,
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

      // Create user
      const newUser = await User.create({
        email: data.email,
        password: hashedPassword,
        full_name: data.full_name,
        phone: data.phone || null,
        role_id: data.role_id,
        division_id: data.division_id || null,
        status: data.status || "pending",
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
      });

      // Create history record
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

      return c.json(
        {
          success: true,
          data: populatedUser,
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

      // Prepare update data
      const updateData = {};
      const allowedFields = [
        "full_name", "phone", "role_id", "division_id",
        "status", "hire_date", "termination_date", "profile_photo_url",
        "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
        "address", "city", "state", "postal_code", "country",
        "date_of_birth", "national_id"
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

      if (data.role_id && data.role_id !== existingUser.role_id.toString()) {
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

      return c.json({
        success: true,
        data: updatedUser,
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
  async getUserHistory(c) {
    try {
      const userId = c.req.param("id");
      const currentUser = c.get("user");
      const currentPermission = c.get("currentPermission");

      const objectiveUser = await User.findById(userId);
      if (!objectiveUser) {
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

      let canView = false;

      if (currentPermission === "user:view_history:any") {
        canView = true
      } else if (currentPermission === "user:view_history:own_division" && currentUser.division_id === objectiveUser.division_id){
        canView = true
      } else if(currentPermission === "user:view_history:self" && currentUser._id.toString() === userId){
        canView = true
      }

      if (!canView) return c.json({ error: "Access Denied" }, 403);

      // Pagination
      const page = parseInt(c.req.query("page[number]")) || 1;
      const limit = parseInt(c.req.query("page[size]")) || 10;
      const skip = (page - 1) * limit;

      // Filters
      const filters = { user_id: userId };

      if (c.req.query("filter[event_type]")) {
        filters.event_type = c.req.query("filter[event_type]");
      }

      // Query
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

      // Transform Decimal128 to string for JSON serialization
      const transformedHistory = history.map((item) => ({
        ...item,
        old_salary: item.old_salary ? item.old_salary.toString() : null,
        new_salary: item.new_salary ? item.new_salary.toString() : null,
      }));

      return c.json({
        success: true,
        data: transformedHistory,
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
            code: "USER_HISTORY_ERROR",
          },
        },
        500
      );
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

      user.password = hashedPassword;
      user.updated_at = new Date();
      await user.save();

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


}

export default new UserController();