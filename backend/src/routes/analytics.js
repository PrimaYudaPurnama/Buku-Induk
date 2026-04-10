import { Hono } from "hono";
import AnalyticsController from "../controllers/analytics.js";
import { authenticate, authorize } from "../middleware/auth.js";

const analyticsRouter = new Hono();

// GET /api/v1/analytics/workflow-overview
analyticsRouter.get(
  "/workflow-overview",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getWorkflowOverview(c)
);

// GET /api/v1/analytics/workflow-details
analyticsRouter.get(
  "/workflow-details",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getWorkflowDetails(c)
);

// GET /api/v1/analytics/workflow-timeline/:id
analyticsRouter.get(
  "/workflow-timeline/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getWorkflowTimeline(c)
);

// GET /api/v1/analytics/workflow-statistics
analyticsRouter.get(
  "/workflow-statistics",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getWorkflowStatistics(c)
);

// GET /api/v1/analytics/attendance-overview
analyticsRouter.get(
  "/attendance-overview",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getAttendanceOverview(c)
);

// GET /api/v1/analytics/attendance-details
analyticsRouter.get(
  "/attendance-details",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getAttendanceDetails(c)
);

// GET /api/v1/analytics/attendance-drilldown
analyticsRouter.get(
  "/attendance-drilldown",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getAttendanceDrilldown(c)
);

// GET /api/v1/analytics/project-overview
analyticsRouter.get(
  "/project-overview",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getProjectOverview(c)
);

// GET /api/v1/analytics/project-details/:id
analyticsRouter.get(
  "/project-details/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_analytics"],
  }),
  (c) => AnalyticsController.getProjectDetails(c)
);

export default analyticsRouter;

