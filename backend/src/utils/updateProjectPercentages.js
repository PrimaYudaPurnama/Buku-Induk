import Project from "../models/project.js";

/**
 * REPLACE Project.percentage with the value from the latest attendance import.
 *
 * Behaviour change from previous version:
 *   OLD → accumulate: percentage = MIN(current + contributed, 100)
 *   NEW → replace:    percentage = MIN(contributed, 100)
 *
 * If a project appears in multiple rows in the same import file, the LAST
 * encountered value wins (last-write-wins within a single import batch).
 * This mirrors how the attendance subdoc stores the percentage.
 *
 * Uses a single bulkWrite — one round-trip regardless of project count.
 *
 * @param {Array<{ project_id: ObjectId, contribution_percentage: number }>} contributions
 */
export async function updateProjectPercentages(contributions) {
  if (!contributions.length) return;

  // Last-write-wins: if the same project appears multiple times, take the last value
  const latestPct = new Map();
  for (const { project_id, contribution_percentage } of contributions) {
    latestPct.set(project_id.toString(), contribution_percentage ?? 0);
  }

  const ops = Array.from(latestPct.entries()).map(([idStr, pct]) => ({
    updateOne: {
      filter: { _id: new Object(idStr) },  // cast to allow string _id comparison
      update: { $set: { percentage: Math.min(pct, 100) } },
    },
  }));

  await Project.bulkWrite(ops, { ordered: false });
}