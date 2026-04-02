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
		process.exit(1);
	}
}

// Execute when run directly
if (import.meta.url === `file://${process.argv[1]}`) {
	runAll();
}

export default runAll;

