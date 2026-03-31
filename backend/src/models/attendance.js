import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema(
  {
    // ===== USER =====
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    date: {
      type: Date,
      required: true,
    },

    // ===== JAM =====
    checkIn_at: {
      type: Date,
      required: true,
    },

    checkOut_at: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["normal", "late", "manual", "forget", "late_checkin", "early_checkout"],
      default: "normal",
    },

    /**
     * Late attendance audit linkage:
     * - Approval is stored on LateAttendanceRequest, NOT here.
     * - We keep a reference + copy approval metadata for immutable audit snapshots.
     */
    late_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LateAttendanceRequest",
      default: null,
    },

    late_reason: {
      type: String,
      default: "",
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

    // ===== PERNYATAAN KESEDARAN =====
    user_consent: {
      checkIn: {
        type: Boolean,
        required: true,
      },
      checkOut: {
        type: Boolean,
        default: false,
      },
    },

    // Task yang disentuh hari ini (optional tapi powerful)
    tasks_today: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Task",
      },
    ],

    // ===== RELASI / KONTRIBUSI PROYEK HARIAN =====
    // Embedded objects so each attendance carries its own contribution facts.
    projects: [
      {
        project_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Project",
          required: true,
        },
        // How much progress was added TODAY for this project (0–100, typically small).
        // contribution_percentage: {
        //   type: Number,
        //   required: true,
        //   min: 0,
        //   max: 100,
        // },
      },
    ],

    activities: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Activity",
      },
    ],

    // ===== CATATAN =====
    note: {
      type: String,
      trim: true,
      default: "",
    },
  },
  { timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  }, }
);

// ===== ANTI DOUBLE PRESENSI =====
AttendanceSchema.index(
  { user_id: 1, date: 1 },
  { unique: true }
);

export default mongoose.model("Attendance", AttendanceSchema);
