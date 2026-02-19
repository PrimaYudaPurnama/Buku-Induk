import { Hono } from "hono";
import ProjectController from "../controllers/project.js";
import { authenticate, authorize } from "../middleware/auth.js";

const projectRouter = new Hono();

projectRouter.get(
  "/:id",
  authenticate(),
  (c) => ProjectController.getProjectById(c)
);

projectRouter.get(
  "/",
  authenticate(),
  (c) => ProjectController.getProjects(c)
);

projectRouter.post(
  "/",
  authenticate(),
  authorize({
    permissions: ["system:manage_projects"],
  }),
  (c) => ProjectController.createProject(c)
);

projectRouter.patch(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_projects"],
  }),
  (c) => ProjectController.updateProject(c)
);

projectRouter.delete(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_projects"],
  }),
  (c) => ProjectController.deleteProject(c)
);

export default projectRouter;
