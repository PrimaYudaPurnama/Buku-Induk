import mongoose from "mongoose";

export async function connect(uri = process.env.MONGODB_URI) {
	if (!uri || typeof uri !== "string" || uri.trim().length === 0) {
		throw new Error("MONGODB_URI is not set. Provide it via environment variable.");
	}

	// Avoid multiple connects in case scripts import each other
	if (mongoose.connection.readyState === 1) {
		return mongoose.connection;
	}

	await mongoose.connect(uri, {
		serverSelectionTimeoutMS: 15000,
	});

	return mongoose.connection;
}

export async function disconnect() {
	// 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
	if (mongoose.connection.readyState === 0) return;
	await mongoose.connection.close();
}

export { mongoose };

