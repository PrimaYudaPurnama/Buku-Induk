// routes/authRoutes.js
import { Hono } from "hono";
import AuthController from "../controllers/auth.js";
import { authenticate } from "../middleware/auth.js";

const authRouter = new Hono();

// Public routes
authRouter.post("/login", (c) => AuthController.login(c));
authRouter.post("/password/forgot", (c) => AuthController.forgotPassword(c));

// Protected routes (require authentication)
authRouter.post("/logout", authenticate(), (c) => AuthController.logout(c));
authRouter.get("/me", authenticate(), (c) => AuthController.me(c));
authRouter.get("/check", authenticate(), (c) => AuthController.check(c));
authRouter.post("/refresh", authenticate(), (c) => AuthController.refresh(c));

export default authRouter;