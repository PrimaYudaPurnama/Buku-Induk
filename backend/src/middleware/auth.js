import jwt from "jsonwebtoken";
import User from "../models/user.js";

export const authenticate = () => {
  return async (c, next) => {
    try {
      const authHeader = c.req.header("Authorization");
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return c.json({ message: "Unauthorized: No token provided" }, 401);
      }

      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).populate("role_id");
      if (!user) {
        return c.json({ message: "Unauthorized: User not found" }, 401);
      }

      c.set("user", user);
      await next();
    } catch (err) {
      console.error(err);
      return c.json({ message: "Unauthorized: Invalid token" }, 401);
    }
  };
};

export const authorize = ({ permissions }) => {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) return c.json({ message: "Unauthorized" }, 401);

    const userPerms = user.role_id?.permissions || [];
    console.log("User perms:", userPerms);
    console.log("Required perms:", permissions);

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

