import mongoose from "mongoose";

const AccountRequestSchema = new mongoose.Schema(
  {
    requester_name: {
      type: String,
      required: true,
      trim: true,
    },

    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true, // idx_account_requests_email
    },

    phone: {
      type: String,
      default: null,
    },

    requested_role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    division_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Division",
      required: function() {
        // Required for account_request and transfer
        // Optional for promotion and termination (user might not have division)
        return this.request_type === "account_request" || this.request_type === "transfer";
      },
      index: true, // idx_account_requests_division
    },

    request_type: {
      type: String,
      enum: ["account_request", "promotion", "termination", "transfer"],
      default: "account_request",
      index: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // For account_request, this is null. For promotion/termination/transfer, this is the user being affected
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
      index: true, // idx_account_requests_status
    },

    notes: {
      type: String,
      default: "",
    },

    comments: {
      type: String,
      default: "",
    },

    requested_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    processed_at: {
      type: Date,
      default: null,
    },

    setup_token: {
      type: String,
      default: null,
      index: true, // idx_account_requests_setup_token
    },

    setup_token_expires_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: "updated_at"
    },
  }
);

// Sort index (latest first)
AccountRequestSchema.index({ created_at: -1 }); // idx_account_requests_created_at

export default mongoose.model("AccountRequest", AccountRequestSchema);
