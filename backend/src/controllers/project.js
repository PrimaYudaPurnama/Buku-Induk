import Project from "../models/project.js";
import { logAudit } from "../utils/auditLogger.js";

class ProjectController {
  // ======================
  // GET /api/v1/projects
  // ======================
  async getProjects(c) {
    const {
      page = 1,
      limit = 20,
      sort = "-created_at",
      search = "",
      work_type,
      status,
    } = c.req.query();

    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    if (work_type) query.work_type = work_type;
    if (status) query.status = status;

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const mongoQuery = Project.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort(sort);

    const [data, total] = await Promise.all([
      mongoQuery,
      Project.countDocuments(query),
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
  // GET /api/v1/projects/:id
  // ======================
  async getProjectById(c) {
    const id = c.req.param("id");

    const found = await Project.findById(id);

    if (!found) return c.json({ message: "Not found" }, 404);

    return c.json(found);
  }

  // ======================
  // POST /api/v1/projects
  // ======================
  async createProject(c) {
    const body = await c.req.json();

    const { code, name, work_type, percentage, status, start_date, end_date } = body;

    if (!code || !name || !work_type) {
      return c.json({ message: "code, name, and work_type are required" }, 400);
    }

    if (!["management", "technic"].includes(work_type)) {
      return c.json({ message: "work_type must be 'management' or 'technic'" }, 400);
    }

    if (status && !["planned", "ongoing", "completed", "cancelled"].includes(status)) {
      return c.json({ message: "Invalid status" }, 400);
    }

    if (percentage !== undefined && (percentage < 0 || percentage > 100)) {
      return c.json({ message: "percentage must be between 0 and 100" }, 400);
    }

    try {
      const created = await Project.create({
        code: code.toUpperCase().trim(),
        name: name.trim(),
        work_type,
        percentage: percentage || 0,
        status: status || "planned",
        start_date: start_date || null,
        end_date: end_date || null,
      });

      // Log audit
      await logAudit(
        c,
        "project_create",
        "project",
        created._id,
        null,
        {
          code: created.code,
          name: created.name,
          work_type: created.work_type,
          status: created.status,
        }
      );

      return c.json(created, 201);
    } catch (err) {
      if (err.code === 11000) {
        return c.json({ message: "Project code already exists" }, 409);
      }

      console.error(err);
      return c.json({ error: "Internal error" }, 500);
    }
  }

  // ======================
  // PATCH /api/v1/projects/:id
  // ======================
  async updateProject(c) {
    const id = c.req.param("id");
    const body = await c.req.json();

    if (body.work_type && !["management", "technic"].includes(body.work_type)) {
      return c.json({ message: "work_type must be 'management' or 'technic'" }, 400);
    }

    if (body.status && !["planned", "ongoing", "completed", "cancelled"].includes(body.status)) {
      return c.json({ message: "Invalid status" }, 400);
    }

    if (body.percentage !== undefined && (body.percentage < 0 || body.percentage > 100)) {
      return c.json({ message: "percentage must be between 0 and 100" }, 400);
    }

    try {
      // Get old data before update
      const existingProject = await Project.findById(id);
      if (!existingProject) return c.json({ message: "Not found" }, 404);

      const oldData = existingProject.toObject();

      // Prepare update data
      const updateData = {};
      if (body.code) updateData.code = body.code.toUpperCase().trim();
      if (body.name) updateData.name = body.name.trim();
      if (body.work_type) updateData.work_type = body.work_type;
      if (body.percentage !== undefined) updateData.percentage = body.percentage;
      if (body.status) updateData.status = body.status;
      if (body.start_date !== undefined) updateData.start_date = body.start_date || null;
      if (body.end_date !== undefined) updateData.end_date = body.end_date || null;

      const updated = await Project.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!updated) return c.json({ message: "Not found" }, 404);

      // Log audit
      await logAudit(
        c,
        "project_update",
        "project",
        id,
        oldData,
        updated.toObject()
      );

      return c.json(updated);
    } catch (err) {
      if (err.code === 11000) {
        return c.json({ message: "Project code already exists" }, 409);
      }

      console.error(err);
      return c.json({ error: "Internal error" }, 500);
    }
  }

  // ======================
  // DELETE /api/v1/projects/:id
  // ======================
  async deleteProject(c) {
    const id = c.req.param("id");

    // Get project data before deletion
    const project = await Project.findById(id);
    if (!project) return c.json({ message: "Not found" }, 404);

    const projectData = project.toObject();

    const deleted = await Project.findByIdAndDelete(id);

    if (!deleted) return c.json({ message: "Not found" }, 404);

    // Log audit
    await logAudit(
      c,
      "project_delete",
      "project",
      id,
      projectData,
      { deleted: true }
    );

    return c.json({ message: "Project deleted" });
  }
}

export default new ProjectController();
