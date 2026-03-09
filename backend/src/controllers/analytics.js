import AccountRequest from "../models/accountRequest.js";
import Approval from "../models/approval.js";
import User from "../models/user.js";
import Role from "../models/role.js";
import Division from "../models/division.js";
import Attendance from "../models/attendance.js";
import Activity from "../models/activity.js";
import Project from "../models/project.js";
import LateAttendanceRequest from "../models/lateAttendanceRequest.js";
import { generateApprovalSteps } from "../lib/approvalWorkflows.js";
import mongoose from "mongoose";

class AnalyticsController {
  /**
   * GET /api/v1/analytics/workflow-overview
   * Get overview statistics of all workflows
   */
  static async getWorkflowOverview(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const userPerms = currentUser?.role_id?.permissions || [];
      
      // Build filter based on permissions
      const filter = {};
      if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
        if (currentUser?.division_id) {
          filter.division_id = currentUser.division_id;
        } else {
          return c.json({
            data: {
              total_requests: 0,
              by_status: { pending: 0, approved: 0, rejected: 0 },
              by_request_type: {},
              recent_requests: [],
            },
          });
        }
      } else if (userPerms.includes("user:read:self") && !userPerms.includes("user:read:any") && !userPerms.includes("user:read:own_division")) {
        filter.requested_by = currentUser._id;
      }

      // Get all requests
      const allRequests = await AccountRequest.find(filter)
        .populate("requested_role", "name")
        .populate("division_id", "name")
        .populate("requested_by", "full_name email")
        .populate("user_id", "full_name email")
        .sort({ created_at: -1 });

      // Calculate statistics
      const totalRequests = allRequests.length;
      const byStatus = {
        pending: allRequests.filter((r) => r.status === "pending").length,
        approved: allRequests.filter((r) => r.status === "approved").length,
        rejected: allRequests.filter((r) => r.status === "rejected").length,
      };

      // Group by request type
      const byRequestType = {};
      const requestTypes = ["account_request", "promotion", "termination", "transfer", "salary_change"];
      
      for (const reqType of requestTypes) {
        const requests = allRequests.filter((r) => r.request_type === reqType);
        byRequestType[reqType] = {
          total: requests.length,
          pending: requests.filter((r) => r.status === "pending").length,
          approved: requests.filter((r) => r.status === "approved").length,
          rejected: requests.filter((r) => r.status === "rejected").length,
        };
      }

      // Get recent requests (last 10)
      const recentRequests = allRequests.slice(0, 10).map((req) => ({
        _id: req._id,
        requester_name: req.requester_name,
        email: req.email,
        request_type: req.request_type,
        status: req.status,
        requested_role: req.requested_role,
        division_id: req.division_id,
        created_at: req.created_at,
      }));

