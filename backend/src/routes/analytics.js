import { Hono } from "hono";
import AnalyticsController from "../controllers/analytics.js";
import { authenticate, authorize } from "../middleware/auth.js";

const analyticsRouter = new Hono();

// GET /api/v1/analytics/workflow-overview
analyticsRouter.get(
  "/workflow-overview",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics", "dashboard:read"],
  }),
  (c) => AnalyticsController.getWorkflowOverview(c)
);

// GET /api/v1/analytics/workflow-details
analyticsRouter.get(
  "/workflow-details",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics", "dashboard:read"],
  }),
  (c) => AnalyticsController.getWorkflowDetails(c)
);

// GET /api/v1/analytics/workflow-timeline/:id
analyticsRouter.get(
  "/workflow-timeline/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics", "dashboard:read"],
  }),
  (c) => AnalyticsController.getWorkflowTimeline(c)
);

// GET /api/v1/analytics/workflow-statistics
analyticsRouter.get(
  "/workflow-statistics",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics", "dashboard:read"],
  }),
  (c) => AnalyticsController.getWorkflowStatistics(c)
);

export default analyticsRouter;

