import { Hono } from "hono";
import AccountRequestController from "../controllers/accountRequest.js";
import { authenticate, authorize } from "../middleware/auth.js";

const accountRequestRouter = new Hono();

// POST /api/v1/account-requests
accountRequestRouter.post(
  "/",
  // authenticate(),
  // authorize({
  //   permissions: ["account:create"],
  // }),
  (c) => AccountRequestController.createAccountRequest(c)
);

// GET /api/v1/account-requests/approvable - MUST BE BEFORE /:id
accountRequestRouter.get(
  "/approvable",
  authenticate(),
  (c) => AccountRequestController.getApprovableRequests(c)
);

// GET /api/v1/account-requests/setup/:token - MUST BE BEFORE /:id
// Public endpoint (no auth required) for account setup
accountRequestRouter.get(
  "/setup/:token",
  (c) => AccountRequestController.verifySetupToken(c)
);

// POST /api/v1/account-requests/setup/:token - MUST BE BEFORE /:id
// Public endpoint (no auth required) for submitting account setup form
accountRequestRouter.post(
  "/setup/:token",
  (c) => AccountRequestController.submitAccountSetup(c)
);

// GET /api/v1/account-requests
accountRequestRouter.get(
  "/",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self"],
  }),
  (c) => AccountRequestController.listAccountRequests(c)
);

// GET /api/v1/account-requests/:id
accountRequestRouter.get(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self"],
  }),
  (c) => AccountRequestController.getAccountRequestDetail(c)
);

export default accountRequestRouter;
