import mongoose from "mongoose";

const AbsenceRequestSchema = new mongoose.Schema({
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  
    type: {
      type: String,
      enum: ["sick", "leave", "permission"],
      required: true,
    },
  
    start_date: {
      type: Date,
      required: true,
    },
  
    end_date: {
      type: Date,
      required: true,
    },
  
    reason: String,
  
    attachment_url: {
      type: String,
      default: null,
    },
  
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
  
    approved_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  
    approved_at: Date,
    rejected_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    rejected_at: {
      type: Date,
      default: null,
    },
    rejected_reason: {
      type: String,
      trim: true,
      default: "",
    },
  }, { timestamps: true });

AbsenceRequestSchema.index({ user_id: 1, status: 1 });
AbsenceRequestSchema.index({ user_id: 1, start_date: 1, end_date: 1 });

export default mongoose.model("AbsenceRequest", AbsenceRequestSchema);