import mongoose from "mongoose";

const DocumentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Can be null if account_request_id is set
      index: true, // idx_documents_user
    },

    account_request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountRequest",
      default: null,
      index: true, // idx_documents_account_request
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

// Compound index for account_request documents
DocumentSchema.index({ account_request_id: 1, document_type: 1 }); // idx_documents_account_request_type

// Validation: either user_id or account_request_id must be set
DocumentSchema.pre("validate", function (next) {
  if (!this.user_id && !this.account_request_id) {
    return next(new Error("Either user_id or account_request_id must be provided"));
  }
  next();
});

export default mongoose.model("Document", DocumentSchema);
