import { Hono } from "hono";
import ScheduleController from "../controllers/schedule.js";
import { authenticate, authorize } from "../middleware/auth.js";

const scheduleRouter = new Hono();

// Weekly schedule endpoints (admin/HR)
scheduleRouter.get(
  "/weekly",
  authenticate(),
  authorize({ permissions: ["system:manage_weeklyschedule"] }),
  (c) => ScheduleController.getWeeklySchedule(c)
);

scheduleRouter.put(
  "/weekly/:dow",
  authenticate(),
  authorize({ permissions: ["system:manage_weeklyschedule"] }),
  (c) => ScheduleController.upsertWeeklyDay(c)
);

scheduleRouter.post(
  "/weekly/seed",
  authenticate(),
  authorize({ permissions: ["system:manage_weeklyschedule"] }),
  (c) => ScheduleController.seedWeeklyDefaults(c)
);

// WorkDay overrides (admin/HR)
scheduleRouter.get(
  "/workdays",
  authenticate(),
  authorize({ permissions: ["system:manage_workday"] }),
  (c) => ScheduleController.getWorkDays(c)
);

scheduleRouter.put(
  "/workdays/:date",
  authenticate(),
  authorize({ permissions: ["system:manage_workday"] }),
  (c) => ScheduleController.upsertWorkDay(c)
);

scheduleRouter.post(
  "/workdays/seed",
  authenticate(),
  authorize({ permissions: ["system:manage_workday"] }),
  (c) => ScheduleController.seedWorkDays(c)
);

export default scheduleRouter;

