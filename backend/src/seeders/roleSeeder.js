import { connectDB } from "../lib/db.js";
import Role from "../models/role.js";
import mongoose from "mongoose";

const roles = [
  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbb3"),
    name: "Superadmin",
    description: "God Mode - Full access to everything",
    permissions: [
      "user:create",
      "user:update",
      "user:delete",
      "user:read:any",
      "account:create",
      "account:approve:any",
      "employee:promote:any",
      "employee:terminate:any",
      "employee:transfer:any",
      "user:view_history:any",
      "user:view_salary:any",
      "user:export",
      "system:manage_divisions",
      "system:manage_roles",
      "system:view_audit_logs",
      "system:manage_analytics",
      "user:update_salary:any",
    ],
    hierarchy_level: 1,
  },
  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbb4"),
    name: "Admin",
    description: "Full access kecuali delete user & manage roles",
    permissions: [
      "user:create",
      "user:update",
      "user:read:any",
      "account:create",
      "account:approve:any",
      "employee:promote:any",
      "employee:terminate:any",
      "employee:transfer:any",
      "user:view_history:any",
      "user:view_salary:any",
      "user:export",
      "system:manage_divisions",
      "system:view_audit_logs",
      "system:manage_analytics",
      "user:update_salary:any",
    ],
    hierarchy_level: 2,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbb5"),
    name: "Director",
    description: "Top management - full view & HR actions",
    permissions: [
      "user:read:any",
      "user:view_history:any",
      "user:view_salary:any",
      "account:create",
      "account:approve:any",
      "employee:promote:any",
      "employee:terminate:any",
      "employee:transfer:any",
      "system:view_audit_logs",
      "system:manage_analytics",
      "system:manage_divisions",
      "user:update_salary:any",
    ],
    hierarchy_level: 3,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbbc"),
    name: "Investor",
    description: "Read-only investor access",
    permissions: [
      "dashboard:read",
      "report:financial:read",
      "system:manage_analytics",
    ],
    hierarchy_level: 3,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbb6"),
    name: "Manager HR",
    description: "HR Manager",
    permissions: [
      "user:read:any",
      "user:view_history:any",
      "user:view_salary:any",
      "account:create",
      "account:approve:any",
      "employee:promote:any",
      "employee:terminate:any",
      "employee:transfer:any",
      "user:create",
      "user:update_salary:any",
    ],
    hierarchy_level: 4,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbb7"),
    name: "General Manager",
    description: "General Manager",
    permissions: [
      "user:read:any",
      "account:create",
      "account:approve:any",
      "user:view_history:any",
      "user:view_salary:any",
      "employee:promote:any",
      "employee:terminate:any",
      "employee:transfer:any",
    ],
    hierarchy_level: 4,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbb8"),
    name: "Finance",
    description: "Finance Manager",
    permissions: [
      "user:read:any",
      "account:create",
      "user:view_history:any",
      "user:view_salary:any",
      "user:export",
      "user:update_salary:any",
    ],
    hierarchy_level: 4,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbb9"),
    name: "Manager",
    description: "Division Manager - hanya divisi sendiri",
    permissions: [
      "user:read:own_division",
      "user:read:self",
      "account:create",
      "account:approve:own_division",
      "user:view_history:own_division",
      "user:view_salary:own_division",
      "employee:promote:own_division",
      "employee:terminate:own_division",
    ],
    hierarchy_level: 5,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbba"),
    name: "Team Lead",
    description: "Team Leader - hanya data diri sendiri",
    permissions: [
      "user:read:self",
      "account:create",
      "user:view_history:self",
      "user:view_salary:self",
    ],
    hierarchy_level: 6,
  },

  {
    _id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbbb"),
    name: "Staff",
    description: "Regular employee",
    permissions: [
      "user:read:self",
      "account:create",
      "user:view_history:self",
      "user:view_salary:self",
    ],
    hierarchy_level: 7,
  },
];

async function seedRoles() {
  try {
    console.log("🌱 Starting role seeder...");
    await connectDB();

    for (const role of roles) {
      await Role.findOneAndUpdate(
        { _id: role._id },
        { $set: role },
        { upsert: true, new: true }
      );

      console.log(`✅ Seeded role: ${role.name}`);
    }

    await mongoose.connection.close();
    console.log("🔌 DB connection closed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Seeder error:", err);
    process.exit(1);
  }
}

seedRoles();
