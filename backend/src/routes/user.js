import { Hono } from "hono";
import UserController from "../controllers/user.js";
import { authenticate, authorize} from "../middleware/auth.js"

const userRouter = new Hono();

userRouter.get(
  "/pending",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:create", "user:update"],
  }),
  (c) => UserController.getPendingUsers(c)
);

userRouter.post(
  "/:id/approve",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:create", "user:update"],
  }),
  (c) => UserController.approveUser(c)
);

userRouter.post(
  "/:id/reject",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:create", "user:update"],
  }),
  (c) => UserController.rejectUser(c)
);

userRouter.get(
  "/salary-report",
  authenticate(),
  authorize({
    permissions: ["user:export", "user:view_salary:any", "user:view_salary:own_division"],
  }),
  (c) => UserController.getSalaryReport(c)
);
userRouter.get(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self", "dashboard:read"],
  }),             
  (c) => UserController.getUserById(c)
);

userRouter.get(
  "/:id/history",
  authenticate(),
  authorize({
    permissions: ["user:view_history:any", "user:view_history:own_division", "user:view_history:self", "dashboard:read"],
  }),
  (c) => UserController.getUserHistory(c)
);

userRouter.get(
  "/",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self", "dashboard:read"],
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
  authenticate(),
  UserController.changePassword
);

userRouter.get(
  "/:id/salary",
  authenticate(),
  authorize({
    permissions: ["user:view_salary:any", "user:view_salary:own_division", "user:view_salary:self", "dashboard:read"],
  }),
  (c) => UserController.getUserSalary(c)
);

userRouter.patch(
  "/:id/salary",
  authenticate(),
  authorize({
    permissions: ["user:update_salary:any", "user:update_salary:own_division"],
  }),
  (c) => UserController.updateUserSalary(c)
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
