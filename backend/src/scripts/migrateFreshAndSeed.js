import migrateFresh from "./migrateFresh.js";
import seed from "./seed.js";

async function runAll() {
	// Each underlying script handles its own connection and exit,
	// but here we want a unified flow in one process.
	try {
		await migrateFresh();
		await seed();
	} catch (err) {
		console.error("❌ migrate:fresh + seed failed:", err.message || err);
		throw err;
	}
}

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runAll()
		.then(() => process.exit(0))
		.catch(() => process.exit(1));
}

export default runAll;

