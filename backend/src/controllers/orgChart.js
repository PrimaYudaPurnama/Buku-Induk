import User from "../models/user.js";
import Role from "../models/role.js";
import Division from "../models/division.js";

class OrgChartController {
  /**
   * GET /api/v1/org-chart
   *
   * Mengembalikan struktur silsilah perusahaan berbasis:
   * - Division (dengan manager & active_general)
   * - User (anggota divisi, role, foto profil)
   * - Role (urutan hierarchy_level untuk pengelompokan di frontend)
   */
  async getOrgChart(c) {
    try {
      // Ambil semua role untuk referensi hierarchy_level
      const roles = await Role.find({})
        .sort({ hierarchy_level: 1, name: 1 })
        .lean();

      const roleMap = new Map(
        roles.map((r) => [r._id.toString(), { _id: r._id, name: r.name, hierarchy_level: r.hierarchy_level }])
      );

      // Ambil semua divisi beserta manager & active_general
      const divisions = await Division.find({})
        .populate("manager_id", "full_name email profile_photo_url role_id")
        .populate("active_general_id", "full_name email profile_photo_url role_id")
        .lean();

      // Ambil semua user aktif (kecuali terminated) beserta role & division
      const users = await User.find({ status: { $ne: "terminated" } })
        .populate("role_id", "name hierarchy_level")
        .populate("division_id", "name")
        .select("full_name email profile_photo_url role_id division_id status")
        .lean();

      // Kelompokkan user berdasarkan division
      const usersByDivision = new Map();
      const unassignedUsers = [];

      for (const user of users) {
        const divisionId = user.division_id?._id?.toString();
        const normalizedUser = {
          _id: user._id,
          full_name: user.full_name,
          email: user.email,
          profile_photo_url: user.profile_photo_url,
          status: user.status,
          role: user.role_id
            ? {
                _id: user.role_id._id,
                name: user.role_id.name,
                hierarchy_level: user.role_id.hierarchy_level,
              }
            : null,
        };

        const userIdStr = user._id.toString();

        const isManagerOrGeneral = divisions.some(d =>
          d.manager_id?._id?.toString() === userIdStr ||
          d.active_general_id?._id?.toString() === userIdStr
        );

        if (!divisionId && !isManagerOrGeneral) {
          unassignedUsers.push(normalizedUser);
          continue;
        }


        if (!usersByDivision.has(divisionId)) {
          usersByDivision.set(divisionId, []);
        }
        usersByDivision.get(divisionId).push(normalizedUser);
      }

      // Susun struktur division dengan manager, active_general, dan members
      const divisionNodes = divisions.map((division) => {
        const divisionId = division._id.toString();
        const rawMembers = usersByDivision.get(divisionId) || [];

        const managerId = division.manager_id?._id?.toString() || null;
        const activeGeneralId = division.active_general_id?._id?.toString() || null;

        const members = rawMembers.filter(
          (u) => u._id.toString() !== managerId && u._id.toString() !== activeGeneralId
        );

        const normalizePerson = (person) => {
          if (!person) return null;

          const role =
            person.role_id && roleMap.get(person.role_id.toString())
              ? roleMap.get(person.role_id.toString())
              : null;

          return {
            _id: person._id,
            full_name: person.full_name,
            email: person.email,
            profile_photo_url: person.profile_photo_url,
            role,
          };
        };

        const manager = normalizePerson(division.manager_id);
        const active_general = normalizePerson(division.active_general_id);

        // Kelompokkan members berdasarkan role.hierarchy_level (untuk tampilan berlapis di frontend)
        const membersByRoleLevel = {};
        for (const m of members) {
          const level = m.role?.hierarchy_level ?? 999;
          const key = String(level);
          if (!membersByRoleLevel[key]) membersByRoleLevel[key] = [];
          membersByRoleLevel[key].push(m);
        }

        // Urutkan setiap grup member berdasarkan nama
        Object.keys(membersByRoleLevel).forEach((lvl) => {
          membersByRoleLevel[lvl].sort((a, b) =>
            String(a.full_name || "").localeCompare(String(b.full_name || ""))
          );
        });

        return {
          _id: division._id,
          name: division.name,
          description: division.description,
          manager,
          active_general,
          members,
          members_by_role_level: membersByRoleLevel,
        };
      });

      const filtered = unassignedUsers
      .map(u => ({
        ...u,
        _level: Number(u.role?.hierarchy_level)
      }))
      .filter(u => u._level >= 5)
      .sort((a, b) => {
        if (a._level !== b._level) return a._level - b._level;
        return String(a.full_name || "").localeCompare(String(b.full_name || ""));
      });

      return c.json({
        success: true,
        data: {
          roles,
          divisions: divisionNodes,
          unassigned_users: filtered,
        },
      });
    } catch (error) {
      console.error("getOrgChart error:", error);
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to build organization chart",
            code: "ORG_CHART_ERROR",
          },
        },
        500
      );
    }
  }
}

export default new OrgChartController();


