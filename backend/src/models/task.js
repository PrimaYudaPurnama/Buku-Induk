import mongoose from "mongoose";

const TaskSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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

    progress: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    status: {
      type: String,
      enum: ["ongoing", "done"],
      default: "ongoing",
      index: true,
    },

    completed_at: {
      type: Date,
      default: null,
    },

    weight: {
      type: Number,
      default: 1, // untuk future KPI
      min: 1,
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
    if (this.progress >= 100) {
      this.progress = 100;
      this.status = "done";
  
      if (!this.completed_at) {
        this.completed_at = new Date();
      }
    } else {
      this.status = "ongoing";
      this.completed_at = null;
    }
  
    next();
  });

export default mongoose.model("Task", TaskSchema);