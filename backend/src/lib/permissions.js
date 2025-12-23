/**
 * Base permission catalog used by the system.
 * These values are merged with whatever is stored in roles,
 * so the list stays dynamic if new permissions are introduced.
 */
export const BASE_PERMISSIONS = [
  "user:create",
  "user:update",
  "user:delete",
  "user:read:any",
  "user:read:own_division",
  "user:read:self",
  "user:view_history:any",
  "user:view_history:own_division",
  "user:view_history:self",
  "user:view_salary:any",
  "user:view_salary:own_division",
  "user:view_salary:self",
  "user:export",
  "account:create",
  "account:approve:any",
  "account:approve:own_division",
  "employee:promote:any",
  "employee:promote:own_division",
  "employee:terminate:any",
  "employee:terminate:own_division",
  "employee:transfer:any",
  "system:manage_divisions",
  "system:manage_roles",
  "system:view_audit_logs",
  "system:view_analytics",
  "dashboard:read",
  "report:financial:read",
];

/**
 * Merge base catalog with dynamic values from database.
 * @param {string[]} rolePermissions - permissions pulled from Role documents
 * @returns {string[]} unique, sorted permission list
 */
export const buildPermissionCatalog = (rolePermissions = []) => {
  const merged = new Set([...BASE_PERMISSIONS, ...(rolePermissions || [])]);
  return Array.from(merged).sort();
};

