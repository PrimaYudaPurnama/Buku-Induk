import { Hono } from "hono";
import PublicController from "../controllers/public.js";

const publicRouter = new Hono();

// Public endpoint to verify limited employee information via employee_code
publicRouter.get("/id/:code", (c) => PublicController.getUserByEmployeeCode(c));

export default publicRouter;
