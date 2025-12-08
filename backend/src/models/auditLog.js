import mongoose from "mongoose";

const AuditLogSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null, // null for system actions
      index: true, // idx_audit_logs_user
    },

    action: {
      type: String,
      required: true,
      trim: true,
      index: true, // idx_audit_logs_action
    },

    resource_type: {
      type: String,
      required: true,
      trim: true,
    },

    resource_id: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    old_value: {
      type: mongoose.Schema.Types.Mixed, // JSONB replacement
      default: null,
    },

    new_value: {
      type: mongoose.Schema.Types.Mixed, // JSONB replacement
      default: null,
    },

    ip_address: {
      type: String,
      default: null,
    },

    user_agent: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false, // immutable
    },
  }
);

// Compound index: resource_type + resource_id
AuditLogSchema.index({ resource_type: 1, resource_id: 1 }); // idx_audit_logs_resource

// created_at DESC index
AuditLogSchema.index({ created_at: -1 }); // idx_audit_logs_created_at

export default mongoose.model("AuditLog", AuditLogSchema);
