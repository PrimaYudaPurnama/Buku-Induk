import mongoose from "mongoose";

/**
 * LateAttendanceRequest is NOT an attendance record.
 * Approval grants permission to create a late attendance record.
 * Approval MUST NOT auto-create attendance.
 */
const LateAttendanceRequestSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Requested date (normalized to 00:00 by service; client sends YYYY-MM-DD)
    date: {
      type: Date,
      required: true,
      index: true,
    },

    late_reason: {
      type: String,
      required: true,
      trim: true,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "filled"],
      default: "pending",
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

    rejected_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejected_at: {
      type: Date,
      default: null,
    },
    rejected_reason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

// Strict integrity: one request per user per date (auditable; no duplicates).
LateAttendanceRequestSchema.index({ user_id: 1, date: 1 }, { unique: true });

export default mongoose.model(
  "LateAttendanceRequest",
  LateAttendanceRequestSchema
);

