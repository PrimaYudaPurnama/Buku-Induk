import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
      default: null,
      index: true,
    },

    // Optional linkage to a project. Only tasks with project_id
    // will be counted towards project percentage.
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    start_at: {
      type: Date,
      required: true,
      default: Date.now,
    },

    // Bobot jam untuk task ini (digunakan menghitung progress project).
    hour_weight: {
      type: Number,
      required: true,
      min: 0.25,
    },

    status: {
      type: String,
      enum: ["planned", "ongoing", "done", "approved", "rejected"],
      default: "planned",
      index: true,
    },

    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approved_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

TaskSchema.pre("save", function (next) {
  // Keep approval metadata in sync with status.
  if (this.isModified("status")) {
    if (this.status === "approved") {
      if (!this.approved_at) {
        this.approved_at = new Date();
      }
    } else {
      // Any status change away from approved clears approval metadata.
      this.approved_by = null;
      this.approved_at = null;
    }
  }

  next();
});

export default mongoose.model("Task", TaskSchema);