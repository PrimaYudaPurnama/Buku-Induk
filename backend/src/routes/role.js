import { Hono } from "hono";
import RoleController from "../controllers/role.js";
import { authenticate, authorize } from "../middleware/auth.js";

const roleRouter = new Hono();

// GET /api/v1/roles/permissions - Authenticated users can view catalog
roleRouter.get(
  "/permissions",
  authenticate(),
  (c) => RoleController.getPermissionCatalog(c)
);

// GET /api/v1/roles - Anyone authenticated can view roles
roleRouter.get(
  "/",
  authenticate(),
  (c) => RoleController.getRoles(c)
);

// GET /api/v1/roles/:id - Anyone authenticated can view role detail
roleRouter.get(
  "/:id",
  authenticate(),
  (c) => RoleController.getRoleById(c)
);

// POST /api/v1/roles - Only Superadmin can create roles
roleRouter.post(
  "/",
  authenticate(),
  authorize({
    permissions: ["system:manage_roles"],
  }),
  (c) => RoleController.createRole(c)
);

// PATCH /api/v1/roles/:id - Only Superadmin can update roles
roleRouter.patch(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_roles"],
  }),
  (c) => RoleController.updateRole(c)
);

// DELETE /api/v1/roles/:id - Only Superadmin can delete roles
roleRouter.delete(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_roles"],
  }),
  (c) => RoleController.deleteRole(c)
);

export default roleRouter;

