import AccountRequest from "../models/accountRequest.js";
import Approval from "../models/approval.js";
import User from "../models/user.js";
import Role from "../models/role.js";
import Division from "../models/division.js";
import { generateApprovalSteps } from "../lib/approvalWorkflows.js";

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
}

export default AnalyticsController;

