import { Hono } from "hono";
import DocumentController from "../controllers/document.js";
import { authenticate, authorize } from "../middleware/auth.js";

const documentRouter = new Hono();

// POST /api/v1/documents/upload
// Allow user:update, user:create, account:create (for account requests)
documentRouter.post(
  "/upload",
  authenticate(),
  authorize({
    permissions: ["user:update", "user:create", "account:create"],
  }),
  (c) => DocumentController.uploadDocument(c)
);

// POST /api/v1/documents/upload-metadata
// Allow user:update, user:create, account:create
documentRouter.post(
  "/upload-metadata",
  authenticate(),
  authorize({
    permissions: ["user:update", "user:create", "account:create"],
  }),
  (c) => DocumentController.uploadFileMetadata(c)
);

// GET /api/v1/documents/user/:id
documentRouter.get(
  "/user/:id",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self"],
  }),
  (c) => DocumentController.getUserDocuments(c)
);

// GET /api/v1/documents/:id
documentRouter.get(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self"],
  }),
  (c) => DocumentController.getDocumentById(c)
);

// GET /api/v1/documents/user/:id/versions/:type
documentRouter.get(
  "/user/:id/versions/:type",
  authenticate(),
  authorize({
    permissions: ["user:read:any", "user:read:own_division", "user:read:self"],
  }),
  (c) => DocumentController.getDocumentVersions(c)
);

// GET /api/v1/documents/:id/view
// Proxy endpoint to serve document with proper headers
// Note: authenticate is required but authorize is handled in controller for flexibility
documentRouter.get(
  "/:id/view",
  (c) => DocumentController.viewDocument(c)
);

export default documentRouter;

