import { Hono } from "hono";
import OrgChartController from "../controllers/orgChart.js";
import { authenticate, authorize } from "../middleware/auth.js";

const orgChartRouter = new Hono();

// GET /api/v1/org-chart
orgChartRouter.get(
  "/",
  authenticate(),
  authorize({
    permissions: [
      "dashboard:read",
      "user:read:any",
      "user:read:own_division",
      "system:manage_analytics",
    ],
  }),
  (c) => OrgChartController.getOrgChart(c)
);

export default orgChartRouter;


