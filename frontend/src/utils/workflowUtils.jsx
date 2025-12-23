/**
 * Approval Workflow Configuration
 * Maps backend workflow to frontend display
 */

export const WORKFLOW_CONFIG = {
  account_request: {
    name: "Account Request",
    steps: [
      { level: 1, approver_role: "Manager HR", description: "HR Manager Review" },
      { level: 2, approver_role: "Director", description: "Director Approval" },
    ],
  },
  promotion: {
    name: "Promotion Request",
    steps: [
      { level: 1, approver_role: "Manager", description: "Direct Manager" },
      { level: 2, approver_role: "Manager HR", description: "HR Manager Review" },
      { level: 3, approver_role: "Director", description: "Director Approval" },
    ],
  },
  termination: {
    name: "Termination Request",
    steps: [
      { level: 1, approver_role: "Manager", description: "Division Manager" },
      { level: 2, approver_role: "Manager HR", description: "HR Manager Approval" },
    ],
  },
  transfer: {
    name: "Transfer Request",
    steps: [
      { level: 1, approver_role: "Manager", description: "Current Manager" },
      { level: 2, approver_role: "Manager", description: "Target Division Manager" },
      { level: 3, approver_role: "Manager HR", description: "HR Manager Approval" },
    ],
  },
  salary_change: {
    name: "Salary Change Request",
    steps: [
      { level: 1, approver_role: "Manager", description: "Division Manager" },
      { level: 2, approver_role: "Manager HR", description: "HR Manager Review" },
      { level: 3, approver_role: "Director", description: "Director Approval" },
    ],
  },
};

/**
 * Get workflow steps for a request type
 * @param {string} requestType - Request type (account_request, promotion, etc.)
 * @returns {Array} Array of workflow steps
 */
export const getWorkflowSteps = (requestType) => {
  return WORKFLOW_CONFIG[requestType]?.steps || [];
};

/**
 * Get workflow name for a request type
 * @param {string} requestType - Request type
 * @returns {string} Workflow name
 */
export const getWorkflowName = (requestType) => {
  return WORKFLOW_CONFIG[requestType]?.name || requestType;
};

/**
 * Get role name for approval step
 * @param {object} approval - Approval object
 * @param {string} requestType - Request type
 * @returns {string} Role name
 */
export const getApproverRoleName = (approval, requestType) => {
  // If approval has approver_id with role, use that
  if (approval?.approver_id?.role_id?.name) {
    return approval.approver_id.role_id.name;
  }

  // Otherwise, get from workflow config
  const workflowSteps = getWorkflowSteps(requestType);
  const step = workflowSteps.find((s) => s.level === approval?.approval_level);
  return step?.approver_role || "Unknown";
};

/**
 * Get step description for approval
 * @param {object} approval - Approval object
 * @param {string} requestType - Request type
 * @returns {string} Step description
 */
export const getStepDescription = (approval, requestType) => {
  const workflowSteps = getWorkflowSteps(requestType);
  const step = workflowSteps.find((s) => s.level === approval?.approval_level);
  return step?.description || `Level ${approval?.approval_level}`;
};

/**
 * Map approvals to steps with workflow info
 * @param {Array} approvals - Array of approval objects
 * @param {string} requestType - Request type
 * @returns {Array} Mapped steps with workflow info
 */
export const mapApprovalsToSteps = (approvals, requestType) => {
  const workflowSteps = getWorkflowSteps(requestType);
  
  // Create a map of level to workflow step
  const workflowMap = {};
  workflowSteps.forEach((step) => {
    workflowMap[step.level] = step;
  });

  // Map approvals to steps
  return approvals.map((approval) => {
    const workflowStep = workflowMap[approval.approval_level];
    return {
      ...approval,
      workflowRole: workflowStep?.approver_role || "Unknown",
      workflowDescription: workflowStep?.description || `Level ${approval.approval_level}`,
      approverName: approval.approver_id?.full_name || "N/A",
      approverEmail: approval.approver_id?.email || null,
    };
  });
};

/**
 * Get expected workflow steps for display (before approvals are created)
 * @param {string} requestType - Request type
 * @returns {Array} Expected workflow steps
 */
export const getExpectedWorkflowSteps = (requestType) => {
  return getWorkflowSteps(requestType).map((step) => ({
    level: step.level,
    approver_role: step.approver_role,
    description: step.description,
    status: "pending",
  }));
};

