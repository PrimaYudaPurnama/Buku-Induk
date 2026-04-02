import { connect, disconnect, mongoose } from "./utils/mongoose.js";

async function migrateFresh() {
	try {
		const uri = process.env.MONGODB_URI;
		console.log("🔗 Connecting to MongoDB...");
		await connect(uri);
		const db = mongoose.connection.db;
		const dbName = db.databaseName;

		console.log(`🧨 Dropping database "${dbName}"...`);
		await db.dropDatabase();
		console.log("✅ Database dropped successfully.");

		await disconnect();
		console.log("🔌 DB connection closed");
		process.exit(0);
	} catch (err) {
		console.error("❌ migrate:fresh failed:", err.message || err);
		try {
			await disconnect();
		} catch {}
		process.exit(1);
	}
}

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	migrateFresh();
}

export default migrateFresh;

