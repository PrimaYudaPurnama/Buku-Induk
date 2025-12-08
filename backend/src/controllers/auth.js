import jwt from "jsonwebtoken";
import argon2 from "argon2";
import User from "../models/user.js";
import Role from "../models/role.js";

class AuthController {
  // POST /api/v1/auth/login
  static async login(c) {
    try {
      const { email, password } = await c.req.json();

      if (!email || !password) {
        return c.json({ message: "Email and password are required" }, 400);
      }

      // Find user by email
      const user = await User.findOne({ email }).populate("role_id");
      if (!user) {
        return c.json({ message: "Invalid email or password" }, 401);
      }

      // Check if user is active
      if (user.status !== "active") {
        return c.json({ message: "Account is not active" }, 403);
      }

      // Verify password
      const isPasswordValid = await argon2.verify(user.password, password);
      console.log(isPasswordValid)
      if (!isPasswordValid) {
        return c.json({ message: "Invalid email or password" }, 401);
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      // Return user data without password
      const userData = user.toObject();
      delete userData.password;

      return c.json({
        message: "Login successful",
        token,
        user: userData,
      });
    } catch (err) {
      console.error("Login error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }

  // POST /api/v1/auth/logout
  static async logout(c) {
    try {
      // Karena JWT stateless, logout di client-side (hapus token)
      // Bisa tambahkan blacklist token di Redis jika diperlukan
      return c.json({
        message: "Logout successful",
        ok: true,
      });
    } catch (err) {
      console.error("Logout error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }

  // GET /api/v1/auth/me
  static async me(c) {
    try {
      const user = c.get("user"); // dari middleware authenticate
      
      if (!user) {
        return c.json({ message: "User not found" }, 404);
      }

      // Return user data without password
      const userData = user.toObject();
      delete userData.password;

      return c.json({
        user: userData,
      });
    } catch (err) {
      console.error("Get me error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }

  // GET /api/v1/auth/check
  static async check(c) {
    try {
      const user = c.get("user");
      
      if (!user) {
        return c.json({ ok: false }, 401);
      }

      return c.json({ ok: true });
    } catch (err) {
      console.error("Auth check error:", err);
      return c.json({ ok: false }, 500);
    }
  }

  // POST /api/v1/auth/refresh
  static async refresh(c) {
    try {
      const user = c.get("user");
      
      if (!user) {
        return c.json({ message: "User not found" }, 404);
      }

      // Generate new token
      const token = jwt.sign(
        { id: user._id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
      );

      // Return fresh user data
      const userData = user.toObject();
      delete userData.password;

      return c.json({
        message: "Token refreshed successfully",
        token,
        user: userData,
      });
    } catch (err) {
      console.error("Refresh token error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }

  // POST /api/v1/auth/password/forgot
  static async forgotPassword(c) {
    try {
      const { email } = await c.req.json();

      if (!email) {
        return c.json({ message: "Email is required" }, 400);
      }

      const user = await User.findOne({ email });
      if (!user) {
        // Jangan beritahu user tidak ditemukan (security)
        return c.json({
          message: "If the email exists, a reset link has been sent",
        });
      }

      // Generate reset token
      const resetToken = jwt.sign(
        { id: user._id, email: user.email, type: "password_reset" },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );

      // TODO: Send email dengan link reset password
      // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      // await sendEmail(user.email, "Password Reset", resetLink);

      console.log("Reset token for", email, ":", resetToken);

      return c.json({
        message: "If the email exists, a reset link has been sent",
        // Development only - remove in production
        ...(process.env.NODE_ENV === "development" && { resetToken }),
      });
    } catch (err) {
      console.error("Forgot password error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }
}

export default AuthController;