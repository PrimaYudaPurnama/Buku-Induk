/**
 * Role Hierarchy Configuration
 * Lower hierarchy_level = Higher authority
 * Based on database structure
 */
export const ROLE_HIERARCHY = {
  Superadmin: 1,
  Admin: 2,
  Director: 3,
  Investor: 3, // Same level as Director
  "Manager HR": 4,
  "General Manager": 4,
  Finance: 4,
  Manager: 5,
  "Team Lead": 6,
  Staff: 7,
};

/**
 * Get hierarchy level for a role name
 */
export const getRoleHierarchyLevel = (roleName) => {
  return ROLE_HIERARCHY[roleName] || 999;
};

/**
 * Check if role1 has higher or equal authority than role2
 */
export const hasHigherOrEqualAuthority = (role1Name, role2Name) => {
  const level1 = getRoleHierarchyLevel(role1Name);
  const level2 = getRoleHierarchyLevel(role2Name);
  return level1 <= level2;
};

/**
 * Get role name by hierarchy level
 */
export const getRoleByLevel = (level) => {
  return Object.keys(ROLE_HIERARCHY).find(
    (role) => ROLE_HIERARCHY[role] === level
  );
};

