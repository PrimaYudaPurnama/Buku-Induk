import mongoose from "mongoose";

const MilestoneSchema = new mongoose.Schema(
  {
    // ===== RELASI PROJECT =====
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    // ===== NAMA MILESTONE =====
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // ===== KONTRIBUSI KE PROJECT =====
    weight: {
      type: Number, // persen
      required: true,
      min: 1,
      max: 100,
    },

    // ===== STATUS =====
    is_completed: {
      type: Boolean,
      default: false,
    },

    // ===== SIAPA YANG MENYETUJUI =====
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User", // supervisor / pembimbing
      default: null,
    },

    approved_at: {
      type: Date,
      default: null,
    },

    // ===== CATATAN (REVISI DLL) =====
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

// opsional: cegah milestone nama sama di project yang sama
MilestoneSchema.index(
  { project_id: 1, name: 1 },
  { unique: true }
);

export default mongoose.model("Milestone", MilestoneSchema);