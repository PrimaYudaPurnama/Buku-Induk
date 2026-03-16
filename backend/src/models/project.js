import mongoose from "mongoose";

const ProjectSchema = new mongoose.Schema(
  {
    // ===== IDENTITAS =====
    code: {
      type: String,
      required: true,
      uppercase: true,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ===== TIPE KERJA =====
    work_type: {
      type: String,
      enum: ["management", "technic"],
      required: true,
    },

    // Progress project (0-100). Di-update otomatis dari akumulasi task
    // melalui layanan projectProgressService, bukan dari input manual.
    percentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },

    // ===== STATUS TURUNAN =====
    status: {
      type: String,
      enum: ["planned", "ongoing", "completed", "cancelled"],
      default: "planned",
    },

    // ===== TIMELINE =====
    start_date: {
      type: Date,
      default: null,
    },

    end_date: {
      type: Date,
      default: null,
    },
  },
  { timestamps: {
    createdAt: "created_at",
    updatedAt: "updated_at",
  }, }
);

export default mongoose.model("Project", ProjectSchema);