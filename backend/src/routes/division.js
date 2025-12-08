import { Hono } from "hono";
import DivisionController from "../controllers/division.js";
import { authenticate, authorize} from "../middleware/auth.js"

const divisionRouter = new Hono();

divisionRouter.get(
  "/:id",
  authenticate(),
  (c) => DivisionController.getDivisionById(c)
);

divisionRouter.get(
  "/",
  authenticate(),
  (c) => DivisionController.getDivisions(c)  
);

divisionRouter.post(
  "/",
  authenticate(),
  authorize({
    permissions: ["system:manage_divisions"],
  }),
  (c) => DivisionController.createDivision(c)  
);

divisionRouter.patch(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_divisions"],
  }),
  (c) => DivisionController.updateDivision(c)  
);

divisionRouter.delete(
  "/:id",
  authenticate(),
  authorize({
    permissions: ["system:manage_divisions"],
  }),
  (c) => DivisionController.deleteDivision(c)  
);

export default divisionRouter;
