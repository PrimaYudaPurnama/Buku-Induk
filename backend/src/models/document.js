import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // idx_documents_user
    },

    document_type: {
      type: String,
      required: true,
      enum: [
        "contract",
        "id_card",
        "resume",
        "certificate",
        "performance_review",
        "disciplinary",
        "resignation",
        "termination",
        "other",
      ],
      index: true, // idx_documents_type
    },

    file_name: {
      type: String,
      required: true,
      trim: true,
    },

    file_url: {
      type: String,
      required: true,
    },

    file_size: {
      type: Number, // Bytes
      default: null,
    },

    mime_type: {
      type: String,
      default: null,
    },

    cloudinary_public_id: {
      type: String,
      default: null,
    },

    description: {
      type: String,
      default: "",
    },

    uploaded_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false, // SQL versi ini tidak ada updated_at
    },
  }
);

// created_at DESC index
DocumentSchema.index({ created_at: -1 }); // idx_documents_created_at

export default mongoose.model("Document", DocumentSchema);
