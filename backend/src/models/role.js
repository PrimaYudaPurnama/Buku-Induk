import mongoose from "mongoose";

const RoleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      default: "",
    },

    permissions: {
      type: [String], // JSONB → array of strings
      default: [],
    },

    hierarchy_level: {
      type: Number,
      required: true, // Lower = higher authority
      index: true,    // Same as idx_roles_hierarchy
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export default mongoose.model("Role", RoleSchema);
