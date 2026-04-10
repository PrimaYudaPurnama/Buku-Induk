import AccountRequest from "../models/accountRequest.js";
import Approval from "../models/approval.js";
import User from "../models/user.js";
import Role from "../models/role.js";
import Division from "../models/division.js";
import Attendance from "../models/attendance.js";
import Activity from "../models/activity.js";
import Project from "../models/project.js";
import Task from "../models/task.js";
import LateAttendanceRequest from "../models/lateAttendanceRequest.js";
import AbsenceRequest from "../models/absenceRequest.js";
import WorkDay from "../models/workDay.js";
import WeeklySchedule from "../models/weeklySchedule.js";
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
      // if (userPerms.includes("user:read:own_division") && !userPerms.includes("user:read:any")) {
      //   if (currentUser?.division_id) {
      //     const usersInDivision = await User.find({ division_id: currentUser.division_id }).select("_id").lean();
      //     filter.user_id = { $in: usersInDivision.map(u => u._id) };
      //   } else {
      //     return c.json({
      //       data: {
      //         total_attendances: 0,
      //         by_status: {},
      //         by_date: [],
      //         late_requests: { total: 0, pending: 0, approved: 0, rejected: 0 },
      //         attendance_rate: 0,
      //       },
      //     });
      //   }
      // } else if (userPerms.includes("user:read:self") && !userPerms.includes("user:read:any") && !userPerms.includes("user:read:own_division")) {
      //   filter.user_id = currentUser._id;
      // }

      // User scope: semua karyawan di bawah direktur (direktur tidak termasuk)
      const nonDirectorBaseFilter = await AnalyticsController.getNonDirectorUsersBaseFilter();
      if (division_id) nonDirectorBaseFilter.division_id = division_id;
      if (user_id) nonDirectorBaseFilter._id = user_id;
      const scopedUsers = await User.find(nonDirectorBaseFilter)
        .select("_id full_name email employee_code division_id")
        .populate("division_id", "name")
        .lean();
      const scopedUserIds = scopedUsers.map((u) => u._id);
      filter.user_id = { $in: scopedUserIds };

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

      // Employee cards summary (default harian; jika range > 1 hari maka berbasis periode)
      const attendancePresentUsers = new Set();
      const attendanceAbsentUsers = new Set();
      attendances.forEach((a) => {
        const uid = a.user_id?._id?.toString() || a.user_id?.toString();
        if (!uid) return;
        if ((a.absence_type || "none") === "none") attendancePresentUsers.add(uid);
        if (["sick", "leave", "permission"].includes(a.absence_type)) attendanceAbsentUsers.add(uid);
      });

      const approvedAbsenceUsers = new Set();
      const absenceStart = filter.date?.$gte || new Date("1970-01-01");
      const absenceEnd = filter.date?.$lte || new Date();
      const approvedAbsencesForUsers = await AbsenceRequest.find({
        user_id: { $in: scopedUserIds },
        status: "approved",
        start_date: { $lte: absenceEnd },
        end_date: { $gte: absenceStart },
      })
        .select("user_id")
        .lean();
      approvedAbsencesForUsers.forEach((r) => {
        if (r.user_id) approvedAbsenceUsers.add(r.user_id.toString());
      });

      const totalEmployees = scopedUsers.length;
      const presentEmployees = attendancePresentUsers.size;

      // Untuk range > 1 hari, seorang user bisa punya data hadir (absence_type=none)
      // di beberapa hari dan juga absen (sick/leave/permission) di hari lain.
      // Supaya angka "berangkat" vs "absen" tetap relevan, kategorikan menjadi tidak saling tumpang tindih:
      // - "berangkat": punya minimal 1 hari hadir
      // - "absen": punya minimal 1 hari absen/approved absence, tapi TIDAK punya hari hadir
      const absentUsersUnion = new Set([...attendanceAbsentUsers, ...approvedAbsenceUsers]);
      const absentOnlyUsers = new Set(
        [...absentUsersUnion].filter((uid) => !attendancePresentUsers.has(uid))
      );

      const absentEmployees = absentOnlyUsers.size;
      const unexcusedEmployees = Math.max(
        0,
        totalEmployees - (presentEmployees + absentEmployees)
      );
      const employeeAttendanceRate =
        totalEmployees > 0 ? (presentEmployees / totalEmployees) * 100 : 0;

      // Calculate attendance rate with working-day basis (if date range provided)
      let attendanceRate = 0;
      let workCalendar = null;
      if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        const allDates = AnalyticsController.eachDateInRange(start, end);
        const [weeklySchedules, workDayOverrides] = await Promise.all([
          WeeklySchedule.find({}).lean(),
          WorkDay.find({ date: { $gte: start, $lte: end } }).lean(),
        ]);

        const weeklyMap = new Map((weeklySchedules || []).map((w) => [w.day_of_week, w]));
        const overridesMap = new Map(
          (workDayOverrides || []).map((w) => [AnalyticsController.toDateOnlyString(w.date), w])
        );
        const workingDaySet = AnalyticsController.buildWorkingDaySet(allDates, weeklyMap, overridesMap);

        const uniqueUsers = new Set(attendances.map((a) => a.user_id?._id?.toString() || a.user_id?.toString()));
        const expectedAttendances = uniqueUsers.size * workingDaySet.size;
        attendanceRate = expectedAttendances > 0 ? (totalAttendances / expectedAttendances) * 100 : 0;

        workCalendar = {
          total_days_in_range: allDates.length,
          working_days_in_range: workingDaySet.size,
          holiday_overrides: (workDayOverrides || []).filter((w) => w.is_holiday).length,
          non_working_overrides: (workDayOverrides || []).filter((w) => w.is_working_day === false).length,
          active_users: uniqueUsers.size,
          expected_attendance_records: expectedAttendances,
        };
      }

      // Absence requests analytics
      const absenceFilter = {};
      if (filter.user_id) absenceFilter.user_id = filter.user_id;
      if (filter.date) {
        absenceFilter.start_date = { $lte: filter.date.$lte || new Date("2999-12-31") };
        absenceFilter.end_date = { $gte: filter.date.$gte || new Date("1970-01-01") };
      }
      const absenceRequests = await AbsenceRequest.find(absenceFilter).lean();
      const absenceRequestsStats = {
        total: absenceRequests.length,
        pending: absenceRequests.filter((r) => r.status === "pending").length,
        approved: absenceRequests.filter((r) => r.status === "approved").length,
        rejected: absenceRequests.filter((r) => r.status === "rejected").length,
        by_type: {
          sick: absenceRequests.filter((r) => r.type === "sick").length,
          leave: absenceRequests.filter((r) => r.type === "leave").length,
          permission: absenceRequests.filter((r) => r.type === "permission").length,
        },
      };

      // Absence type distribution in attendance rows
      const absenceAttendanceStats = {
        none: attendances.filter((a) => (a.absence_type || "none") === "none").length,
        sick: attendances.filter((a) => a.absence_type === "sick").length,
        leave: attendances.filter((a) => a.absence_type === "leave").length,
        permission: attendances.filter((a) => a.absence_type === "permission").length,
      };

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
          absence_requests: absenceRequestsStats,
          absence_attendance: absenceAttendanceStats,
          employee_summary: {
            total_employees: totalEmployees,
            present_employees: presentEmployees,
            absent_employees: absentEmployees,
            unexcused_employees: unexcusedEmployees,
            attendance_rate: Math.round(employeeAttendanceRate * 100) / 100,
          },
          by_activity: byActivityAgg || [],
          work_calendar: workCalendar,
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
      } else if (metric === "employee_state") {
        if (!["total", "present", "absent", "unexcused"].includes(value)) {
          return c.json({ message: "Invalid employee_state value" }, 400);
        }

        const nonDirectorBaseFilter = await AnalyticsController.getNonDirectorUsersBaseFilter();
        if (division_id) nonDirectorBaseFilter.division_id = division_id;
        if (user_id) nonDirectorBaseFilter._id = user_id;

        const scopedUsers = await User.find(nonDirectorBaseFilter)
          .select("_id full_name email employee_code division_id")
          .populate("division_id", "name")
          .lean();
        const scopedUserIds = scopedUsers.map((u) => u._id);
        const scopedUserIdSet = new Set(scopedUserIds.map((id) => id.toString()));

        const attFilter = { ...filter, user_id: { $in: scopedUserIds } };
        const attRows = await Attendance.find(attFilter).select("user_id date absence_type").lean();
        const presentDaysByUser = new Map();
        const absentDaysByUser = new Map();
        for (const row of attRows) {
          const uid = row.user_id?.toString();
          if (!uid || !scopedUserIdSet.has(uid)) continue;
          const ds = AnalyticsController.toDateOnlyString(row.date);
          if (!ds) continue;
          if ((row.absence_type || "none") === "none") {
            if (!presentDaysByUser.has(uid)) presentDaysByUser.set(uid, new Set());
            presentDaysByUser.get(uid).add(ds);
          }
          if (["sick", "leave", "permission"].includes(row.absence_type)) {
            if (!absentDaysByUser.has(uid)) absentDaysByUser.set(uid, new Set());
            absentDaysByUser.get(uid).add(ds);
          }
        }

        const periodStart = filter.date?.$gte || new Date("1970-01-01");
        const periodEnd = filter.date?.$lte || new Date();
        const approvedAbsence = await AbsenceRequest.find({
          user_id: { $in: scopedUserIds },
          status: "approved",
          start_date: { $lte: periodEnd },
          end_date: { $gte: periodStart },
        }).select("user_id start_date end_date").lean();

        const effectiveDays = AnalyticsController.eachDateInRange(periodStart, periodEnd);
        for (const req of approvedAbsence) {
          const uid = req.user_id?.toString();
          if (!uid || !scopedUserIdSet.has(uid)) continue;
          if (!absentDaysByUser.has(uid)) absentDaysByUser.set(uid, new Set());
          const setRef = absentDaysByUser.get(uid);
          for (const d of effectiveDays) {
            if (d >= new Date(req.start_date) && d <= new Date(req.end_date)) {
              const ds = AnalyticsController.toDateOnlyString(d);
              if (ds) setRef.add(ds);
            }
          }
        }

        const normalizedRows = scopedUsers.map((u) => {
          const uid = u._id.toString();
          const presentDays = presentDaysByUser.get(uid)?.size || 0;
          const absentDays = absentDaysByUser.get(uid)?.size || 0;
          const isPresent = presentDays > 0;
          const isAbsent = absentDays > 0;
          const isUnexcused = !isPresent && !isAbsent;
          return {
            user: {
              _id: u._id,
              full_name: u.full_name,
              email: u.email,
              employee_code: u.employee_code,
              division: {
                _id: u.division_id?._id,
                name: u.division_id?.name,
              },
            },
            present_days: presentDays,
            absent_days: absentDays,
            count: value === "present" ? presentDays : value === "absent" ? absentDays : 1,
            flags: { isPresent, isAbsent, isUnexcused },
          };
        });

        const filteredRows = normalizedRows.filter((r) => {
          if (value === "total") return true;
          if (value === "present") return r.flags.isPresent;
          if (value === "absent") return r.flags.isAbsent;
          return r.flags.isUnexcused;
        });

        filteredRows.sort((a, b) => b.count - a.count);
        total = filteredRows.length;
        rows = filteredRows.slice(skip, skip + limitNum).map((r) => ({
          user: r.user,
          count: r.count,
          present_days: r.present_days,
          absent_days: r.absent_days,
        }));
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
        return c.json({ message: "Invalid metric (allowed: status, activity, employee_state, late_request_status)" }, 400);
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
          populate: { path: "division_id", select: "name" },
        })
        .populate("approved_by", "full_name email")
        .populate({
          path: "late_request_id",
          select: "late_reason status approved_by approved_at rejected_by rejected_at rejected_reason date",
          populate: [
            { path: "approved_by", select: "full_name email" },
            { path: "rejected_by", select: "full_name email" },
          ],
        })
        // Task: ikuti schema Task (lihat `backend/src/models/task.js`)
        .populate({
          path: "tasks_today",
          select: "title description hour_weight project_id status start_at approved_at approved_by user_id",
          populate: {
            path: "project_id",
            select: "code name work_type percentage status start_date end_date",
          },
        })
        .populate({
          path: "projects.project_id",
          select: "code name work_type percentage status start_date end_date",
        })
        .populate({
          path: "leave_request_id",
          select: "type start_date end_date reason status approved_by approved_at rejected_by rejected_at rejected_reason",
          populate: [
            { path: "approved_by", select: "full_name email" },
            { path: "rejected_by", select: "full_name email" },
          ],
        })
        .populate("activities", "name_activity")
        .sort({ date: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .lean();
        
        // Merge project dari tasks_today ke projects[] tanpa duplikat
        attendances.forEach(a => {
          const existingProjectIds = new Set(
            a.projects.map(p => p.project_id?._id?.toString() || p.project_id?.toString())
          );
        
          const projectsFromTasks = (a.tasks_today || [])
            .map(t => t.project_id)
            .filter(p => p && !existingProjectIds.has(p._id?.toString()));
        
          // Deduplikasi dari tasks juga (kalau beberapa task pakai project sama)
          const uniqueFromTasks = [];
          const seenFromTasks = new Set();
          for (const p of projectsFromTasks) {
            const id = p._id?.toString();
            if (!seenFromTasks.has(id)) {
              seenFromTasks.add(id);
              uniqueFromTasks.push({ project_id: p });
            }
          }
        
          a.projects = [...a.projects, ...uniqueFromTasks];
        });

        // Setelah .lean(), tambah ini:
      const projectIds = attendances.flatMap(a => 
        a.projects.map(p => p.project_id)
      ).filter(Boolean);

      const populatedProjects = await mongoose.model("Project")
        .find({ _id: { $in: projectIds } })
        .select("code name work_type percentage status start_date end_date")
        .lean();

      const projectMap = Object.fromEntries(
        populatedProjects.map(p => [p._id.toString(), p])
      );

      // Inject ke setiap attendance
      attendances.forEach(a => {
        a.projects = a.projects.map(p => ({
          ...p,
          project_id: projectMap[p.project_id?.toString()] || p.project_id,
        }));
      });

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

  /** Bulatkan ke N desimal */
  static round = (n, dec = 2) => Math.round(n * 10 ** dec) / 10 ** dec;

  /**
   * Hitung selisih *calendar day* di zona waktu Asia/Jakarta (WIB).
   * Positif = tgl2 lebih jauh ke depan dibanding tgl1.
   *
   * Penting: ini sengaja TIDAK berbasis jam (ms diff) supaya tidak ada off-by-one
   * ketika sekarang sudah malam tetapi masih di tanggal yang sama.
   */
  static daysDiff = (d1, d2) => {
    const toYMD = (dateLike) => {
      const d = new Date(dateLike);
      if (Number.isNaN(d.getTime())) return null;
      // en-CA -> YYYY-MM-DD (format stabil)
      const ymd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Jakarta",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(d);
      return ymd || null;
    };

    const parseYMD = (ymd) => {
      if (!ymd) return null;
      const [y, m, day] = String(ymd).split("-").map((v) => Number(v));
      if (!y || !m || !day) return null;
      // UTC midnight timestamp for safe day-diff arithmetic
      return Date.UTC(y, m - 1, day);
    };

    const a = parseYMD(toYMD(d1));
    const b = parseYMD(toYMD(d2));
    if (a == null || b == null) return 0;
    return Math.round((b - a) / 86_400_000);
  };

  static toDateOnlyString(dateLike) {
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().split("T")[0];
  }

  static eachDateInRange(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];
    start.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);
    const out = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      out.push(new Date(d));
    }
    return out;
  }

  static buildWorkingDaySet(dateList, weeklyMap, overridesMap) {
    const working = new Set();
    for (const d of dateList) {
      const ds = AnalyticsController.toDateOnlyString(d);
      if (!ds) continue;
      if (overridesMap.has(ds)) {
        const o = overridesMap.get(ds);
        if (o.is_holiday === true) continue;
        if (o.is_working_day === true) working.add(ds);
        continue;
      }
      const dow = d.getDay();
      if (weeklyMap.has(dow)) {
        const w = weeklyMap.get(dow);
        if (w.is_working_day) working.add(ds);
      } else if (dow !== 0 && dow !== 6) {
        working.add(ds);
      }
    }
    return working;
  }

  static deriveAttendanceProjectContribution(attendance, projectId) {
    const pid = projectId?.toString();
    if (!pid) return 0;

    const fromProjectField = (attendance.projects || []).find(
      (p) =>
        p?.project_id?.toString?.() === pid &&
        Number.isFinite(Number(p?.contribution_percentage))
    );
    if (fromProjectField) return Number(fromProjectField.contribution_percentage) || 0;

    const tasks = Array.isArray(attendance.tasks_today) ? attendance.tasks_today : [];
    const approvedTasks = tasks.filter((t) => t?.status === "approved");
    const totalApprovedHw = approvedTasks.reduce((s, t) => s + (Number(t?.hour_weight) || 0), 0);
    if (totalApprovedHw <= 0) return 0;

    const projectApprovedHw = approvedTasks
      .filter((t) => (t?.project_id?._id?.toString?.() || t?.project_id?.toString?.()) === pid)
      .reduce((s, t) => s + (Number(t?.hour_weight) || 0), 0);
    if (projectApprovedHw <= 0) return 0;

    return AnalyticsController.round((projectApprovedHw / totalApprovedHw) * 100);
  }

  /**
   * Derive contribution percentage for a project on a single attendance record,
   * based on tasks that were completed (done/approved) on that day.
   *
   * Definition:
   *   contribution_pct = (sum hour_weight of tasks_today for the project with status done/approved) / totalProjectHourWeightAll * 100
   *
   * NOTE:
   * - This uses task weights as the "unit" to align with project progress mechanics.
   * - If totalProjectHourWeightAll is 0, contribution is 0.
   */
  static deriveAttendanceProjectContributionFromDoneTasks(attendance, projectId, totalProjectHourWeightAll) {
    const denom = Number(totalProjectHourWeightAll) || 0;
    if (denom <= 0) return 0;

    const pid = projectId?.toString?.() || projectId?.toString?.() || String(projectId || "");
    if (!pid) return 0;

    const tasks = Array.isArray(attendance?.tasks_today) ? attendance.tasks_today : [];
    const doneHw = tasks
      .filter((t) => {
        const tPid = t?.project_id?._id?.toString?.() || t?.project_id?.toString?.() || t?.project_id?.toString?.() || t?.project_id;
        if (!tPid) return false;
        const st = t?.status;
        return String(tPid) === String(pid) && (st === "done" || st === "approved");
      })
      .reduce((s, t) => s + (Number(t?.hour_weight) || 0), 0);

    if (doneHw <= 0) return 0;
    return AnalyticsController.round((doneHw / denom) * 100);
  }

  static async getNonDirectorUsersBaseFilter() {
    const directorRole = await Role.findOne({
      name: { $regex: /(direktur|director)/i },
    })
      .sort({ hierarchy_level: 1 })
      .lean();

    if (!directorRole) return { status: { $ne: "terminated" } };

    const rolesBelowDirector = await Role.find({
      hierarchy_level: { $gt: directorRole.hierarchy_level },
    })
      .select("_id")
      .lean();

    return {
      role_id: { $in: rolesBelowDirector.map((r) => r._id) },
      status: { $ne: "terminated" },
    };
  }

  /**
 * Hitung "project health" sederhana berdasarkan progress vs waktu terpakai.
 *
*/
static calcHealth(project) {
  const { status, percentage, start_date, end_date, target_end_date } = project;
  const now = new Date();
  const progress = percentage ?? 0;

  const calcTimeProgress = (start, end, current) => {
    if (!start || !end) return null;
    let totalDays = AnalyticsController.daysDiff(start, end);
    if (totalDays <= 0) totalDays = 1;
    const elapsedRaw = AnalyticsController.daysDiff(start, current);
    const elapsed = Math.max(0, Math.min(elapsedRaw, totalDays));
    return AnalyticsController.round((elapsed / totalDays) * 100);
  };

  const getLabel = (timePct, progressPct, hasAnyDeadline) => {
    if (!hasAnyDeadline) return "no_deadline";
    // FIX: kalau timePct null berarti data tidak cukup, jangan misleading jadi on_track
    if (timePct == null) return "no_deadline";
    const gap = timePct - progressPct;
    if (gap <= 5)  return "on_track";
    if (gap <= 20) return "at_risk";
    return "behind";
  };

  const hasAnyDeadline = !!end_date || !!target_end_date;

  // Berbasis end_date (deadline formal)
  const deadlineElapsedPct = end_date
    ? calcTimeProgress(start_date, end_date, now)
    : null;

  // Berbasis target_end_date (target manual)
  const targetElapsedPct = target_end_date
    ? calcTimeProgress(start_date, target_end_date, now)
    : null;

  let label        = getLabel(deadlineElapsedPct, progress, hasAnyDeadline);
  let target_label = getLabel(targetElapsedPct,   progress, hasAnyDeadline);

  // Fallback: kalau belum ada end_date, pakai target sebagai label utama
  let primaryElapsedPct = deadlineElapsedPct;
  if (!end_date && target_end_date) {
    label             = target_label;
    primaryElapsedPct = targetElapsedPct;
  }

  // Override status khusus
  if (status === "completed") {
    label        = "aman";
    target_label = "completed";
    primaryElapsedPct = (start_date && end_date && target_end_date)
    ? calcTimeProgress(start_date, target_end_date, end_date) // current = end_date, bukan now
    : deadlineElapsedPct ?? targetElapsedPct ?? 100;
  }

  if (status === "cancelled") {
    label        = "cancelled";
    target_label = "cancelled";
    primaryElapsedPct = (start_date && end_date && target_end_date)
    ? calcTimeProgress(start_date, target_end_date, end_date)
    : deadlineElapsedPct ?? targetElapsedPct ?? null;
  }

  return {
    label,
    target_label,
    deadline_elapsed_pct: primaryElapsedPct,  // renamed + fix
    target_elapsed_pct:   targetElapsedPct,   // FIX: sebelumnya tidak di-return
    progress_pct:         progress,
  };
}

  // ─── getProjectOverview ──────────────────────────────────────
 