      return c.json({
        data: {
          total_requests: totalRequests,
          by_status: byStatus,
          by_request_type: byRequestType,
          recent_requests: recentRequests,
        },
      });
    } catch (error) {
      console.error("Get workflow overview error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/workflow-details
   * Get detailed workflow analytics with step-by-step status
   */
  static async getWorkflowDetails(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const query = c.req.query();
      const {
        request_type,
        status,
        division_id,
        search,
        page = 1,
        limit = 20,
      } = query;

      const userPerms = currentUser?.role_id?.permissions || [];
      
      // Build filter
      const filter = {};
      if (request_type) filter.request_type = request_type;
      if (status) filter.status = status;
      if (division_id) filter.division_id = division_id;

      // Apply permission filters
      if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
        if (currentUser?.division_id) {
          filter.division_id = currentUser.division_id;
        } else {
          return c.json({
            data: [],
            pagination: {
              page: parseInt(page),
              limit: parseInt(limit),
              total: 0,
              pages: 0,
            },
          });
        }
      } else if (userPerms.includes("user:read:self") && !userPerms.includes("user:read:any") && !userPerms.includes("user:read:own_division")) {
        filter.requested_by = currentUser._id;
      }

      // Search filter
      if (search) {
        filter.$or = [
          { requester_name: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } },
        ];
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      // Get requests
      const requests = await AccountRequest.find(filter)
        .populate("requested_role", "name description")
        .populate("division_id", "name description")
        .populate("requested_by", "full_name email")
        .populate("approved_by", "full_name email")
        .populate("user_id", "full_name email role_id division_id")
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(skip);

      // Get workflow details for each request
      const requestsWithWorkflow = await Promise.all(
        requests.map(async (request) => {
          // Get all approvals for this request
          const approvals = await Approval.find({
            request_type: request.request_type,
            request_id: request._id,
          })
            .populate("approver_id", "full_name email role_id")
            .populate("user_id", "full_name email")
            .sort({ approval_level: 1 });

          // Get expected workflow steps
          let expectedSteps = [];
          try {
            expectedSteps = generateApprovalSteps(request.request_type);
          } catch (error) {
            // If workflow not defined, use approvals as reference
            const maxLevel = approvals.length > 0 
              ? Math.max(...approvals.map(a => a.approval_level))
              : 0;
            for (let i = 1; i <= maxLevel; i++) {
              expectedSteps.push({ level: i, approver_role: "Unknown" });
            }
          }

          // Build workflow steps with status
          const workflowSteps = expectedSteps.map((step) => {
            const approval = approvals.find((a) => a.approval_level === step.level);
            
            return {
              level: step.level,
              approver_role: step.approver_role,
              status: approval?.status || "pending",
              approver: approval?.approver_id
                ? {
                    _id: approval.approver_id._id,
                    full_name: approval.approver_id.full_name,
                    email: approval.approver_id.email,
                    role: approval.approver_id.role_id?.name || "Unknown",
                  }
                : null,
              comments: approval?.comments || "",
              processed_at: approval?.processed_at || null,
              created_at: approval?.created_at || null,
            };
          });

          // Calculate workflow progress
          const totalSteps = workflowSteps.length;
          const approvedSteps = workflowSteps.filter((s) => s.status === "approved").length;
          const rejectedSteps = workflowSteps.filter((s) => s.status === "rejected").length;
          const pendingSteps = workflowSteps.filter((s) => s.status === "pending").length;

          // Determine current step
          let currentStep = null;
          if (rejectedSteps > 0) {
            currentStep = workflowSteps.find((s) => s.status === "rejected");
          } else if (pendingSteps > 0) {
            currentStep = workflowSteps.find((s) => s.status === "pending");
          } else if (approvedSteps === totalSteps) {
            currentStep = workflowSteps[workflowSteps.length - 1];
          }

          // Calculate time metrics
          const firstApproval = approvals.length > 0 ? approvals[0] : null;
          const lastApproval = approvals.length > 0 
            ? approvals[approvals.length - 1] 
            : null;
          
          let averageStepTime = null;
          if (approvedSteps > 1) {
            const approvedApprovals = approvals.filter(a => a.status === "approved" && a.processed_at);
            if (approvedApprovals.length > 1) {
              const times = [];
              for (let i = 1; i < approvedApprovals.length; i++) {
                const timeDiff = approvedApprovals[i].processed_at - approvedApprovals[i-1].processed_at;
                times.push(timeDiff);
              }
              averageStepTime = times.reduce((a, b) => a + b, 0) / times.length;
            }
          }

          return {
            request: {
              _id: request._id,
              requester_name: request.requester_name,
              email: request.email,
              phone: request.phone,
              request_type: request.request_type,
              status: request.status,
              requested_role: request.requested_role,
              division_id: request.division_id,
              user_id: request.user_id,
              requested_by: request.requested_by,
              approved_by: request.approved_by,
              notes: request.notes,
              created_at: request.created_at,
              processed_at: request.processed_at,
            },
            workflow: {
              steps: workflowSteps,
              progress: {
                total_steps: totalSteps,
                approved_steps: approvedSteps,
                rejected_steps: rejectedSteps,
                pending_steps: pendingSteps,
                completion_percentage: totalSteps > 0 
                  ? Math.round((approvedSteps / totalSteps) * 100) 
                  : 0,
              },
              current_step: currentStep,
              metrics: {
                started_at: firstApproval?.created_at || request.created_at,
                last_activity_at: lastApproval?.processed_at || request.created_at,
                average_step_time_ms: averageStepTime,
                total_duration_ms: request.processed_at && request.created_at
                  ? request.processed_at - request.created_at
                  : null,
              },
            },
          };
        })
      );

      const total = await AccountRequest.countDocuments(filter);

      return c.json({
        data: requestsWithWorkflow,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Get workflow details error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/workflow-timeline/:id
   * Get detailed timeline for a specific request
   */
  static async getWorkflowTimeline(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const requestId = c.req.param("id");

      // Get request
      const request = await AccountRequest.findById(requestId)
        .populate("requested_role", "name description")
        .populate("division_id", "name description")
        .populate("requested_by", "full_name email")
        .populate("approved_by", "full_name email")
        .populate("user_id", "full_name email role_id division_id");

      if (!request) {
        return c.json({ message: "Request not found" }, 404);
      }

      // Check access permission
      const userPerms = currentUser?.role_id?.permissions || [];
      if (!userPerms.includes("user:read:any")) {
        if (userPerms.includes("user:read:own_division")) {
          const requestDivisionId = request.division_id?._id?.toString() || request.division_id?.toString();
          const userDivisionId = currentUser?.division_id?.toString();
          if (requestDivisionId !== userDivisionId) {
            return c.json({ message: "Forbidden: Access denied" }, 403);
          }
        } else if (userPerms.includes("user:read:self")) {
          const requestedById = request.requested_by?._id?.toString();
          const userId = currentUser?._id?.toString();
          if (requestedById !== userId) {
            return c.json({ message: "Forbidden: Access denied" }, 403);
          }
        } else {
          return c.json({ message: "Forbidden: Access denied" }, 403);
        }
      }

      // Get all approvals
      const approvals = await Approval.find({
        request_type: request.request_type,
        request_id: request._id,
      })
        .populate("approver_id", "full_name email role_id")
        .populate("user_id", "full_name email")
        .sort({ approval_level: 1, created_at: 1 });

      // Get expected workflow steps
      let expectedSteps = [];
      try {
        expectedSteps = generateApprovalSteps(request.request_type);
      } catch (error) {
        // Fallback
        const maxLevel = approvals.length > 0 
          ? Math.max(...approvals.map(a => a.approval_level))
          : 0;
        for (let i = 1; i <= maxLevel; i++) {
          expectedSteps.push({ level: i, approver_role: "Unknown" });
        }
      }

      // Build timeline events
      const timeline = [];

      // Request created event
      timeline.push({
        type: "request_created",
        timestamp: request.created_at,
        actor: request.requested_by,
        description: `Request ${request.request_type} created`,
        data: {
          requester_name: request.requester_name,
          email: request.email,
        },
      });

      // Approval events
      for (const approval of approvals) {
        timeline.push({
          type: `approval_${approval.status}`,
          timestamp: approval.status !== "pending" 
            ? approval.processed_at 
            : approval.created_at,
          actor: approval.approver_id,
          description: `Level ${approval.approval_level} ${approval.status === "approved" ? "approved" : approval.status === "rejected" ? "rejected" : "pending"} by ${approval.approver_id?.full_name || "Unknown"}`,
          data: {
            approval_level: approval.approval_level,
            status: approval.status,
            comments: approval.comments,
            approver_role: approval.approver_id?.role_id?.name || "Unknown",
          },
        });
      }

      // Request processed event (if approved/rejected)
      if (request.status !== "pending" && request.processed_at) {
        timeline.push({
          type: `request_${request.status}`,
          timestamp: request.processed_at,
          actor: request.approved_by,
          description: `Request ${request.status}`,
          data: {
            status: request.status,
          },
        });
      }

      // Sort timeline by timestamp
      timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Build workflow steps
      const workflowSteps = expectedSteps.map((step) => {
        const approval = approvals.find((a) => a.approval_level === step.level);
        
        return {
          level: step.level,
          approver_role: step.approver_role,
          status: approval?.status || "pending",
          approver: approval?.approver_id
            ? {
                _id: approval.approver_id._id,
                full_name: approval.approver_id.full_name,
                email: approval.approver_id.email,
                role: approval.approver_id.role_id?.name || "Unknown",
              }
            : null,
          comments: approval?.comments || "",
          processed_at: approval?.processed_at || null,
          created_at: approval?.created_at || null,
        };
      });

      return c.json({
        data: {
          request: {
            _id: request._id,
            requester_name: request.requester_name,
            email: request.email,
            phone: request.phone,
            request_type: request.request_type,
            status: request.status,
            requested_role: request.requested_role,
            division_id: request.division_id,
            user_id: request.user_id,
            requested_by: request.requested_by,
            approved_by: request.approved_by,
            notes: request.notes,
            created_at: request.created_at,
            processed_at: request.processed_at,
          },
          workflow_steps: workflowSteps,
          timeline,
        },
      });
    } catch (error) {
      console.error("Get workflow timeline error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/workflow-statistics
   * Get aggregated statistics for workflows
   */
  static async getWorkflowStatistics(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const query = c.req.query();
      const { start_date, end_date, request_type } = query;

      const userPerms = currentUser?.role_id?.permissions || [];
      
      // Build filter
      const filter = {};
      if (request_type) filter.request_type = request_type;
      
      if (start_date || end_date) {
        filter.created_at = {};
        if (start_date) filter.created_at.$gte = new Date(start_date);
        if (end_date) filter.created_at.$lte = new Date(end_date);
      }

      // Apply permission filters
      if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
        if (currentUser?.division_id) {
          filter.division_id = currentUser.division_id;
        } else {
          return c.json({
            data: {
              total_requests: 0,
              average_approval_time_hours: 0,
              approval_rate: 0,
              rejection_rate: 0,
              by_request_type: {},
              by_status: {},
            },
          });
        }
      } else if (userPerms.includes("user:read:self") && !userPerms.includes("user:read:any") && !userPerms.includes("user:read:own_division")) {
        filter.requested_by = currentUser._id;
      }

      // Get all requests
      const requests = await AccountRequest.find(filter);

      // Get all approvals for these requests
      const requestIds = requests.map((r) => r._id);
      const approvals = await Approval.find({
        request_id: { $in: requestIds },
      }).sort({ approval_level: 1, processed_at: 1 });

      // Calculate statistics
      const totalRequests = requests.length;
      const approvedRequests = requests.filter((r) => r.status === "approved");
      const rejectedRequests = requests.filter((r) => r.status === "rejected");
      const pendingRequests = requests.filter((r) => r.status === "pending");

      // Calculate average approval time (for approved requests only)
      let totalApprovalTime = 0;
      let approvedCount = 0;
      
      for (const request of approvedRequests) {
        if (request.processed_at && request.created_at) {
          const timeDiff = request.processed_at - request.created_at;
          totalApprovalTime += timeDiff;
          approvedCount++;
        }
      }

      const averageApprovalTimeHours = approvedCount > 0
        ? totalApprovalTime / approvedCount / (1000 * 60 * 60)
        : 0;

      // Group by request type
      const byRequestType = {};
      const requestTypes = ["account_request", "promotion", "termination", "transfer", "salary_change"];
      
      for (const reqType of requestTypes) {
        const typeRequests = requests.filter((r) => r.request_type === reqType);
        const typeApproved = typeRequests.filter((r) => r.status === "approved");
        const typeRejected = typeRequests.filter((r) => r.status === "rejected");
        
        let typeApprovalTime = 0;
        let typeApprovedCount = 0;
        for (const req of typeApproved) {
          if (req.processed_at && req.created_at) {
            typeApprovalTime += req.processed_at - req.created_at;
            typeApprovedCount++;
          }
        }

        byRequestType[reqType] = {
          total: typeRequests.length,
          approved: typeApproved.length,
          rejected: typeRejected.length,
          pending: typeRequests.filter((r) => r.status === "pending").length,
          average_approval_time_hours: typeApprovedCount > 0
            ? typeApprovalTime / typeApprovedCount / (1000 * 60 * 60)
            : 0,
        };
      }

      return c.json({
        data: {
          total_requests: totalRequests,
          approved_requests: approvedRequests.length,
          rejected_requests: rejectedRequests.length,
          pending_requests: pendingRequests.length,
          average_approval_time_hours: Math.round(averageApprovalTimeHours * 100) / 100,
          approval_rate: totalRequests > 0
            ? Math.round((approvedRequests.length / totalRequests) * 100 * 100) / 100
            : 0,
          rejection_rate: totalRequests > 0
            ? Math.round((rejectedRequests.length / totalRequests) * 100 * 100) / 100
            : 0,
          by_request_type: byRequestType,
          by_status: {
            pending: pendingRequests.length,
            approved: approvedRequests.length,
            rejected: rejectedRequests.length,
          },
        },
      });
    } catch (error) {
      console.error("Get workflow statistics error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/attendance-overview
   * Get attendance overview statistics
   */
  static async getAttendanceOverview(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const query = c.req.query();
      const { start_date, end_date, user_id, division_id } = query;

      const userPerms = currentUser?.role_id?.permissions || [];
      
      // Build filter
      const filter = {};
      
      // Date range filter
      if (start_date || end_date) {
        filter.date = {};
        if (start_date) {
          const start = new Date(start_date);
          start.setHours(0, 0, 0, 0);
          filter.date.$gte = start;
        }
        if (end_date) {
          const end = new Date(end_date);
          end.setHours(23, 59, 59, 999);
          filter.date.$lte = end;
        }
      }

      // Apply permission filters
      if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
        if (currentUser?.division_id) {
          const usersInDivision = await User.find({ division_id: currentUser.division_id }).select("_id").lean();
          filter.user_id = { $in: usersInDivision.map(u => u._id) };
        } else {
          return c.json({
            data: {
              total_attendances: 0,
              by_status: {},
              by_date: [],
              late_requests: { total: 0, pending: 0, approved: 0, rejected: 0 },
              attendance_rate: 0,
            },
          });
        }
      } else if (userPerms.includes("user:read:self") && !userPerms.includes("user:read:any") && !userPerms.includes("user:read:own_division")) {
        filter.user_id = currentUser._id;
      }

      // User filter
      if (user_id) {
        filter.user_id = user_id;
      }

      // Division filter
      if (division_id) {
        const usersInDivision = await User.find({ division_id }).select("_id").lean();
        filter.user_id = { $in: usersInDivision.map(u => u._id) };
      }

      const attendances = await Attendance.find(filter)
        .populate({
          path: "user_id",
          select: "full_name email employee_code division_id",
          populate: {
            path: "division_id",
            select: "name",
          },
        })
        .sort({ date: -1 })
        .lean();

      // Calculate statistics
      const totalAttendances = attendances.length;
      
      // Group by status
      const byStatus = {
        normal: attendances.filter((a) => a.status === "normal").length,
        late: attendances.filter((a) => a.status === "late").length,
        late_checkin: attendances.filter((a) => a.status === "late_checkin").length,
        early_checkout: attendances.filter((a) => a.status === "early_checkout").length,
        manual: attendances.filter((a) => a.status === "manual").length,
        forget: attendances.filter((a) => a.status === "forget").length,
      };

      // Group by date
      const byDateMap = new Map();
      attendances.forEach((att) => {
        const dateStr = new Date(att.date).toISOString().split("T")[0];
        if (!byDateMap.has(dateStr)) {
          byDateMap.set(dateStr, { date: dateStr, count: 0, statuses: {} });
        }
        const entry = byDateMap.get(dateStr);
        entry.count++;
        entry.statuses[att.status] = (entry.statuses[att.status] || 0) + 1;
      });
      const byDate = Array.from(byDateMap.values()).sort((a, b) => b.date.localeCompare(a.date));

      // Late requests statistics
      const lateRequestFilter = {};
      if (filter.user_id) {
        lateRequestFilter.user_id = filter.user_id;
      }
      if (start_date || end_date) {
        lateRequestFilter.date = filter.date;
      }

      const lateRequests = await LateAttendanceRequest.find(lateRequestFilter).lean();
      const lateRequestStats = {
        total: lateRequests.length,
        pending: lateRequests.filter((r) => r.status === "pending").length,
        approved: lateRequests.filter((r) => r.status === "approved").length,
        rejected: lateRequests.filter((r) => r.status === "rejected").length,
        filled: lateRequests.filter((r) => r.status === "filled").length,
      };

      // Calculate attendance rate (if date range provided)
      let attendanceRate = 0;
      if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const uniqueUsers = new Set(attendances.map((a) => a.user_id?._id?.toString() || a.user_id?.toString()));
        const expectedAttendances = uniqueUsers.size * daysDiff;
        attendanceRate = expectedAttendances > 0 ? (totalAttendances / expectedAttendances) * 100 : 0;
      }

      // Activity breakdown (count of activity occurrences in attendance records)
      // Note: one attendance can have multiple activities, so counts can exceed total_attendances.
      const activityMatch = { ...filter };
      // Ensure we don't pass string user_id accidentally into aggregate if it was set from query
      if (typeof activityMatch.user_id === "string") {
        try {
          activityMatch.user_id = new mongoose.Types.ObjectId(activityMatch.user_id);
        } catch (_) {
          // ignore invalid, aggregate will return empty anyway
        }
      }

      const byActivityAgg = await Attendance.aggregate([
        { $match: activityMatch },
        { $unwind: "$activities" },
        {
          $group: {
            _id: "$activities",
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 24 },
        {
          $lookup: {
            from: Activity.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "activity",
          },
        },
        { $unwind: { path: "$activity", preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            activity_id: "$_id",
            name_activity: "$activity.name_activity",
            count: 1,
          },
        },
      ]);

      return c.json({
        data: {
          total_attendances: totalAttendances,
          by_status: byStatus,
          by_date: byDate.slice(0, 30), // Last 30 days
          late_requests: lateRequestStats,
          by_activity: byActivityAgg || [],
          attendance_rate: Math.round(attendanceRate * 100) / 100,
        },
      });
    } catch (error) {
      console.error("Get attendance overview error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/attendance-drilldown
   * Drilldown per user for a selected metric.
   * Query:
   * - metric: "status" | "activity"
   * - value: status string OR activity_id
   * - start_date, end_date, user_id, division_id
   * - page, limit
   */
  static async getAttendanceDrilldown(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) return c.json({ message: "Unauthorized" }, 401);

      const query = c.req.query();
      const {
        metric,
        value,
        start_date,
        end_date,
        user_id,
        division_id,
        page = 1,
        limit = 20,
      } = query;

      if (!metric || !value) {
        return c.json({ message: "metric and value are required" }, 400);
      }

      const userPerms = currentUser?.role_id?.permissions || [];

      // Build base filter (same spirit as getAttendanceDetails)
      const filter = {};
      if (start_date || end_date) {
        filter.date = {};
        if (start_date) {
          const start = new Date(start_date);
          start.setHours(0, 0, 0, 0);
          filter.date.$gte = start;
        }
        if (end_date) {
          const end = new Date(end_date);
          end.setHours(23, 59, 59, 999);
          filter.date.$lte = end;
        }
      }

      // Apply permission filters
      if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
        if (currentUser?.division_id) {
          const usersInDivision = await User.find({ division_id: currentUser.division_id })
            .select("_id")
            .lean();
          filter.user_id = { $in: usersInDivision.map((u) => u._id) };
        } else {
          return c.json({
            data: [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 },
          });
        }
      } else if (
        userPerms.includes("user:read:self") &&
        !userPerms.includes("user:read:any") &&
        !userPerms.includes("user:read:own_division")
      ) {
        filter.user_id = currentUser._id;
      }

      // User filter (explicit)
      if (user_id) filter.user_id = user_id;

      // Division filter (explicit)
      if (division_id) {
        const usersInDivision = await User.find({ division_id }).select("_id").lean();
        filter.user_id = { $in: usersInDivision.map((u) => u._id) };
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.max(1, Math.min(100, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      let rows = [];
      let total = 0;

      if (metric === "status" || metric === "activity") {
        const match = { ...filter };

        if (metric === "status") {
          match.status = value;
        } else if (metric === "activity") {
          if (!mongoose.Types.ObjectId.isValid(value)) {
            return c.json({ message: "Invalid activity id" }, 400);
          }
          match.activities = new mongoose.Types.ObjectId(value);
        }

        const pipeline = [
          { $match: match },
          {
            $group: {
              _id: "$user_id",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          {
            $lookup: {
              from: User.collection.name,
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: Division.collection.name,
              localField: "user.division_id",
              foreignField: "_id",
              as: "division",
            },
          },
          { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              user: {
                _id: "$user._id",
                full_name: "$user.full_name",
                email: "$user.email",
                employee_code: "$user.employee_code",
                division: {
                  _id: "$division._id",
                  name: "$division.name",
                },
              },
              count: 1,
            },
          },
        ];

        const [rowsAgg, totalAgg] = await Promise.all([
          Attendance.aggregate([...pipeline, { $skip: skip }, { $limit: limitNum }]),
          Attendance.aggregate([...pipeline, { $count: "total" }]),
        ]);

        rows = rowsAgg || [];
        total = totalAgg?.[0]?.total || 0;
      } else if (metric === "late_request_status") {
        const lrFilter = {};

        // Date range (reuse attendance filter.date if present)
        if (filter.date) {
          lrFilter.date = filter.date;
        } else if (start_date || end_date) {
          lrFilter.date = {};
          if (start_date) {
            const s = new Date(start_date);
            s.setHours(0, 0, 0, 0);
            lrFilter.date.$gte = s;
          }
          if (end_date) {
            const e = new Date(end_date);
            e.setHours(23, 59, 59, 999);
            lrFilter.date.$lte = e;
          }
        }

        // Permission filters / division / user
        if (filter.user_id) {
          lrFilter.user_id = filter.user_id;
        }

        // Additional explicit filters from query
        if (user_id) {
          lrFilter.user_id = user_id;
        }

        if (division_id) {
          const usersInDivision = await User.find({ division_id }).select("_id").lean();
          lrFilter.user_id = { $in: usersInDivision.map((u) => u._id) };
        } else if (
          userPerms.includes("user:read:own_division") &&
          !userPerms.includes("user:read:any")
        ) {
          if (currentUser?.division_id) {
            const usersInDivision = await User.find({ division_id: currentUser.division_id })
              .select("_id")
              .lean();
            lrFilter.user_id = { $in: usersInDivision.map((u) => u._id) };
          } else {
            return c.json({
              data: [],
              pagination: { page: pageNum, limit: limitNum, total: 0, pages: 0 },
            });
          }
        } else if (
          userPerms.includes("user:read:self") &&
          !userPerms.includes("user:read:any") &&
          !userPerms.includes("user:read:own_division")
        ) {
          lrFilter.user_id = currentUser._id;
        }

        // Status filter
        if (value && value !== "all") {
          lrFilter.status = value;
        }

        const pipeline = [
          { $match: lrFilter },
          {
            $group: {
              _id: "$user_id",
              count: { $sum: 1 },
            },
          },
          { $sort: { count: -1 } },
          {
            $lookup: {
              from: User.collection.name,
              localField: "_id",
              foreignField: "_id",
              as: "user",
            },
          },
          { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
          {
            $lookup: {
              from: Division.collection.name,
              localField: "user.division_id",
              foreignField: "_id",
              as: "division",
            },
          },
          { $unwind: { path: "$division", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              user: {
                _id: "$user._id",
                full_name: "$user.full_name",
                email: "$user.email",
                employee_code: "$user.employee_code",
                division: {
                  _id: "$division._id",
                  name: "$division.name",
                },
              },
              count: 1,
            },
          },
        ];

        const [rowsAgg, totalAgg] = await Promise.all([
          LateAttendanceRequest.aggregate([...pipeline, { $skip: skip }, { $limit: limitNum }]),
          LateAttendanceRequest.aggregate([...pipeline, { $count: "total" }]),
        ]);

        rows = rowsAgg || [];
        total = totalAgg?.[0]?.total || 0;
      } else {
        return c.json({ message: "Invalid metric (allowed: status, activity, late_request_status)" }, 400);
      }

      return c.json({
        data: rows || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      });
    } catch (error) {
      console.error("Get attendance drilldown error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/attendance-details
   * Get detailed attendance analytics
   */
  static async getAttendanceDetails(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const query = c.req.query();
      const { start_date, end_date, user_id, division_id, status, page = 1, limit = 20 } = query;

      const userPerms = currentUser?.role_id?.permissions || [];
      
      // Build filter
      const filter = {};
      
      if (start_date || end_date) {
        filter.date = {};
        if (start_date) {
          const start = new Date(start_date);
          start.setHours(0, 0, 0, 0);
          filter.date.$gte = start;
        }
        if (end_date) {
          const end = new Date(end_date);
          end.setHours(23, 59, 59, 999);
          filter.date.$lte = end;
        }
      }

      if (status) filter.status = status;

      // Apply permission filters
      if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
        if (currentUser?.division_id) {
          const usersInDivision = await User.find({ division_id: currentUser.division_id }).select("_id").lean();
          filter.user_id = { $in: usersInDivision.map(u => u._id) };
        } else {
          return c.json({
            data: [],
            pagination: { page: parseInt(page), limit: parseInt(limit), total: 0, pages: 0 },
          });
        }
      } else if (userPerms.includes("user:read:self") && !userPerms.includes("user:read:any") && !userPerms.includes("user:read:own_division")) {
        filter.user_id = currentUser._id;
      }

      if (user_id) filter.user_id = user_id;
      if (division_id) {
        const usersInDivision = await User.find({ division_id }).select("_id").lean();
        filter.user_id = { $in: usersInDivision.map(u => u._id) };
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);

      const attendances = await Attendance.find(filter)
        .populate({
          path: "user_id",
          select: "full_name email employee_code division_id",
          populate: {
            path: "division_id",
            select: "name",
          },
        })
        .populate({
          path: "approved_by",
          select: "full_name email",
        })
        .populate("late_request_id")
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean();

      const total = await Attendance.countDocuments(filter);

      return c.json({
        data: attendances,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      });
    } catch (error) {
      console.error("Get attendance details error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/project-overview
   * Get project overview statistics
   */
  static async getProjectOverview(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const query = c.req.query();
      const { work_type, status } = query;

      // Build filter
      const filter = {};
      if (work_type) filter.work_type = work_type;
      if (status) filter.status = status;

      // Get all projects
      const projects = await Project.find(filter).sort({ created_at: -1 }).lean();

      // Get all attendances with project contributions
      const attendances = await Attendance.find({
        "projects.project_id": { $exists: true, $ne: null },
      })
        .populate({
          path: "user_id",
          select: "full_name email employee_code division_id",
          populate: {
            path: "division_id",
            select: "name",
          },
        })
        .populate({
          path: "projects.project_id",
          select: "name code work_type percentage status",
        })
        .lean();
      

      // Calculate project statistics
      const projectStats = projects.map((project) => {
        // Find all attendances that contributed to this project
        const contributions = attendances
          .filter((att) =>
            att.projects?.some(
              (p) => (p.project_id?._id?.toString() || p.project_id?.toString()) === project._id.toString()
            )
          )
          .map((att) => {
            const projContrib = att.projects.find(
              (p) => (p.project_id?._id?.toString() || p.project_id?.toString()) === project._id.toString()
            );
            return {
              user_id: att.user_id,
              contribution_percentage: projContrib?.contribution_percentage || 0,
              date: att.date,
            };
          });

        // Calculate total contribution percentage
        const totalContribution = contributions.reduce(
          (sum, c) => sum + (c.contribution_percentage || 0),
          0
        );

        // Get unique contributors
        const uniqueContributors = new Set(
          contributions.map((c) => c.user_id?._id?.toString() || c.user_id?.toString())
        );

        // Calculate average contribution per user
        const avgContributionPerUser =
          uniqueContributors.size > 0 ? totalContribution / uniqueContributors.size : 0;

        // Get contributor details
        const contributorDetails = Array.from(uniqueContributors).map((userId) => {
          const userContributions = contributions.filter(
            (c) => (c.user_id?._id?.toString() || c.user_id?.toString()) === userId
          );
          const userTotal = userContributions.reduce(
            (sum, c) => sum + (c.contribution_percentage || 0),
            0
          );
          const user = attendances.find(
            (att) => (att.user_id?._id?.toString() || att.user_id?.toString()) === userId
          )?.user_id;

          return {
            user_id: userId,
            user_name: user?.full_name || "Unknown",
            user_email: user?.email || "",
            total_contribution: Math.round(userTotal * 100) / 100,
            contribution_count: userContributions.length,
          };
        });

        return {
          project: {
            _id: project._id,
            code: project.code,
            name: project.name,
            work_type: project.work_type,
            percentage: project.percentage,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
          },
          statistics: {
            total_contribution_percentage: Math.round(totalContribution * 100) / 100,
            unique_contributors: uniqueContributors.size,
            average_contribution_per_user: Math.round(avgContributionPerUser * 100) / 100,
            contribution_count: contributions.length,
          },
          contributors: contributorDetails.sort((a, b) => b.total_contribution - a.total_contribution),
        };
      });

      // Overall statistics
      const overallStats = {
        total_projects: projects.length,
        by_status: {
          planned: projects.filter((p) => p.status === "planned").length,
          ongoing: projects.filter((p) => p.status === "ongoing").length,
          completed: projects.filter((p) => p.status === "completed").length,
          cancelled: projects.filter((p) => p.status === "cancelled").length,
        },
        by_work_type: {
          management: projects.filter((p) => p.work_type === "management").length,
          technic: projects.filter((p) => p.work_type === "technic").length,
        },
        average_progress: projects.length > 0
          ? Math.round((projects.reduce((sum, p) => sum + (p.percentage || 0), 0) / projects.length) * 100) / 100
          : 0,
      };

      return c.json({
        data: {
          overall: overallStats,
          projects: projectStats,
        },
      });
    } catch (error) {
      console.error("Get project overview error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/analytics/project-details/:id
   * Get detailed analytics for a specific project
   */
  static async getProjectDetails(c) {
    try {
      const currentUser = c.get("user");
      if (!currentUser) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const projectId = c.req.param("id");

      // Get project
      const project = await Project.findById(projectId);
      if (!project) {
        return c.json({ message: "Project not found" }, 404);
      }

      // Get all attendances that contributed to this project
      const attendances = await Attendance.find({
        "projects.project_id": projectId,
      })
        .populate({
          path: "user_id",
          select: "full_name email employee_code division_id",
          populate: {
            path: "division_id",
            select: "name",
          },
        })
        .sort({ date: -1 })
        .lean();
      

      // Process contributions
      const contributions = attendances.map((att) => {
        const projContrib = att.projects.find(
          (p) => (p.project_id?._id?.toString() || p.project_id?.toString()) === projectId
        );
        return {
          attendance_id: att._id,
          user: att.user_id,
          date: att.date,
          contribution_percentage: projContrib?.contribution_percentage || 0,
        };
      });

      // Group by user
      const userContributions = new Map();
      contributions.forEach((contrib) => {
        const userId = contrib.user?._id?.toString() || contrib.user?.toString();
        if (!userContributions.has(userId)) {
          userContributions.set(userId, {
            user: contrib.user,
            total_contribution: 0,
            contribution_count: 0,
            contributions: [],
          });
        }
        const entry = userContributions.get(userId);
        entry.total_contribution += contrib.contribution_percentage;
        entry.contribution_count++;
        entry.contributions.push(contrib);
      });

      const contributorStats = Array.from(userContributions.values()).map((entry) => ({
        user: entry.user,
        total_contribution: Math.round(entry.total_contribution * 100) / 100,
        contribution_count: entry.contribution_count,
        average_contribution: Math.round((entry.total_contribution / entry.contribution_count) * 100) / 100,
        contributions: entry.contributions.sort((a, b) => new Date(b.date) - new Date(a.date)),
      }));

      // Calculate timeline (by date) with contributors
      const timelineMap = new Map();
      contributions.forEach((contrib) => {
        const dateStr = new Date(contrib.date).toISOString().split("T")[0];
        if (!timelineMap.has(dateStr)) {
          timelineMap.set(dateStr, { 
            date: dateStr, 
            total_contribution: 0, 
            count: 0,
            contributors: []
          });
        }
        const entry = timelineMap.get(dateStr);
        entry.total_contribution += contrib.contribution_percentage;
        entry.count++;
        // Add contributor info if not already added for this date
        const userId = contrib.user?._id?.toString() || contrib.user?.toString();
        const existingContrib = entry.contributors.find(c => c.user_id === userId);
        if (existingContrib) {
          existingContrib.contribution += contrib.contribution_percentage;
        } else {
          entry.contributors.push({
            user_id: userId,
            user_name: contrib.user?.full_name || "Unknown",
            user_email: contrib.user?.email || "",
            contribution: contrib.contribution_percentage
          });
        }
      });

      const timeline = Array.from(timelineMap.values())
        .sort((a, b) => b.date.localeCompare(a.date))
        .map((entry) => ({
          date: entry.date,
          total_contribution: Math.round(entry.total_contribution * 100) / 100,
          contribution_count: entry.count,
          contributors: entry.contributors.map(c => ({
            ...c,
            contribution: Math.round(c.contribution * 100) / 100
          })).sort((a, b) => b.contribution - a.contribution)
        }));

      return c.json({
        data: {
          project: {
            _id: project._id,
            code: project.code,
            name: project.name,
            work_type: project.work_type,
            percentage: project.percentage,
            status: project.status,
            start_date: project.start_date,
            end_date: project.end_date,
          },
          contributors: contributorStats.sort((a, b) => b.total_contribution - a.total_contribution),
          timeline: timeline,
          total_contribution: Math.round(
            contributions.reduce((sum, c) => sum + c.contribution_percentage, 0) * 100
          ) / 100,
          total_contributions: contributions.length,
        },
      });
    } catch (error) {
      console.error("Get project details error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }
}

export default AnalyticsController;

