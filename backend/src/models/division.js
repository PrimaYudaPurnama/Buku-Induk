import mongoose from "mongoose";

const DivisionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 100,
      index: true, // idx_divisions_name
    },

    description: {
      type: String,
      default: "",
    },

    manager_id: {
      type: mongoose.Schema.Types.ObjectId, // UUID dari users.id
      ref: "User",
      default: null,
      index: true, // idx_divisions_manager
    },

    active_general_id: {
      type: mongoose.Schema.Types.ObjectId, // UUID
      ref: "User",
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

export default mongoose.model("Division", DivisionSchema);
