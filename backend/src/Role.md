
Superadmin: [
  "user:create", "user:read:any", "user:update:any", "user:delete",
  "user:view_history:any", "user:view_salary:any", "user:export"
]

Admin: [
  "user:create", "user:read:any", "user:update:any",
  "user:view_history:any", "user:view_salary:any", "user:export"
]

Director / Manager HR / GM / Finance: [
  "user:read:any", "user:view_history:any", "user:view_salary:any"
]

Manager (Division): [
  "user:read:own_division",
  "user:view_history:own_division",
  "user:view_salary:own_division"
]

Team Lead: [
  "user:read:self",
  "user:view_history:self",
  "user:view_salary:self"
]

Staff: [
  "user:read:self",
  "user:view_history:self",
  "user:view_salary:self"
]