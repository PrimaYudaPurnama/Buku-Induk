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
      "user:read:any",
      "user:read:own_division",
      "org_chart:read",
    ],
  }),
  (c) => OrgChartController.getOrgChart(c)
);

export default orgChartRouter;


