import Role from "../models/role.js";
import User from "../models/user.js";
import { logAudit } from "../utils/auditLogger.js";
import { buildPermissionCatalog } from "../lib/permissions.js";

class RoleController {
  /**
   * GET /api/v1/roles/permissions
   * Return consolidated permission catalog (base + existing role permissions)
   */
  static async getPermissionCatalog(c) {
    try {
      const distinctPerms = await Role.distinct("permissions");
      const catalog = buildPermissionCatalog(distinctPerms);

      return c.json({
        success: true,
        data: catalog,
      });
    } catch (error) {
      console.error("Get permission catalog error:", error);
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "PERMISSION_FETCH_ERROR",
        },
      }, 500);
    }
  }

  /**
   * GET /api/v1/roles
   * List all roles
   */
  static async getRoles(c) {
    try {
      const currentUser = c.get("user");

      const isSuperAdmin = currentUser?.role_id?.hierarchy_level === 1; 

      const query = c.req.query();
      const { search } = query;

      const filter = {};
      if (search) {
        filter.$or = [
          { name: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ];
      }

      if (!isSuperAdmin) {
        filter.hierarchy_level = { $ne: 1 };
      }

      const roles = await Role.find(filter)
        .sort({ hierarchy_level: 1, name: 1 })
        .lean();

      return c.json({
        success: true,
        data: roles,
      });
    } catch (error) {
      console.error("Get roles error:", error);
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "ROLE_FETCH_ERROR",
        },
      }, 500);
    }
  }

  /**
   * GET /api/v1/roles/:id
   * Get role by ID
   */
  static async getRoleById(c) {
    try {
      const roleId = c.req.param("id");

      const role = await Role.findById(roleId).lean();

      if (!role) {
        return c.json({
          success: false,
          error: {
            message: "Role not found",
            code: "ROLE_NOT_FOUND",
          },
        }, 404);
      }

      return c.json({
        success: true,
        data: role,
      });
    } catch (error) {
      console.error("Get role by ID error:", error);
      if (error.name === "CastError") {
        return c.json({
          success: false,
          error: {
            message: "Invalid role ID format",
            code: "INVALID_ROLE_ID",
          },
        }, 400);
      }
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "ROLE_FETCH_ERROR",
        },
      }, 500);
    }
  }

  /**
   * POST /api/v1/roles
   * Create new role
   */
  static async createRole(c) {
    try {
      const body = await c.req.json();
      const { name, description, permissions, hierarchy_level } = body;

      // Validation
      if (!name || !hierarchy_level) {
        return c.json({
          success: false,
          error: {
            message: "Name and hierarchy_level are required",
            code: "VALIDATION_ERROR",
          },
        }, 400);
      }

      // Check if role name already exists
      const existingRole = await Role.findOne({ name });
      if (existingRole) {
        return c.json({
          success: false,
          error: {
            message: "Role name already exists",
            code: "ROLE_EXISTS",
          },
        }, 409);
      }

      // Create role
      const newRole = await Role.create({
        name,
        description: description || "",
        permissions: permissions || [],
        hierarchy_level: parseInt(hierarchy_level),
      });

      await logAudit(c, "role_create", "role", newRole._id, null, newRole);

      return c.json({
        success: true,
        data: newRole,
        message: "Role created successfully",
      }, 201);
    } catch (error) {
      console.error("Create role error:", error);
      if (error.name === "ValidationError") {
        return c.json({
          success: false,
          error: {
            message: error.message,
            code: "VALIDATION_ERROR",
          },
        }, 400);
      }
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "ROLE_CREATE_ERROR",
        },
      }, 500);
    }
  }

  /**
   * PATCH /api/v1/roles/:id
   * Update role
   */
  static async updateRole(c) {
    try {
      const roleId = c.req.param("id");
      const body = await c.req.json();
      const { name, description, permissions, hierarchy_level } = body;

      // Find existing role
      const existingRole = await Role.findById(roleId);
      if (!existingRole) {
        return c.json({
          success: false,
          error: {
            message: "Role not found",
            code: "ROLE_NOT_FOUND",
          },
        }, 404);
      }

      // Check if name is being changed and if new name already exists
      if (name && name !== existingRole.name) {
        const nameExists = await Role.findOne({ name, _id: { $ne: roleId } });
        if (nameExists) {
          return c.json({
            success: false,
            error: {
              message: "Role name already exists",
              code: "ROLE_EXISTS",
            },
          }, 409);
        }
      }

      // Prepare update data
      const updateData = {};
      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (permissions !== undefined) updateData.permissions = permissions;
      if (hierarchy_level !== undefined) updateData.hierarchy_level = parseInt(hierarchy_level);

      // Update role
      const oldSnapshot = existingRole.toObject();
      const updatedRole = await Role.findByIdAndUpdate(
        roleId,
        { $set: updateData },
        { new: true, runValidators: true }
      ).lean();

      await logAudit(
        c,
        "role_update",
        "role",
        roleId,
        oldSnapshot,
        updatedRole
      );

      return c.json({
        success: true,
        data: updatedRole,
        message: "Role updated successfully",
      });
    } catch (error) {
      console.error("Update role error:", error);
      if (error.name === "CastError") {
        return c.json({
          success: false,
          error: {
            message: "Invalid role ID format",
            code: "INVALID_ROLE_ID",
          },
        }, 400);
      }
      if (error.name === "ValidationError") {
        return c.json({
          success: false,
          error: {
            message: error.message,
            code: "VALIDATION_ERROR",
          },
        }, 400);
      }
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "ROLE_UPDATE_ERROR",
        },
      }, 500);
    }
  }

  /**
   * DELETE /api/v1/roles/:id
   * Delete role
   */
  static async deleteRole(c) {
    try {
      const roleId = c.req.param("id");

      // Find role
      const role = await Role.findById(roleId);
      if (!role) {
        return c.json({
          success: false,
          error: {
            message: "Role not found",
            code: "ROLE_NOT_FOUND",
          },
        }, 404);
      }

      // Check if role is still being used by any user
      const usersWithRole = await User.countDocuments({ role_id: roleId });
      if (usersWithRole > 0) {
        return c.json({
          success: false,
          error: {
            message: `Cannot delete role. ${usersWithRole} user(s) still have this role. Please reassign users to another role first.`,
            code: "ROLE_IN_USE",
          },
        }, 409);
      }

      // Delete role
      await Role.findByIdAndDelete(roleId);

      return c.json({
        success: true,
        message: "Role deleted successfully",
      });
    } catch (error) {
      console.error("Delete role error:", error);
      if (error.name === "CastError") {
        return c.json({
          success: false,
          error: {
            message: "Invalid role ID format",
            code: "INVALID_ROLE_ID",
          },
        }, 400);
      }
      return c.json({
        success: false,
        error: {
          message: error.message || "Internal server error",
          code: "ROLE_DELETE_ERROR",
        },
      }, 500);
    }
  }
}

export default RoleController;

