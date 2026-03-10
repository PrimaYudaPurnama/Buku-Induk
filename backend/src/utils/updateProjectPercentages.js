import Project from "../models/project.js";

/**
 * Accumulate contribution_percentage from newly imported attendance payloads
 * into Project.percentage, capped at 100.
 *
 * Logic per project:
 *   new_percentage = MIN(current_percentage + sum_of_contributions_this_import, 100)
 *
 * Uses a single bulkWrite so it's one round-trip regardless of how many
 * projects are involved.
 *
 * IMPORTANT – race condition note:
 * We use the aggregation pipeline form of updateOne ($set with $min/$add)
 * so the cap is applied atomically inside MongoDB without a read-modify-write
 * in application code.
 *
 * @param {Array<{ project_id: ObjectId, contribution_percentage: number }>} contributions
 *   Flat list of every project entry from every successfully saved attendance row.
 *   May contain the same project_id multiple times (one per attendance row).
 */
export async function updateProjectPercentages(contributions) {
  if (!contributions.length) return;

  // ── 1. Sum contributions per project_id ───────────────────────────────────
  // Map<project_id.toString(), totalAdded>
  const totals = new Map();

  for (const { project_id, contribution_percentage } of contributions) {
    const key = project_id.toString();
    totals.set(key, (totals.get(key) ?? 0) + (contribution_percentage ?? 0));
  }

  // ── 2. Build bulkWrite ops ─────────────────────────────────────────────────
  // Each op uses an aggregation pipeline update so MongoDB resolves
  // the $min(current + added, 100) atomically — no extra read needed.
  const ops = Array.from(totals.entries()).map(([idStr, added]) => ({
    updateOne: {
      filter: { _id: idStr },
      update: [
        {
          $set: {
            percentage: {
              $min: [{ $add: ["$percentage", added] }, 100],
            },
          },
        },
      ],
    },
  }));

  // ── 3. Execute ────────────────────────────────────────────────────────────
  await Project.bulkWrite(ops, { ordered: false });
}