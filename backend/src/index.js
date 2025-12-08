import { connectDB } from '@/lib/db'
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import argon2 from "argon2"

import userRouter from "./routes/user.js";
import authRouter from "./routes/auth.js"
import cloudinaryRouter from './routes/cloudinary.js';

import Role from "./models/role.js";
import divisionRouter from './routes/division.js';

const app = new Hono();

connectDB();

// Middlewares
app.use("*", logger());
app.use(
  '/*',
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
    allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  })
)


app.route("/api/v1/files", cloudinaryRouter);
app.route("/api/v1/users", userRouter);
app.route("/api/v1/divisions", divisionRouter);
app.route("/api/v1/auth", authRouter);


// app.post("/tes/masukin", async (c) => {
//   const body = await c.req.json();
//   const data = await Role.create(body);
//   return c.json(data, 201);
// })

app.post("/tobcrypt", async(c) => {
  const body = await c.req.json();
  const hash = await argon2.hash(body.password);

  return c.json({
    success: true,
    hash,
  });
})

// Health check
app.get("/health", (c) => {
  return c.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.notFound((c) => {
  return c.json(
    {
      success: false,
      error: {
        message: "Route not found",
        code: "NOT_FOUND",
      },
    },
    404
  );
});

// Error handler
app.onError((err, c) => {
  console.error("Unhandled error:", err);
  return c.json(
    {
      success: false,
      error: {
        message: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    },
    500
  );
});

export default app;
