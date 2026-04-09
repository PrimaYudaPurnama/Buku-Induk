import WeeklySchedule from "../models/weeklySchedule.js";
import WorkDay from "../models/workDay.js";

// ENV defaults
const DEFAULT_WEEKDAY_IN = process.env.DEFAULT_WEEKDAY_CHECKIN || "08:00";
const DEFAULT_WEEKDAY_OUT = process.env.DEFAULT_WEEKDAY_CHECKOUT || "16:00";
const DEFAULT_SATURDAY_IN = process.env.DEFAULT_SATURDAY_CHECKIN || "08:00";
const DEFAULT_SATURDAY_OUT = process.env.DEFAULT_SATURDAY_CHECKOUT || "12:00";

const defaultForDOW = (dow) => {
  if (dow === 0) return { is_working_day: false, check_in: null, check_out: null };
  if (dow === 6) return { is_working_day: true, check_in: DEFAULT_SATURDAY_IN, check_out: DEFAULT_SATURDAY_OUT };
  return { is_working_day: true, check_in: DEFAULT_WEEKDAY_IN, check_out: DEFAULT_WEEKDAY_OUT };
};

const normalizeDateOnly = (date) => {
  const d = new Date(date);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
};

class ScheduleController {
  // WEEKLY SCHEDULE
  async getWeeklySchedule(c) {
    try {
      const docs = await WeeklySchedule.find({}).sort({ day_of_week: 1 }).lean();
      return c.json({ success: true, data: docs });
    } catch (error) {
      return c.json({ success: false, error: { message: error.message || "Failed to fetch weekly schedule" } }, 500);
    }
  }

  async upsertWeeklyDay(c) {
    try {
      const dowParam = c.req.param("dow");
      const day_of_week = Number(dowParam);
      if (Number.isNaN(day_of_week) || day_of_week < 0 || day_of_week > 6) {
        return c.json({ success: false, error: { message: "Invalid day_of_week" } }, 400);
      }
      const body = await c.req.json().catch(() => ({}));
      const payload = {
        is_working_day: typeof body.is_working_day === "boolean" ? body.is_working_day : undefined,
        check_in: typeof body.check_in === "string" || body.check_in === null ? body.check_in : undefined,
        check_out: typeof body.check_out === "string" || body.check_out === null ? body.check_out : undefined,
      };
      const update = { $set: { day_of_week, ...Object.fromEntries(Object.entries(payload).filter(([_, v]) => v !== undefined)) } };
      const doc = await WeeklySchedule.findOneAndUpdate({ day_of_week }, update, { upsert: true, new: true });
      return c.json({ success: true, data: doc });
    } catch (error) {
      return c.json({ success: false, error: { message: error.message || "Failed to update weekly day" } }, 500);
    }
  }

  async seedWeeklyDefaults(c) {
    try {
      const ops = [];
      for (let dow = 0; dow <= 6; dow++) {
        const def = defaultForDOW(dow);
        ops.push({
          updateOne: {
            filter: { day_of_week: dow },
            update: { $setOnInsert: { day_of_week: dow, ...def } },
            upsert: true,
          },
        });
      }
      if (ops.length) await WeeklySchedule.bulkWrite(ops);
      const docs = await WeeklySchedule.find({}).sort({ day_of_week: 1 }).lean();
      return c.json({ success: true, data: docs });
    } catch (error) {
      return c.json({ success: false, error: { message: error.message || "Failed to seed weekly defaults" } }, 500);
    }
  }

  // WORKDAY OVERRIDES
  async getWorkDays(c) {
    try {
      const from = c.req.query("from");
      const to = c.req.query("to");
      if (!from || !to) {
        return c.json({ success: false, error: { message: "from and to (YYYY-MM-DD) are required" } }, 400);
      }
      const start = normalizeDateOnly(new Date(from));
      const end = normalizeDateOnly(new Date(to));
      const docs = await WorkDay.find({ date: { $gte: start, $lte: end } }).sort({ date: 1 }).lean();
      return c.json({ success: true, data: docs });
    } catch (error) {
      return c.json({ success: false, error: { message: error.message || "Failed to fetch workdays" } }, 500);
    }
  }

  async upsertWorkDay(c) {
    try {
      const dateStr = c.req.param("date");
      if (!dateStr) {
        return c.json({ success: false, error: { message: "date (YYYY-MM-DD) is required" } }, 400);
      }
      const nd = normalizeDateOnly(new Date(dateStr));
      const body = await c.req.json().catch(() => ({}));
      const payload = {
        is_override: typeof body.is_override === "boolean" ? body.is_override : true,
        is_working_day: typeof body.is_working_day === "boolean" ? body.is_working_day : undefined,
        is_holiday: typeof body.is_holiday === "boolean" ? body.is_holiday : undefined,
        holiday_name: typeof body.holiday_name === "string" ? body.holiday_name : undefined,
      };
      const update = { $set: { date: nd, ...Object.fromEntries(Object.entries(payload).filter(([_, v]) => v !== undefined)) } };
      const doc = await WorkDay.findOneAndUpdate({ date: nd }, update, { upsert: true, new: true });
      return c.json({ success: true, data: doc });
    } catch (error) {
      return c.json({ success: false, error: { message: error.message || "Failed to update workday" } }, 500);
    }
  }

  async seedWorkDays(c) {
    try {
      const from = c.req.query("from");
      const to = c.req.query("to");
      const daysParam = Number(c.req.query("days") || "30");
      let start;
      let end;
      if (from && to) {
        start = normalizeDateOnly(new Date(from));
        end = normalizeDateOnly(new Date(to));
      } else {
        const days = Number.isNaN(daysParam) ? 30 : Math.max(1, Math.min(daysParam, 365));
        start = normalizeDateOnly(new Date());
        end = normalizeDateOnly(new Date(Date.now() + days * 24 * 3600 * 1000));
      }
      if (end < start) {
        return c.json({ success: false, error: { message: "Invalid range: to must be >= from" } }, 400);
      }

      const weekly = await WeeklySchedule.find({}).lean();
      const weeklyMap = new Map(weekly.map((w) => [w.day_of_week, w]));
      const existing = await WorkDay.find({ date: { $gte: start, $lte: end } }).select({ date: 1 }).lean();
      const have = new Set((existing || []).map((d) => d.date.toISOString()));

      const docs = [];
      let existingCount = 0;
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = new Date(Date.UTC(cursor.getFullYear(), cursor.getMonth(), cursor.getDate())).toISOString();
        if (!have.has(key)) {
          const dow = cursor.getDay();
          const rule = weeklyMap.get(dow);
          const working = !!(rule?.is_working_day && rule?.check_in && rule?.check_out);
          docs.push({
            date: normalizeDateOnly(cursor),
            is_working_day: working,
            is_holiday: !working && dow === 0 ? true : false,
            holiday_name: !working && dow === 0 ? "Minggu" : "",
            is_override: false,
          });
        } else {
          existingCount++;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
      if (docs.length) await WorkDay.insertMany(docs, { ordered: false });
      return c.json({
        success: true,
        data: {
          created: docs.length,
          existing: existingCount,
          from: start.toISOString().slice(0, 10),
          to: end.toISOString().slice(0, 10),
        },
      });
    } catch (error) {
      return c.json({ success: false, error: { message: error.message || "Failed to seed workdays" } }, 500);
    }
  }
}

export default new ScheduleController();

