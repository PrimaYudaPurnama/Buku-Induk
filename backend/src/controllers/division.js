import Division from "../models/division.js";
import User from "../models/user.js";


class DivisionController {
    // ======================
    // GET /api/v1/divisions
    // ======================
    async getDivisions (c) {
        const {
            page = 1,
            limit = 20,
            sort = "-created_at",
            search = "",
            manager_id,
            active_general_id,
            include = "",
        } = c.req.query();

        const query = {};

        if (search) {
            query.$or = [
            { name: { $regex: search, $options: "i" } },
            { description: { $regex: search, $options: "i" } },
            ];
        }

        if (manager_id) query.manager_id = manager_id;
        if (active_general_id) query.active_general_id = active_general_id;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let mongoQuery = Division.find(query)
            .skip(skip)
            .limit(limitNum)
            .sort(sort);

        if (include) {
            const fields = include.split(",").map((x) => x.trim());

            if (fields.includes("manager")) {
            mongoQuery = mongoQuery.populate("manager_id", "full_name email role_id");
            }
            if (fields.includes("active_general")) {
            mongoQuery = mongoQuery.populate("active_general_id", "full_name email role_id");
            }
        }

        const [data, total] = await Promise.all([
            mongoQuery,
            Division.countDocuments(query),
        ]);

        return c.json({
            page: pageNum,
            limit: limitNum,
            total,
            total_pages: Math.ceil(total / limitNum),
            data,
        });
    };

    // ======================
    // GET /api/v1/divisions/:id
    // ======================
    async getDivisionById (c) {
        const id = c.req.param("id");
        const { include = "" } = c.req.query();

        let q = Division.findById(id);

        if (include.includes("manager")) {
            q = q.populate("manager_id", "name email role");
        }
        if (include.includes("active_general")) {
            q = q.populate("active_general_id", "name email role");
        }

        const found = await q;

        if (!found) return c.json({ message: "Not found" }, 404);

        return c.json(found);
        };

    // ======================
    // POST /api/v1/divisions
    // ======================
    async createDivision (c) {
        const body = await c.req.json();

        const { name, description, manager_id, active_general_id } = body;

        if (manager_id) {
            if (!(await User.exists({ _id: manager_id })))
            return c.json({ message: "Invalid manager_id" }, 400);
        }

        if (active_general_id) {
            if (!(await User.exists({ _id: active_general_id })))
            return c.json({ message: "Invalid active_general_id" }, 400);
        }

        try {
            const created = await Division.create({
            name,
            description,
            manager_id: manager_id || null,
            active_general_id: active_general_id || null,
            });

            return c.json(created, 201);
        } catch (err) {
            if (err.code === 11000) {
            return c.json({ message: "Division name already exists" }, 409);
            }

            console.error(err);
            return c.json({ error: "Internal error" }, 500);
        }
    };

    // ======================
    // PUT /api/v1/divisions/:id
    // ======================
    async updateDivision (c) {
        const id = c.req.param("id");
        const body = await c.req.json();

        if (body.manager_id) {
            if (!(await User.exists({ _id: body.manager_id })))
            return c.json({ message: "Invalid manager_id" }, 400);
        }

        if (body.active_general_id) {
            if (!(await User.exists({ _id: body.active_general_id })))
            return c.json({ message: "Invalid active_general_id" }, 400);
        }

        try {
            const updated = await Division.findByIdAndUpdate(id, body, {
            new: true,
            runValidators: true,
            });

            if (!updated) return c.json({ message: "Not found" }, 404);

            return c.json(updated);
        } catch (err) {
            if (err.code === 11000) {
            return c.json({ message: "Division name already exists" }, 409);
            }

            console.error(err);
            return c.json({ error: "Internal error" }, 500);
        }
    };

    // ======================
    // DELETE /api/v1/divisions/:id
    // ======================
    async deleteDivision (c) {
        const id = c.req.param("id");

        const deleted = await Division.findByIdAndDelete(id);

        if (!deleted) return c.json({ message: "Not found" }, 404);

        return c.json({ message: "Division deleted" });
    };

}

export default new DivisionController();