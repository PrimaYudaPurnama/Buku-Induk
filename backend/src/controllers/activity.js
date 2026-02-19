import Activity from "../models/activity.js";
import { logAudit } from "../utils/auditLogger.js";

class ActivityController {
  // ======================
  // GET /api/v1/activities
  // ======================
  async getActivities(c) {
    const {
      page = 1,
      limit = 20,
      sort = "-created_at",
      search = "",
    } = c.req.query();

    const query = {};

    if (search) {
      query.$or = [
        { name_activity: { $regex: search, $options: "i" } },
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const mongoQuery = Activity.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sort);

    const [data, total] = await Promise.all([
      mongoQuery,
      Activity.countDocuments(query),
    ]);

    return c.json({
      page: pageNum,
      limit: limitNum,
      total,
      total_pages: Math.ceil(total / limitNum),
      data,
    });
  }

  // ======================
  // GET /api/v1/activities/:id
  // ======================
  async getActivityById(c) {
    const id = c.req.param("id");

    const found = await Activity.findById(id);

    if (!found) return c.json({ message: "Not found" }, 404);

    return c.json(found);
  }

  // ======================
  // POST /api/v1/activities
  // ======================
  async createActivity(c) {
    const body = await c.req.json();

    const { name_activity } = body;

    if (!name_activity || name_activity.trim() === "") {
      return c.json({ message: "name_activity is required" }, 400);
    }

    try {
      const created = await Activity.create({
        name_activity: name_activity.trim(),
      });

      // Log audit
      await logAudit(
        c,
        "activity_create",
        "activity",
        created._id,
        null,
        {
          name_activity: created.name_activity,
        }
      );

      return c.json(created, 201);
    } catch (err) {
      console.error(err);
      return c.json({ error: "Internal error" }, 500);
    }
  }

  // ======================
  // PATCH /api/v1/activities/:id
  // ======================
  async updateActivity(c) {
    const id = c.req.param("id");
    const body = await c.req.json();

    if (body.name_activity && body.name_activity.trim() === "") {
      return c.json({ message: "name_activity cannot be empty" }, 400);
    }

    try {
      // Get old data before update
      const existingActivity = await Activity.findById(id);
      if (!existingActivity) return c.json({ message: "Not found" }, 404);

      const oldData = existingActivity.toObject();

      // Prepare update data
      const updateData = {};
      if (body.name_activity) {
        updateData.name_activity = body.name_activity.trim();
      }

      const updated = await Activity.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updated) return c.json({ message: "Not found" }, 404);

      // Log audit
      await logAudit(
        c,
        "activity_update",
        "activity",
        id,
        oldData,
        updated.toObject()
      );

      return c.json(updated);
    } catch (err) {
      console.error(err);
      return c.json({ error: "Internal error" }, 500);
    }
  }

  // ======================
  // DELETE /api/v1/activities/:id
  // ======================
  async deleteActivity(c) {
    const id = c.req.param("id");

    // Get activity data before deletion
    const activity = await Activity.findById(id);
    if (!activity) return c.json({ message: "Not found" }, 404);

    const activityData = activity.toObject();

    const deleted = await Activity.findByIdAndDelete(id);

    if (!deleted) return c.json({ message: "Not found" }, 404);

    // Log audit
    await logAudit(
      c,
      "activity_delete",
      "activity",
      id,
      activityData,
      { deleted: true }
    );

    return c.json({ message: "Activity deleted" });
  }
}

export default new ActivityController();
