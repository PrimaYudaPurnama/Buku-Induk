import mongoose from "mongoose";

const ApprovalSchema = new mongoose.Schema(
  {
    request_type: {
      type: String,
      required: true,
      enum: [
        "account_request",
        "promotion",
        "termination",
        "transfer",
        "salary_change",
        "leave",
      ],
    },

    request_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AccountRequest",
      required: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // idx_approvals_user
    },

    approver_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true, // idx_approvals_approver
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true, // idx_approvals_status
    },

    comments: {
      type: String,
      default: "",
    },

    approval_level: {
      type: Number,
      default: 1,
    },

    processed_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false, // tidak ada updated_at di SQL
    },
  }
);

// Compound index: request_type + request_id
ApprovalSchema.index({ request_type: 1, request_id: 1 }); // idx_approvals_request

// created_at DESC index
ApprovalSchema.index({ created_at: -1 }); // idx_approvals_created_at

export default mongoose.model("Approval", ApprovalSchema);
