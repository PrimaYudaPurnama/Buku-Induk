import { Hono } from "hono";
import ActivityController from "../controllers/activity.js";
import { authenticate, authorize } from "../middleware/auth.js";

const activityRouter = new Hono();

activityRouter.get(
  "/:id",
  authenticate(),
  (c) => ActivityController.getActivityById(c)
);

activityRouter.get(
  "/",
  authenticate(),
  (c) => ActivityController.getActivities(c)
);

activityRouter.post(
  "/",
  authenticate(),
  authorize({
    permissions: ["system:manage_activities"],
  }),
  (c) => ActivityController.createActivity(c)
);

activityRouter.patch(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_activities"],
  }),
  (c) => ActivityController.updateActivity(c)
);

activityRouter.delete(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_activities"],
  }),
  (c) => ActivityController.deleteActivity(c)
);

export default activityRouter;
