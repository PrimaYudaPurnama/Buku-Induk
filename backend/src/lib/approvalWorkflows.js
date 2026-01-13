/**
 * Approval Workflow Configuration
 * Defines approval steps for different request types
 */

/**
 * Generate approval steps for a request type
 * @param {string} requestType - Type of request (promotion, termination, transfer)
 * @param {object} userData - User data (current role, division, etc.)
 * @param {object} payload - Additional payload data
 * @returns {Array} Array of approval steps with level and approver_role
 */
export const generateApprovalSteps = (requestType, userData = {}, payload = {}) => {
  const workflows = {
    promotion: () => {
      // Promote to Manager workflow
      // Step 1 → Direct Manager (skip if no division)
      // Step 2 → HR Manager
      // Step 3 → Director
      const steps = [];
      
      // Skip level 1 (Manager) if user has no division_id
      // if (userData.currentDivision) {
      //   steps.push({ level: 1, approver_role: "Manager" });
      // }
      
      // steps.push({ level: 2, approver_role: "Manager HR" });
      steps.push({ level: 3, approver_role: "Director" });
      
      return steps;
    },

    termination: () => {
      // Terminate Employee workflow
      // Step 1 → Division Manager (skip if no division)
      // Step 2 → HR Manager
      const steps = [];
      
      // Skip level 1 (Manager) if user has no division_id
      // if (userData.currentDivision) {
      //   steps.push({ level: 1, approver_role: "Manager" }); // Division Manager
      // }
      
      // steps.push({ level: 2, approver_role: "Manager HR" });
      steps.push({ level: 3, approver_role: "Director" })
      
      return steps;
    },

    transfer: () => {
      // Transfer Division workflow
      // Step 1 → Current Manager (skip if no current division)
      // Step 2 → Target Division Manager
      // Step 3 → HR Manager
      const steps = [];
      
      // Skip level 1 (Current Manager) if user has no division_id
      // if (userData.currentDivision) {
      //   steps.push({ level: 1, approver_role: "Manager" }); // Current Manager
      // }
      
      // // Level 2: Target Division Manager (always present if transfer has target division)
      // steps.push({ level: 2, approver_role: "Manager" }); // Target Division Manager
      // steps.push({ level: 3, approver_role: "Manager HR" });
      steps.push({ level: 3, approver_role: "Director" });
      
      return steps;
    },

    account_request: () => {
      // Account Request workflow (default)
      // Step 1 → Manager HR
      // Step 2 → Director
      return [
        // { level: 1, approver_role: "Manager HR" },
        { level: 2, approver_role: "Director" },
      ];
    },
  };

  const workflow = workflows[requestType];
  if (!workflow) {
    throw new Error(`Unknown request type: ${requestType}`);
  }

  return workflow();
};

/**
 * Get all valid request types
 */
export const getRequestTypes = () => {
  return ["promotion", "termination", "transfer", "account_request"];
};

/**
 * Validate request type
 */
export const isValidRequestType = (requestType) => {
  return getRequestTypes().includes(requestType);
};

