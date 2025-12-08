import { Hono } from "hono";
import UserController from "../controllers/user.js";
import { authenticate, authorize} from "../middleware/auth.js"

const userRouter = new Hono();

userRouter.get(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self"],
  }),             
  (c) => UserController.getUserById(c)
);

userRouter.get(
  "/:id/history",
  authenticate(),
  authorize({
    permissions: ["user:view_history:any", "user:view_history:own_division", "user:view_history:self"],
  }),
  (c) => UserController.getUserHistory(c)
);

userRouter.get(
  "/",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self"],
  }),
  (c) => UserController.getUsers(c)  
);

userRouter.post(
  "/",
  authenticate(),
  authorize({
    permissions: ["user:create", "user:create:own_division"],
  }),
  (c) => UserController.createUser(c)  
);

userRouter.patch(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["user:update:any", "user:update:own_division", "user:update"],
  }),
  (c) => UserController.updateUser(c)  
);

userRouter.put(
  "/:id/change-password",
  authenticate,
  UserController.changePassword
);

userRouter.delete(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["user:delete:any", "user:delete:own_division", "user:delete"],
  }),
  (c) => UserController.deleteUser(c)  
);

export default userRouter;
