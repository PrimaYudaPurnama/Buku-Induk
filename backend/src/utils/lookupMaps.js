import User from "../models/user.js";
import Project from "../models/project.js";
import Activity from "../models/activity.js";

/**
 * Load all required lookup data into memory maps before processing rows.
 * This prevents N+1 queries inside the per-row loop.
 *
 * @returns {{
 *   userMap: Map<string, object>,       // full_name (lowercase) → User doc
 *   projectMap: Map<string, object>,    // code (uppercase)       → Project doc
 *   activityMap: Map<string, object>,   // name_activity (lower)  → Activity doc
 * }}
 */
export async function buildLookupMaps() {
  const [users, projects, activities] = await Promise.all([
    User.find({}, "full_name employee_code division_id").lean(),
    Project.find({}, "code name work_type").lean(),
    Activity.find({}, "name_activity").lean(),
  ]);

  const userMap = new Map(
    users.map((u) => [u.full_name.trim().toLowerCase(), u])
  );

  const projectMap = new Map(
    projects.map((p) => [p.code.trim().toUpperCase(), p])
  );

  const activityMap = new Map(
    activities.map((a) => [a.name_activity.trim().toLowerCase(), a])
  );

  return { userMap, projectMap, activityMap };
}

/**
 * Resolve an activity name:
 *  - If found in the map → return its _id.
 *  - If not found       → create a new Activity document, add to map, return _id.
 *
 * @param {string}               name
 * @param {Map<string, object>}  activityMap  (mutated in-place on creation)
 * @returns {Promise<ObjectId>}
 */
export async function resolveOrCreateActivity(name, activityMap) {
  const key = name.trim().toLowerCase();
  if (activityMap.has(key)) {
    return activityMap.get(key)._id;
  }

  const doc = await Activity.create({ name_activity: name.trim() });
  activityMap.set(key, doc.toObject());
  return doc._id;
}