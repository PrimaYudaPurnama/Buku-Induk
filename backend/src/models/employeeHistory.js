import mongoose from "mongoose";

const EmployeeHistorySchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // idx_employee_history_user
    },

    event_type: {
      type: String,
      required: true,
      enum: [
        "hired",
        "promotion",
        "demotion",
        "transfer",
        "salary_change",
        "resignation",
        "terminated",
        "status_change",
        "role_change",
      ],
      index: true, // idx_employee_history_event_type
    },

    old_role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },

    new_role: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      default: null,
    },

    old_division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Division",
      default: null,
    },

    new_division: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Division",
      default: null,
    },

    old_salary: {
      type: mongoose.Types.Decimal128,
      default: null,
    },

    new_salary: {
      type: mongoose.Types.Decimal128,
      default: null,
    },

    effective_date: {
      type: Date,
      required: true,
      index: true, // idx_employee_history_effective_date
    },

    reason: {
      type: String,
      default: "",
    },

    notes: {
      type: String,
      default: "",
    },

    created_by: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: {
      createdAt: "created_at",
      updatedAt: false, // immutable
    },
  }
);

EmployeeHistorySchema.index({ created_at: -1 }); 

const transformSalaryFields = (doc, ret) => {
  if (ret.old_salary) ret.old_salary = ret.old_salary.toString();
  if (ret.new_salary) ret.new_salary = ret.new_salary.toString();
  return ret;
};

EmployeeHistorySchema.set("toJSON", { transform: transformSalaryFields });
EmployeeHistorySchema.set("toObject", { transform: transformSalaryFields });

export default mongoose.model("EmployeeHistory", EmployeeHistorySchema);
