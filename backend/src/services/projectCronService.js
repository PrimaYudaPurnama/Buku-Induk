import { Cron } from "croner";
import Project from "../models/project.js";
export const startProjectCronJob = () => {
  new Cron("0 */6 * * *", async () => {
    try {

      const now = new Date()

      const result = await Project.updateMany(
        {
          status: "planned",
          start_date: { $lte: now }
        },
        {
          $set: { status: "ongoing" }
        }
      )

      console.log("updated:", result.modifiedCount)

    } catch (err) {
      console.error(err)
    }
  })
}