/**
 * GET /api/v1/analytics/project-overview
 *
 * Mengembalikan:
 *  - overall : statistik agregat seluruh proyek
 *  - projects: per-proyek dengan statistik task, contributor,
 *              health, dan data presensi harian
 */
static async getProjectOverview(c) {
  try {
    const currentUser = c.get("user");
    if (!currentUser) return c.json({ message: "Unauthorized" }, 401);
    
    const now = new Date();

    const { work_type, status } = c.req.query();
 
    // 1. Ambil proyek dengan filter opsional
    const filter = {};
    if (work_type) filter.work_type = work_type;
    if (status)    filter.status    = status;
 
    const projects = await Project.find(filter).sort({ created_at: -1 }).lean();
    const projectIds = projects.map((p) => p._id);
 
    // 2. Ambil SEMUA task yang terhubung ke proyek-proyek ini
    const allTasks = await Task.find({ project_id: { $in: projectIds } })
      .populate({
        path: "user_id",
        select: "full_name email employee_code division_id",
        populate: { path: "division_id", select: "name" },
      })
      .lean();
 
    // 3. Ambil data presensi untuk konteks kehadiran
    const allAttendances = await Attendance.find({
      "projects.project_id": { $in: projectIds },
    })
      .populate({
        path: "user_id",
        select: "full_name email employee_code division_id",
        populate: { path: "division_id", select: "name" },
      })
      .populate({
        path: "tasks_today",
        select: "hour_weight status project_id",
        populate: { path: "project_id", select: "_id" },
      })
      .lean();
 
    // 4. Bangun lookup: projectId → tasks[]
    const tasksByProject = new Map();
    for (const task of allTasks) {
      const pid = task.project_id?.toString();
      if (!pid) continue;
      if (!tasksByProject.has(pid)) tasksByProject.set(pid, []);
      tasksByProject.get(pid).push(task);
    }
 
    // 5. Bangun lookup: projectId → attendance[]
    const attByProject = new Map();
    for (const att of allAttendances) {
      for (const contrib of att.projects ?? []) {
        const pid = contrib.project_id?.toString();
        if (!pid) continue;
        if (!attByProject.has(pid)) attByProject.set(pid, []);
        attByProject.get(pid).push({ att, contrib });
      }
    }
 
    // 6. Hitung statistik per proyek
    const projectStats = projects.map((project) => {
      const pid      = project._id.toString();
      const tasks    = tasksByProject.get(pid) ?? [];
      const attRows  = attByProject.get(pid)   ?? [];
 
      // ── Task breakdown by status ──
      const taskBreakdown = {
        planned:  0,
        ongoing:  0,
        done:     0,
        approved: 0,
        rejected: 0,
        total:    tasks.length,
      };
      for (const t of tasks) taskBreakdown[t.status] = (taskBreakdown[t.status] ?? 0) + 1;
 
      // ── Kalkulasi berbasis hour_weight (approved only) ──
      const approvedTasks   = tasks.filter((t) => t.status === "approved");
      const totalApprovedHw = approvedTasks.reduce((s, t) => s + (Number(t.hour_weight) || 0), 0);
      const totalAllHw      = tasks.reduce((s, t) => s + (Number(t.hour_weight) || 0), 0);
 
      // ── Contributor map (dari approved tasks) ──
      const contribMap = new Map(); // uid → { user, hour_weight, task_count }
      for (const task of approvedTasks) {
        const userObj = task.user_id;
        const uid     = userObj?._id?.toString() ?? task.user_id?.toString() ?? "unknown";
        if (!contribMap.has(uid)) {
          contribMap.set(uid, { user: userObj, total_hw: 0, task_count: 0 });
        }
        const e = contribMap.get(uid);
        e.total_hw   += Number(task.hour_weight) || 0;
        e.task_count += 1;
      }
 
      const contributors = Array.from(contribMap.entries())
        .map(([uid, e]) => {
          // IMPORTANT:
          // Denominator uses ALL project task hour weights, so when new tasks are added,
          // each contributor percentage can go down (aligned with project progress behavior).
          const pct =
            totalAllHw > 0 ? (e.total_hw / totalAllHw) * 100 : 0;
          return {
            user_id: uid,
            user_name: e.user?.full_name ?? "Unknown",
            user_email: e.user?.email ?? "",
            employee_code: e.user?.employee_code ?? "",
            division: e.user?.division_id?.name ?? "",
            contribution_pct: AnalyticsController.round(pct),
            total_hour_weight: AnalyticsController.round(e.total_hw),
            approved_task_count: e.task_count,
          };
        })
        .sort((a, b) => b.contribution_pct - a.contribution_pct);
 
      // ── Attendance summary (dari Attendance.projects) ──
      const uniqueAttUsers = new Set(attRows.map((r) => r.att.user_id?._id?.toString()));
      const totalDailyContrib = attRows.reduce(
        (s, r) => s + AnalyticsController.deriveAttendanceProjectContributionFromDoneTasks(r.att, pid, totalAllHw),
        0
      );
 
      // ── Health ──
      const health = AnalyticsController.calcHealth(project);
 
      // ── Estimasi selesai (linear projection) ──
      let estimatedEndDate = null;
      if (
        project.start_date &&
        totalApprovedHw > 0 &&
        (project.percentage ?? 0) > 0 &&
        (project.percentage ?? 0) < 100
      ) {
        const daysElapsed = AnalyticsController.daysDiff(project.start_date, new Date());
        const daysNeeded  = Math.ceil(daysElapsed / ((project.percentage ?? 1) / 100));
        const est         = new Date(project.start_date);
        est.setDate(est.getDate() + daysNeeded);
        estimatedEndDate = est.toISOString().split("T")[0];
      }
 
      return {
        project: {
          _id:                 project._id,
          code:                project.code,
          name:                project.name,
          work_type:           project.work_type,
          percentage:          project.percentage ?? 0,
          status:              project.status,
          start_date:          project.start_date,
          end_date:            project.end_date,
          target_end_date:     project.target_end_date ?? null,       // ← baru
          target_end_history:  project.target_end_history ?? [],      // ← baru
          created_at:          project.created_at,
        },
        health: {
          label:                health.label,
          target_label:         health.target_label,
          progress_pct:         health.progress_pct,
        
          // Waktu terpakai
          deadline_elapsed_pct: health.deadline_elapsed_pct,
          target_elapsed_pct:   health.target_elapsed_pct,   // FIX: sebelumnya selalu null
        
          // Estimasi selesai
          estimated_end_date:   estimatedEndDate,
        
          // Deadline formal (end_date)
          days_to_deadline:     project.end_date
            ? Math.max(0, AnalyticsController.daysDiff(now, project.end_date))   // FIX: dari now
            : null,
          days_past_deadline:   project.end_date &&
            now > new Date(project.end_date) &&
            project.status !== "completed"
              ? AnalyticsController.daysDiff(project.end_date, now)
              : 0,
        
          // Target manual (target_end_date)
          days_to_target:       project.target_end_date
            ? Math.max(0, AnalyticsController.daysDiff(project.end_date ?? now, project.target_end_date))  // FIX: dari now bukan end_date
            : null,
          days_past_target:     project.target_end_date &&
            now > new Date(project.target_end_date) &&
            project.status !== "completed"
              ? AnalyticsController.daysDiff(project.target_end_date, now)
              : 0,
        
          // Target revision
          target_revision_count: project.target_end_history?.length ?? 0,
        },
        task_statistics: {
          ...taskBreakdown,
          total_hour_weight_all:      AnalyticsController.round(totalAllHw),
          total_hour_weight_approved: AnalyticsController.round(totalApprovedHw),
          completion_rate_by_count:
            tasks.length > 0
              ? AnalyticsController.round(
                  (taskBreakdown.approved / tasks.length) * 100
                )
              : 0,
          completion_rate_by_hours:
            totalAllHw > 0
              ? AnalyticsController.round((totalApprovedHw / totalAllHw) * 100)
              : 0,
        },
        attendance_summary: {
          total_daily_records:       attRows.length,
          unique_active_users:       uniqueAttUsers.size,
          total_daily_contribution:  AnalyticsController.round(totalDailyContrib),
          avg_daily_contribution:
            attRows.length > 0
              ? AnalyticsController.round(totalDailyContrib / attRows.length)
              : 0,
        },
        contributors, // top contributors sorted by contribution_pct
      };
    });
 
    // 7. Overall statistics
    const overallStats = {
      total_projects: projects.length,
      by_status: {
        planned:   projects.filter((p) => p.status === "planned").length,
        ongoing:   projects.filter((p) => p.status === "ongoing").length,
        completed: projects.filter((p) => p.status === "completed").length,
        cancelled: projects.filter((p) => p.status === "cancelled").length,
      },
      by_work_type: {
        management: projects.filter((p) => p.work_type === "management").length,
        technic:    projects.filter((p) => p.work_type === "technic").length,
      },
      by_health: {
        on_track:    projectStats.filter((ps) => ps.health.label === "on_track").length,
        at_risk:     projectStats.filter((ps) => ps.health.label === "at_risk").length,
        behind:      projectStats.filter((ps) => ps.health.label === "behind").length,
        no_deadline: projectStats.filter((ps) => ps.health.label === "no_deadline").length,
        completed:   projectStats.filter((ps) => ps.health.label === "completed").length,
        cancelled:   projectStats.filter((ps) => ps.health.label === "cancelled").length,
      },
      average_progress:
        projects.length > 0
          ? AnalyticsController.round(
              projects.reduce((s, p) => s + (p.percentage ?? 0), 0) /
                projects.length
            )
          : 0,
      // overdue_projects:
      // - jika end_date ada → overdue berdasarkan end_date
      // - jika end_date kosong tapi target_end_date ada → overdue berdasarkan target_end_date
      overdue_projects: projects.filter((p) => {
        if (p.status === "completed") return false;
        if (p.end_date) return new Date(p.end_date) < now;
        if (p.target_end_date) return new Date(p.target_end_date) < now;
        return false;
      }).length,
      total_approved_tasks: allTasks.filter((t) => t.status === "approved").length,
      total_tasks: allTasks.length,
    };
 
    return c.json({
      data: {
        overall: overallStats,
        projects: projectStats,
      },
    });
  } catch (err) {
    console.error("getProjectOverview error:", err);
    return c.json({ message: err.message ?? "Internal server error" }, 500);
  }
}

  // ─── getProjectDetails ───────────────────────────────────────
 
