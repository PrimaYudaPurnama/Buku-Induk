import User from "../models/user.js";

class PublicController {
  static async getUserByEmployeeCode(c) {
    try {
      const { code } = c.req.param();
      if (!code) {
        return c.json({ message: "Employee code is required" }, 400);
      }

      const user = await User.findOne({
        employee_code: code,
        status: { $nin: ["terminated", "pending"] },
      })
        .populate("role_id", "name hierarchy_level")
        .populate("division_id", "name")
        .select(
          "full_name employee_code status profile_photo_url employment_type role_id division_id"
        )
        .lean();

      if (!user) {
        return c.json({ message: "User not found" }, 404);
      }

      return c.json({
        data: {
          full_name: user.full_name,
          employee_code: user.employee_code,
          status: user.status,
          employment_type: user.employment_type,
          profile_photo_url: user.profile_photo_url,
          role: user.role_id
            ? {
                name: user.role_id.name,
                hierarchy_level: user.role_id.hierarchy_level,
              }
            : null,
          division: user.division_id
            ? {
                name: user.division_id.name,
              }
            : null,
        },
      });
    } catch (err) {
      console.error("getUserByEmployeeCode error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }
}

export default PublicController;
