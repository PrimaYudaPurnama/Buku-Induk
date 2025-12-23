// db.js
import mongoose from "mongoose";

const MONGO_URI = Bun.env.MONGO_URI;
const BUN_ENV = Bun.env.BUN_ENV || "local";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing");
  process.exit(1);
}

let isConnected = false;
let isConnecting = false;

/**
 * Establish a single shared Mongo connection with sensible pooling limits
 * to avoid exhausting the cluster connection threshold.
 */
export async function connectDB() {
  if (isConnected || isConnecting) return;
  isConnecting = true;

  try {
    await mongoose.connect(MONGO_URI, {
      retryWrites: true,
      w: "majority",
      dbName: "buku_induk",
      // Pooling tuned to keep connection count low
      maxPoolSize: 20,       // reduce from default 100
      minPoolSize: 1,
      maxIdleTimeMS: 60_000, // close idle sockets promptly
      serverSelectionTimeoutMS: 5_000,
      socketTimeoutMS: 45_000,
      connectTimeoutMS: 10_000,
    });

    isConnected = mongoose.connection.readyState === 1;
    console.log(`✅ MongoDB Connected [${BUN_ENV}]`);
  } catch (err) {
    console.error("❌ Failed to connect MongoDB:");
    console.error(err.message);
    process.exit(1);
  } finally {
    isConnecting = false;
  }
}

// optional: event logs (bagus untuk dev)
mongoose.connection.on("error", (err) => {
  console.error("🔥 MongoDB Error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});

// Graceful shutdown to free connections
const closeConnection = async () => {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    console.log("🛑 MongoDB connection closed gracefully");
  }
};

process.on("SIGINT", closeConnection);
process.on("SIGTERM", closeConnection);