/**
 * GET /api/v1/analytics/project-details/:id
 *
 * Mengembalikan detail lengkap satu proyek:
 *  - metadata proyek + health
 *  - contributor breakdown (berbasis approved tasks)
 *  - task list lengkap dengan status breakdown
 *  - timeline harian (approved_at) untuk charting
 *  - attendance timeline (dari Attendance.projects)
 *  - pending tasks (done, belum approved)
 */
static async getProjectDetails(c) {
  try {
    const currentUser = c.get("user");
    if (!currentUser) return c.json({ message: "Unauthorized" }, 401);
    const now = new Date();
 
    const projectId = c.req.param("id");
 
    // 1. Proyek
    const project = await Project.findById(projectId).lean();
    if (!project) return c.json({ message: "Project not found" }, 404);
 
    // 2. Semua task terkait proyek ini
    const allTasks = await Task.find({ project_id: projectId })
      .populate({
        path: "user_id",
        select: "full_name email employee_code division_id",
        populate: { path: "division_id", select: "name" },
      })
      .populate({ path: "approved_by", select: "full_name email" })
      .sort({ created_at: -1 })
      .lean();
 
    // 3. Data presensi harian untuk proyek ini
    const attendances = await Attendance.find({
      "projects.project_id": projectId,
    })
      .populate({
        path: "user_id",
        select: "full_name email employee_code division_id",
        populate: { path: "division_id", select: "name" },
      })
      .populate({
        path: "tasks_today",
        select: "hour_weight status project_id",
        populate: { path: "project_id", select: "_id" },
      })
      .sort({ date: -1 })
      .lean();
 
    // ── Task breakdown by status ──
    const taskBreakdown = { planned: 0, ongoing: 0, done: 0, approved: 0, rejected: 0, total: allTasks.length };
    for (const t of allTasks) taskBreakdown[t.status] = (taskBreakdown[t.status] ?? 0) + 1;
 
    // ── Approved tasks → basis kalkulasi progress ──
    const approvedTasks = allTasks.filter((t) => t.status === "approved");
    const totalApprovedHw = approvedTasks.reduce((s, t) => s + (Number(t.hour_weight) || 0), 0);
    const totalAllHw      = allTasks.reduce((s, t) => s + (Number(t.hour_weight) || 0), 0);
 
    // ── Contributor map ──
    const contribMap = new Map();
    for (const task of approvedTasks) {
      const userObj = task.user_id;
      const uid     = userObj?._id?.toString() ?? task.user_id?.toString() ?? "unknown";
      if (!contribMap.has(uid)) {
        contribMap.set(uid, {
          user: userObj,
          total_hw:   0,
          task_count: 0,
          task_titles: [],
        });
      }
      const e = contribMap.get(uid);
      e.total_hw   += Number(task.hour_weight) || 0;
      e.task_count += 1;
      e.task_titles.push(task.title);
    }
 
    const contributors = Array.from(contribMap.entries())
      .map(([uid, e]) => {
        // Denominator uses ALL project task hour weights (align with project progress denominator)
        const pct =
          totalAllHw > 0 ? (e.total_hw / totalAllHw) * 100 : 0;
        return {
          user_id:             uid,
          user_name:           e.user?.full_name    ?? "Unknown",
          user_email:          e.user?.email         ?? "",
          employee_code:       e.user?.employee_code ?? "",
          division:            e.user?.division_id?.name ?? "",
          contribution_pct:    AnalyticsController.round(pct),
          total_hour_weight:   AnalyticsController.round(e.total_hw),
          approved_task_count: e.task_count,
          task_titles:         e.task_titles,
        };
      })
      .sort((a, b) => b.contribution_pct - a.contribution_pct);
 
    // ── Timeline harian dari approved tasks ──
    const timelineMap = new Map();
    for (const task of approvedTasks) {
      const dt      = task.approved_at ?? task.start_at ?? task.created_at;
      const dateStr = dt ? new Date(dt).toISOString().split("T")[0] : "unknown";
 
      if (!timelineMap.has(dateStr)) {
        timelineMap.set(dateStr, {
          date: dateStr,
          total_hour_weight: 0,
          total_contribution_pct: 0,
          task_count: 0,
          contributors: [],
        });
      }
 
      const entry = timelineMap.get(dateStr);
      const hw    = Number(task.hour_weight) || 0;
      // Denominator uses ALL project task hour weights, so daily contributions can go down
      // when new tasks are added to the project.
      const pct   = totalAllHw > 0 ? (hw / totalAllHw) * 100 : 0;
 
      entry.total_hour_weight    += hw;
      entry.total_contribution_pct += pct;
      entry.task_count           += 1;
 
      const userObj = task.user_id;
      const uid     = userObj?._id?.toString() ?? task.user_id?.toString() ?? "unknown";
      const existing = entry.contributors.find((c) => c.user_id === uid);
      if (existing) {
        existing.contribution_pct  += pct;
        existing.hour_weight       += hw;
        existing.task_count        += 1;
      } else {
        entry.contributors.push({
          user_id:          uid,
          user_name:        userObj?.full_name ?? "Unknown",
          user_email:       userObj?.email      ?? "",
          contribution_pct: pct,
          hour_weight:      hw,
          task_count:       1,
        });
      }
    }
 
    const taskTimeline = Array.from(timelineMap.values())
      .sort((a, b) => a.date.localeCompare(b.date)) // ascending → cocok untuk line chart
      .map((entry) => ({
        date:                   entry.date,
        total_hour_weight:      AnalyticsController.round(entry.total_hour_weight),
        total_contribution_pct: AnalyticsController.round(entry.total_contribution_pct),
        task_count:             entry.task_count,
        cumulative_pct:         0, // akan di-fill di bawah
        contributors:           entry.contributors
          .map((c) => ({
            ...c,
            contribution_pct: AnalyticsController.round(c.contribution_pct),
            hour_weight:      AnalyticsController.round(c.hour_weight),
          }))
          .sort((a, b) => b.contribution_pct - a.contribution_pct),
      }));
 
    // Hitung cumulative_pct (running total → cocok untuk area chart progress)
    // cumulative_pct is based on approved hour weights accumulated vs totalAllHw
    let cumulative = 0;
    for (const row of taskTimeline) {
      cumulative += row.total_contribution_pct;
      row.cumulative_pct = AnalyticsController.round(cumulative);
    }
 
    // ── Attendance timeline (snapshot harian dari Attendance.projects) ──
    const attTimelineMap = new Map();
    for (const att of attendances) {
      const dateStr = att.date ? new Date(att.date).toISOString().split("T")[0] : "unknown";
      // Attendance should already be associated with this project; fallback to tasks_today detection.
      const hasProject =
        (att.projects || []).some((p) => String(p?.project_id) === String(projectId)) ||
        (Array.isArray(att.tasks_today) &&
          att.tasks_today.some((t) => String(t?.project_id?._id || t?.project_id) === String(projectId)));
      if (!hasProject) continue;
 
      if (!attTimelineMap.has(dateStr)) {
        attTimelineMap.set(dateStr, {
          date:                      dateStr,
          total_daily_contribution:  0,
          attendance_count:          0,
          contributors:              [],
        });
      }
 
      const entry = attTimelineMap.get(dateStr);
      const dailyContribution = AnalyticsController.deriveAttendanceProjectContributionFromDoneTasks(att, projectId, totalAllHw);
      entry.total_daily_contribution += dailyContribution;
      entry.attendance_count         += 1;
 
      const userObj = att.user_id;
      const uid     = userObj?._id?.toString() ?? att.user_id?.toString() ?? "unknown";
      const existing = entry.contributors.find((c) => c.user_id === uid);

      const doneTasksForProject = (Array.isArray(att.tasks_today) ? att.tasks_today : [])
        .filter((t) => {
          const tPid = t?.project_id?._id?.toString?.() || t?.project_id?.toString?.() || t?.project_id;
          const st = t?.status;
          return String(tPid) === String(projectId) && (st === "done" || st === "approved");
        })
        .map((t) => ({
          task_id: t?._id,
          title: t?.title,
          hour_weight: Number(t?.hour_weight) || 0,
          status: t?.status,
        }));

      if (existing) {
        existing.daily_contribution += dailyContribution;
        existing.tasks_done = [...(existing.tasks_done || []), ...doneTasksForProject];
      } else {
        entry.contributors.push({
          user_id:             uid,
          user_name:           userObj?.full_name    ?? "Unknown",
          user_email:          userObj?.email         ?? "",
          division:            userObj?.division_id?.name ?? "",
          daily_contribution:  dailyContribution,
          tasks_done:          doneTasksForProject,
        });
      }
    }
 
    const attendanceTimeline = Array.from(attTimelineMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((entry) => ({
        date:                     entry.date,
        total_daily_contribution: AnalyticsController.round(entry.total_daily_contribution),
        attendance_count:         entry.attendance_count,
        avg_contribution:
          entry.attendance_count > 0
            ? AnalyticsController.round(
                entry.total_daily_contribution / entry.attendance_count
              )
            : 0,
        contributors: entry.contributors.map((c) => ({
          ...c,
          daily_contribution: AnalyticsController.round(c.daily_contribution),
        })),
      }));
 
    // ── Pending tasks (status "done", menunggu approval) ──
    const pendingTasks = allTasks
      .filter((t) => t.status === "done")
      .map((t) => ({
        _id:         t._id,
        title:       t.title,
        description: t.description,
        tier:        t.tier,
        note:        t.note,
        hour_weight: t.hour_weight,
        start_at:    t.start_at,
        created_at:  t.created_at,
        user: {
          user_id:       t.user_id?._id ?? t.user_id,
          user_name:     t.user_id?.full_name    ?? "Unknown",
          user_email:    t.user_id?.email         ?? "",
          employee_code: t.user_id?.employee_code ?? "",
          division:      t.user_id?.division_id?.name ?? "",
        },
      }));
 
    // ── Health & estimasi ──
    const health = AnalyticsController.calcHealth(project);
    let estimatedEndDate = null;
    if (
      project.start_date &&
      (project.percentage ?? 0) > 0 &&
      (project.percentage ?? 0) < 100
    ) {
      const daysElapsed = AnalyticsController.daysDiff(project.start_date, new Date());
      const daysNeeded  = Math.ceil(daysElapsed / ((project.percentage ?? 1) / 100));
      const est         = new Date(project.start_date);
      est.setDate(est.getDate() + daysNeeded);
      estimatedEndDate = est.toISOString().split("T")[0];
    }
 
    // ── Raw task list (untuk tabel detail) ──
    const taskList = allTasks.map((t) => ({
      _id:         t._id,
      title:       t.title,
      description: t.description,
      tier:        t.tier,
      note:        t.note,
      status:      t.status,
      hour_weight: t.hour_weight,
      start_at:    t.start_at,
      approved_at: t.approved_at,
      approved_by: t.approved_by
        ? { user_id: t.approved_by._id, user_name: t.approved_by.full_name }
        : null,
      created_at:  t.created_at,
      user: {
        user_id:       t.user_id?._id ?? t.user_id,
        user_name:     t.user_id?.full_name    ?? "Unknown",
        user_email:    t.user_id?.email         ?? "",
        employee_code: t.user_id?.employee_code ?? "",
        division:      t.user_id?.division_id?.name ?? "",
      },
    }));
 
    return c.json({
      data: {
        project: {
          _id:                project._id,
          code:               project.code,
          name:               project.name,
          work_type:          project.work_type,
          percentage:         project.percentage ?? 0,
          status:             project.status,
          start_date:         project.start_date,
          end_date:           project.end_date,
          target_end_date:    project.target_end_date ?? null,      // ← baru
          target_end_history: project.target_end_history ?? [],     // ← baru
          created_at:         project.created_at,
          updated_at:         project.updated_at,
        },
    
        health: {
          label:                health.label,
          target_label:         health.target_label,
          progress_pct:         health.progress_pct,
        
          // Waktu terpakai
          deadline_elapsed_pct: health.deadline_elapsed_pct,
          target_elapsed_pct:   health.target_elapsed_pct,   // FIX: sebelumnya selalu null
        
          // Estimasi selesai
          estimated_end_date:   estimatedEndDate,
        
          // Deadline formal (end_date)
          days_to_deadline:     project.end_date
            ? Math.max(0, AnalyticsController.daysDiff(project.start_date ?? now, project.end_date))   // FIX: sebelumnya dari start_date
            : null,
          days_past_deadline:   project.end_date &&
            now > new Date(project.end_date) &&
            project.status !== "completed"
              ? AnalyticsController.daysDiff(project.end_date, now)
              : 0,
        
          // Target manual (target_end_date)
          days_to_target:       project.target_end_date
            ? Math.max(0, AnalyticsController.daysDiff(project.end_date ?? now, project.target_end_date))  // FIX: dari now bukan end_date
            : null,
          days_past_target:     project.target_end_date &&     // FIX: logika kondisi & kalkulasi diperbaiki
            now > new Date(project.target_end_date) &&
            project.status !== "completed"
              ? AnalyticsController.daysDiff(project.target_end_date, now)
              : 0,
        
          // Target revision
          target_revision_count: project.target_end_history?.length ?? 0,
        },
        task_statistics: {
          ...taskBreakdown,
          total_hour_weight_all:       AnalyticsController.round(totalAllHw),
          total_hour_weight_approved:  AnalyticsController.round(totalApprovedHw),
          total_hour_weight_pending:   AnalyticsController.round(
            allTasks
              .filter((t) => t.status === "done")
              .reduce((s, t) => s + (Number(t.hour_weight) || 0), 0)
          ),
          completion_rate_by_count:
            allTasks.length > 0
              ? AnalyticsController.round(
                  (taskBreakdown.approved / allTasks.length) * 100
                )
              : 0,
          completion_rate_by_hours:
            totalAllHw > 0
              ? AnalyticsController.round((totalApprovedHw / totalAllHw) * 100)
              : 0,
        },
 
        contributors,   // siapa yang berkontribusi & seberapa besar (%)
 
        pending_tasks: pendingTasks,  // tasks "done" yang belum di-approve
 
        task_timeline:       taskTimeline,       // daily breakdown dari approved tasks (+ cumulative)
        attendance_timeline: attendanceTimeline, // daily snapshot dari Attendance.projects
 
        // Seluruh task untuk tabel detail (frontend bisa filter/sort sendiri)
        tasks: taskList,
      },
    });
  } catch (err) {
    console.error("getProjectDetails error:", err);
    return c.json({ message: err.message ?? "Internal server error" }, 500);
  }
}
}

export default AnalyticsController;

