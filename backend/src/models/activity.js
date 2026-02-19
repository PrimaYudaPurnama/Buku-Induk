import mongoose from "mongoose";



const ActivitySchema = new mongoose.Schema(
  {
    name_activity: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export default mongoose.model("Activity", ActivitySchema);
