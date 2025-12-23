import { connectDB } from "../lib/db.js";
import Role from "../models/role.js";
import mongoose from "mongoose";

const roles = [
  {
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
    ],
    hierarchy_level: 1,
  },
  {
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
    ],
    hierarchy_level: 2,
  },
  {
    name: "Director",
    description: "Top management - full view & HR actions",
    permissions: [
      "user:read:any",
      "user:view_history:any",
      "user:view_salary:any",
      "account:create",
      "employee:promote:any",
      "employee:terminate:any",
      "employee:transfer:any",
      "system:view_audit_logs",
    ],
    hierarchy_level: 3,
  },
  {
    name: "Investor",
    description: "Read-only investor access",
    permissions: [
      "dashboard:read",
      "report:financial:read",
    ],
    hierarchy_level: 3,
  },
  {
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
    ],
    hierarchy_level: 4,
  },
  {
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
    name: "Finance",
    description: "Finance Manager",
    permissions: [
      "user:read:any",
      "account:create",
      "user:view_history:any",
      "user:view_salary:any",
      "user:export",
    ],
    hierarchy_level: 4,
  },
  {
    name: "Manager",
    description: "Division Manager - hanya divisi sendiri",
    permissions: [
      "user:read:own_division",
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
    
    // Connect to database
    await connectDB();

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const roleData of roles) {
      try {
        const existingRole = await Role.findOne({ name: roleData.name });

        if (existingRole) {
          // Update existing role
          existingRole.description = roleData.description;
          existingRole.permissions = roleData.permissions;
          existingRole.hierarchy_level = roleData.hierarchy_level;
          await existingRole.save();
          updated++;
          console.log(`✅ Updated role: ${roleData.name}`);
        } else {
          // Create new role
          await Role.create(roleData);
          created++;
          console.log(`✅ Created role: ${roleData.name}`);
        }
      } catch (error) {
        console.error(`❌ Error processing role ${roleData.name}:`, error.message);
        skipped++;
      }
    }

    console.log("\n📊 Seeder Summary:");
    console.log(`   Created: ${created}`);
    console.log(`   Updated: ${updated}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${roles.length}`);
    console.log("\n✅ Role seeder completed!");

    // Close connection
    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeder error:", error);
    process.exit(1);
  }
}

// Run seeder
seedRoles();

export default seedRoles;

