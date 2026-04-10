import { connect, disconnect, mongoose } from "./utils/mongoose.js";
import Role from "../models/role.js";
import User from "../models/user.js";
import Division from "../models/division.js";

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
			"system:manage_activities",
			"system:manage_projects",
			"system:manage_weeklyschedule",
			"system:manage_workday",
			"org_chart:read",
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
			"system:manage_activities",
			"system:manage_projects",
			"system:manage_workday",
			"system:manage_weeklyschedule",
			"org_chart:read",
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
			"user:update_salary:any",
			"system:manage_divisions",
			"system:manage_projects",
			"system:manage_activities",
		],
		hierarchy_level: 3,
	},
	{
		_id: new mongoose.Types.ObjectId("692fb92f9411b0f083edbbbc"),
		name: "Investor",
		description: "Read-only investor access",
		permissions: [
			"system:manage_analytics",
			"org_chart:read",
			"user:read:self",
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
			"system:manage_weeklyschedule",
			"system:manage_workday",
			"org_chart:read",
			"system:attendance",
			"system:manage_analytics",
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
			"system:manage_analytics",
			"system:manage_projects",
			"system:manage_workday",
			"system:manage_weeklyschedule",
			"system:manage_activities",
			"system:attendance",
			"org_chart:read",
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
			"system:attendance",
			"report:financial:read",
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
			"system:attendance",
			"org_chart:read",
		],
		hierarchy_level: 5,
	},
	{
		_id: new mongoose.Types.ObjectId("69c62b7f3b1d6aa5731fb98f"),
		name: "Manager Project",
		description: "Mengatur project",
		permissions: [
			"system:manage_projects",
			"system:manage_analytics",
			"user:read:any",
			"system:attendance",
			"org_chart:read",
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
			"system:attendance",
			"org_chart:read",
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
			"system:attendance",
		],
		hierarchy_level: 7,
	},
];

const SUPERADMIN_EMAIL = "superadmin@gmail.com";
const superadminData = {
	email: SUPERADMIN_EMAIL,
	full_name: "Warid Ganteng",
	password:
		"$argon2id$v=19$m=65536,t=3,p=4$sZx3VfS3BQlqApAiV5CPLA$TrlxfjL3UbpMZ9oWn9jxUz9rPrubbwuC49/41/hWARY",
	phone: "081234567890",
	status: "active",
	employment_type: "full-time",
	hire_date: new Date("2024-01-01"),
	division_id: null,
	profile_photo_url:
		"https://res.cloudinary.com/dtbqhmgjz/image/upload/v1775793040/users/692ff732d6ecc384940d02c8/profile_1775793038333.jpg",
	emergency_contact_name: "Admin Backup",
	emergency_contact_phone: "081298765432",
	emergency_contact_relation: "Rekan Kerja",
	address: {
		domicile: null,
		street: null,
		subdistrict: null,
		city: null,
		state: null,
		postal_code: null,
		country: "Indonesia",
	},
	city: "Jakarta",
	state: "DKI Jakarta",
	postal_code: "12345",
	country: "Indonesia",
	date_of_birth: new Date("1990-01-01"),
	national_id: "3210123456789001",
	termination_date: null,
	expired_date: null,
	gender: "female",
	npwp: null,
};

async function upsertRoles() {
	for (const role of roles) {
		await Role.findOneAndUpdate({ _id: role._id }, { $set: role }, { upsert: true });
		console.log(`✅ Seeded role: ${role.name}`);
	}
}

async function upsertSuperadmin() {
	const superadminRole = await Role.findOne({ name: "Superadmin" });
	if (!superadminRole) {
		throw new Error("Role Superadmin belum ada (seed roles dulu).");
	}

	const existing = await User.findOne({ email: SUPERADMIN_EMAIL });
	if (existing) {
		existing.full_name = superadminData.full_name;
		existing.role_id = superadminRole._id;
		existing.status = "active";
		existing.employment_type = "full-time";
		await existing.save();
		console.log("✅ Superadmin user updated");
		return;
	}

	await User.create({ ...superadminData, role_id: superadminRole._id });
	console.log("✅ Superadmin user created");
}

async function seed() {
	try {
		const uri = process.env.MONGODB_URI;
		console.log("🔗 Connecting to MongoDB for seeding...");
		await connect(uri);

		await upsertRoles();
		await upsertSuperadmin();

		await disconnect();
		console.log("🔌 DB connection closed");
		return;
	} catch (err) {
		console.error("❌ Seed failed:", err.message || err);
		try {
			await disconnect();
		} catch {}
		throw err;
	}
}

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	seed()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}

export default seed;