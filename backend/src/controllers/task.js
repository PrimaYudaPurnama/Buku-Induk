import TaskService from "../services/taskService.js";

class TaskController {
  async getDailyTasks(c) {
    try {
      const user = c.get("user");
      const tasks = await TaskService.getDailyTasks({ user });
      return c.json({ success: true, data: tasks });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch daily tasks",
            code: error.code || "GET_DAILY_TASKS_ERROR",
          },
        },
        status
      );
    }
  }

  async createTask(c) {
    try {
      const user = c.get("user");
      const body = await c.req.json().catch(() => ({}));
      const task = await TaskService.createTask({ user, payload: body });
      return c.json({ success: true, data: task }, 201);
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to create task",
            code: error.code || "CREATE_TASK_ERROR",
          },
        },
        status
      );
    }
  }

  async getTasksByProject(c) {
    try {
      const user = c.get("user");
      const projectId = c.req.param("projectId");
      const tasks = await TaskService.getTasksByProject({ user, projectId });
      return c.json({ success: true, data: tasks });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch project tasks",
            code: error.code || "GET_PROJECT_TASKS_ERROR",
          },
        },
        status
      );
    }
  }

  async updateTask(c) {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));
      const task = await TaskService.updateTask({ user, taskId: id, payload: body });
      return c.json({ success: true, data: task });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to update task",
            code: error.code || "UPDATE_TASK_ERROR",
          },
        },
        status
      );
    }
  }

  async approveTask(c) {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const body = await c.req.json().catch(() => ({}));
      const task = await TaskService.approveTask({
        user,
        taskId: id,
        payload: body,
      });
      return c.json({ success: true, data: task });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to approve task",
            code: error.code || "APPROVE_TASK_ERROR",
          },
        },
        status
      );
    }
  }

  async rejectTask(c) {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const task = await TaskService.rejectTask({ user, taskId: id });
      return c.json({ success: true, data: task });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to reject task",
            code: error.code || "REJECT_TASK_ERROR",
          },
        },
        status
      );
    }
  }

  async deleteTask(c) {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const result = await TaskService.deleteTask({ user, taskId: id });
      return c.json({ success: true, data: result });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to delete task",
            code: error.code || "DELETE_TASK_ERROR",
          },
        },
        status
      );
    }
  }

  async getTaskById(c) {
    try {
      const user = c.get("user");
      const id = c.req.param("id");
      const task = await TaskService.getTaskById({ user, taskId: id });
      return c.json({ success: true, data: task });
    } catch (error) {
      const status = error.status || 500;
      return c.json(
        {
          success: false,
          error: {
            message: error.message || "Failed to fetch task",
            code: error.code || "GET_TASK_ERROR",
          },
        },
        status
      );
    }
  }
}

export default new TaskController();
