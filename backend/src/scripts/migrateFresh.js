import { connect, disconnect, mongoose } from "./utils/mongoose.js";
import { pathToFileURL } from "node:url";

async function migrateFresh() {
	try {
		if (process.env.ALLOW_MIGRATE_FRESH !== "true") {
			throw new Error(
				'Refusing to drop database. Set ALLOW_MIGRATE_FRESH="true" to proceed.'
			);
		}
		if (process.env.NODE_ENV === "production") {
			throw new Error("Refusing to drop database in production environment.");
		}

		const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
		console.log("🔗 Connecting to MongoDB...");
		await connect(uri);
		const db = mongoose.connection.db;
		const dbName = db.databaseName;

		console.log(`🧨 Dropping database "${dbName}"...`);
		await db.dropDatabase();
		console.log("✅ Database dropped successfully.");

		await disconnect();
		console.log("🔌 DB connection closed");
		return;
	} catch (err) {
		console.error("❌ migrate:fresh failed:", err.message || err);
		try {
			await disconnect();
		} catch {}
		throw err;
	}
}

// Execute when run directly
const isDirectRun =
	process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
	migrateFresh()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}

export default migrateFresh;

