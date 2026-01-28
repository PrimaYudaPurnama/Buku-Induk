import mongoose from "mongoose";
import { connectDB } from "../lib/db.js";
import User from "../models/user.js";
import Role from "../models/role.js";

const SUPERADMIN_EMAIL = "superadmin@gmail.com";

const superadminData = {
  email: SUPERADMIN_EMAIL,
  full_name: "Super Admin",
  password:
    "$argon2id$v=19$m=65536,t=3,p=4$sZx3VfS3BQlqApAiV5CPLA$TrlxfjL3UbpMZ9oWn9jxUz9rPrubbwuC49/41/hWARY",
  phone: "081234567890",
  status: "active",
  employment_type: "full-time",
  hire_date: new Date("2024-01-01"),
  division_id: null,

  profile_photo_url:
    "https://res.cloudinary.com/dtbqhmgjz/image/upload/v1766133862/users/default.png",

  emergency_contact_name: "Admin Backup",
  emergency_contact_phone: "081298765432",
  emergency_contact_relation: "Rekan Kerja",

  address: {
    street: "Jl. Contoh No. 123",
    city: "Jakarta",
    state: "DKI Jakarta",
    postal_code: "12345",
    country: "Indonesia",
  },

  date_of_birth: new Date("1990-01-01"),
  national_id: "3210123456789001",
};

async function seedSuperadmin() {
  try {
    console.log("🌱 Seeding Superadmin user...");
    await connectDB();

    // 1. Ambil role Superadmin
    const superadminRole = await Role.findOne({ name: "Superadmin" });

    if (!superadminRole) {
      throw new Error("Role Superadmin belum ada. Jalankan role seeder dulu.");
    }

    // 2. Cek user existing
    const existingUser = await User.findOne({ email: SUPERADMIN_EMAIL });

    if (existingUser) {
      existingUser.full_name = superadminData.full_name;
      existingUser.role_id = superadminRole._id;
      existingUser.status = "active";
      existingUser.employment_type = "full-time";
      await existingUser.save();

      console.log("✅ Superadmin user updated");
    } else {
      await User.create({
        ...superadminData,
        role_id: superadminRole._id,
      });

      console.log("✅ Superadmin user created");
    }

    await mongoose.connection.close();
    console.log("🔌 DB connection closed");
    process.exit(0);
  } catch (err) {
    console.error("❌ Superadmin seeder error:", err.message);
    process.exit(1);
  }
}

seedSuperadmin();
