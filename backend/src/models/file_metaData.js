import mongoose from "mongoose";

const file_metaData = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cloudinary_public_id: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    original_filename: String,
    size: Number, // dalam bytes
    mime_type: String,
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at",
    },
  }
);

export default mongoose.model("file_metaData", file_metaData);
