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

    employee_code: {
      type: String,
      unique: true,
      index: true,
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    phone: {
      type: String,
      default: null,
    },

    manager_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
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

    employment_type: {
      type: String,
      enum: ["full-time", "contract", "intern", "freelance", "unspecified"],
      required: true,
      default: "unspecified",
    },

    hire_date: Date,
    expired_date: Date, // For contract/intern/freelance employment types
    termination_date: Date,

    profile_photo_url: {
      type: String,
      default: null,
    },

    emergency_contact_name: String,
    emergency_contact_phone: String,
    emergency_contact_relation: String,

    address: {
      domicile: String,
      street: String,
      subdistrict: String,
      city: String,
      state: String,
      postal_code: String,
      country: {
        type: String,
        default: "Indonesia",
      },
    },

    npwp: {
      type: String,
    },

    date_of_birth: Date,
    national_id: String,
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
