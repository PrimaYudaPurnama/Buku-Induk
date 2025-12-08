// db.js
import mongoose from "mongoose";

const MONGO_URI = Bun.env.MONGO_URI;
const BUN_ENV = Bun.env.BUN_ENV || "local";

if (!MONGO_URI) {
  console.error("❌ MONGO_URI is missing");
  process.exit(1);
}

let isConnected = false;

export async function connectDB() {
  if (isConnected) return;

  try {
    await mongoose.connect(MONGO_URI, {
      retryWrites: true,
      w: "majority",
      serverSelectionTimeoutMS: 5000, // jangan lebih
      dbName: "buku_induk",           // ***INI PENTING***
    });

    isConnected = mongoose.connection.readyState === 1;
    console.log(`✅ MongoDB Connected [${BUN_ENV}]`);
  } catch (err) {
    console.error("❌ Failed to connect MongoDB:");
    console.error(err.message);
    process.exit(1);
  }
}

// optional: event logs (bagus untuk dev)
mongoose.connection.on("error", (err) => {
  console.error("🔥 MongoDB Error:", err);
});

mongoose.connection.on("disconnected", () => {
  console.warn("⚠️ MongoDB disconnected");
});
