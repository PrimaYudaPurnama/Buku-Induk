import mongoose from "mongoose";

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },

    full_name: {
      type: String,
      required: true,
      trim: true,
      index: "text",
    },

    password: {
      type: String,
      required: true,
    },

    phone: {
      type: String,
      default: null,
    },

    role_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
      index: true,
    },

    division_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Division",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive", "pending", "terminated"],
      default: "pending",
      index: true,
    },

    hire_date: Date,
    termination_date: Date,

    profile_photo_url: {
      type: String,
      default: null,
    },

    emergency_contact_name: String,
    emergency_contact_phone: String,
    emergency_contact_relation: String,

    address: String,
    city: String,
    state: String,
    postal_code: String,
    country: {
      type: String,
      default: "Indonesia",
    },

    date_of_birth: Date,
    national_id: String,

    salary: {
      type: mongoose.Types.Decimal128,
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

// FTS: full_name + email
UserSchema.index({ full_name: "text", email: "text" });

export default mongoose.model("User", UserSchema);
