import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // idx_notifications_user
    },

    type: {
      type: String,
      required: true,
      enum: [
        "account_approved",
        "account_rejected",
        "approval_pending",
        "promotion",
        "termination",
        "transfer",
        "document_uploaded",
        "system_announcement",
      ],
      trim: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    message: {
      type: String,
      required: true,
    },

    action_url: {
      type: String,
      default: null,
    },

    is_read: {
      type: Boolean,
      default: false,
      index: true, // idx_notifications_is_read
    },

    read_at: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false,
    },
  }
);

// created_at DESC index
NotificationSchema.index({ created_at: -1 }); // idx_notifications_created_at

export default mongoose.model("Notification", NotificationSchema);
