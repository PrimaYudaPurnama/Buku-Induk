import { Hono } from "hono";
import ApprovalController from "../controllers/approval.js";
import { authenticate, authorize, approvalGuard } from "../middleware/auth.js";

const approvalRouter = new Hono();

// GET /api/v1/approvals/mine
// Anyone authenticated can see their own pending approvals
approvalRouter.get(
  "/mine",
  authenticate(),
  (c) => ApprovalController.getMyPendingApprovals(c)
);

// POST /api/v1/approvals/:id/approve
approvalRouter.post(
  "/:id/approve",
  authenticate(),
  approvalGuard(),
  (c) => ApprovalController.approveRequestStep(c)
);

// POST /api/v1/approvals/:id/reject
approvalRouter.post(
  "/:id/reject",
  authenticate(),
  approvalGuard(),
  (c) => ApprovalController.rejectRequestStep(c)
);

export default approvalRouter;

