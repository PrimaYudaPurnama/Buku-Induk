import jwt from "jsonwebtoken";
import argon2 from "argon2";
import User from "../models/user.js";
import Role from "../models/role.js";
import { logAudit } from "../utils/auditLogger.js";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";


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
        await logAudit(c, "login_failed", "auth", null, null, { email, reason: "user_not_found" });
        return c.json({ message: "Invalid email or password" }, 401);
      }

      // Allow pending users to login (they will have limited access)
      // Only block inactive and terminated users
      if (user.status === "inactive" || user.status === "terminated") {
        await logAudit(c, "login_failed", "auth", user._id, null, { email, reason: "inactive" });
        return c.json({ message: "Account is not active" }, 403);
      }

      if (user.status === "pending") {
        await logAudit(c, "login_failed", "auth", user._id, null, { email, reason: "pending" });
        return c.json({ message: "Account is pending" }, 403);
      }

      // Verify password
      const isPasswordValid = await argon2.verify(user.password, password);
      if (!isPasswordValid) {
        await logAudit(c, "login_failed", "auth", user._id, null, { email, reason: "wrong_password" });
        return c.json({ message: "Invalid email or password" }, 401);
      }

      // Generate JWT token
      const token = jwt.sign(
        { id: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      const isProd = process.env.BUN_ENV === "production";

      setCookie(c, "access_token", token, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? "none" : "lax",
        maxAge: 60 * 60 * 24 * 7,
        path: "/",
      });
      

      // Return user data without password
      const userData = user.toObject();
      delete userData.password;

      await logAudit(c, "login_success", "auth", user._id, null, { email });

      return c.json({
        message: "Login successful",
        user: userData,
      });
    } catch (err) {
      console.error("Login error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }

  // POST /api/v1/auth/logout
  static async logout(c) {
    const user = c.get("user");
  
    if (user) {
      await logAudit(c, "logout", "auth", user._id, null, {
        email: user.email,
      });
    }
  
    // HAPUS COOKIE DENGAN ATRIBUT IDENTIK
    deleteCookie(c, "access_token", {
      path: "/",
      domain:
        process.env.NODE_ENV === "production"
          ? ".up.railway.app"
          : "localhost",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
  
    return c.json({ ok: true });
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

      // Log audit
      await logAudit(c, "password_reset_request", "auth", user._id, null, { email: user.email });

      // TODO: Send email dengan link reset password
      // const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      // await sendEmail(user.email, "Password Reset", resetLink);


      return c.json({
        message: "If the email exists, a reset link has been sent",
        // Development only - remove in production
        ...(process.env.BUN_ENV === "development" && { resetToken }),
      });
    } catch (err) {
      console.error("Forgot password error:", err);
      return c.json({ message: "Internal server error" }, 500);
    }
  }

  // POST /api/v1/auth/register
  // Public endpoint untuk register langsung ke user dengan status pending
  static async register(c) {
    try {
      const formData = await c.req.formData();
      
      // Extract form data
      const email = formData.get("email");
      const password = formData.get("password");
      const full_name = formData.get("full_name");
      const phone = formData.get("phone") || null;
      const division_id = formData.get("division_id");
      const gender = formData.get("gender");
      const date_of_birth = formData.get("date_of_birth") || null;
      const national_id = formData.get("national_id") || null;
      const address_domicile = formData.get("address_domicile") || null;
      const address_street = formData.get("address_street") || null;
      const address_city = formData.get("address_city") || null;
      const address_state = formData.get("address_state") || null;
      const address_subdistrict = formData.get("address_subdistrict") || null;
      const address_postal_code = formData.get("address_postal_code") || null;
      const address_country = formData.get("address_country") || "Indonesia";
      const emergency_contact_name = formData.get("emergency_contact_name") || null;
      const emergency_contact_phone = formData.get("emergency_contact_phone") || null;
      const emergency_contact_relation = formData.get("emergency_contact_relation") || null;
      const npwp = formData.get("npwp") || null;

      // Get default Staff role (692fb92f9411b0f083edbbbb)
      const defaultRoleId = "692fb92f9411b0f083edbbbb";
      const staffRole = await Role.findById(defaultRoleId);
      
      if (!staffRole) {
        return c.json({ message: "Default role not found" }, 500);
      }

      // Validation
      if (!email || !password || !full_name || !gender) {
        return c.json({ 
          message: "Email, password, full_name, and gender are required" 
        }, 400);
      }

      // Check if email already exists
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return c.json({ message: "Email already registered" }, 409);
      }

      // Hash password
      const hashedPassword = await argon2.hash(password);

      // Prepare address object
      const address = {
        domicile: address_domicile,
        street: address_street,
        subdistrict: address_subdistrict,
        city: address_city,
        state: address_state,
        postal_code: address_postal_code,
        country: address_country,
      };

      // Create user with status pending
      const newUser = await User.create({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        full_name: full_name.trim(),
        phone: phone || null,
        role_id: defaultRoleId,
        division_id: division_id || null,
        status: "pending",
        gender: gender,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        national_id: national_id || null,
        npwp: npwp || null,
        address: address,
        emergency_contact_name: emergency_contact_name || null,
        emergency_contact_phone: emergency_contact_phone || null,
        emergency_contact_relation: emergency_contact_relation || null,
      });

      // Upload documents
      const { createDocumentForEvent } = await import("../services/documentService.js");
      const documents = [];

      // Handle ID Card
      const idCardFile = formData.get("id_card");
      if (idCardFile && idCardFile instanceof File) {
        const arrayBuffer = await idCardFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileData = {
          buffer,
          filename: idCardFile.name || "id_card",
          mime_type: idCardFile.type || "application/octet-stream",
          size: idCardFile.size || buffer.length,
        };
        const doc = await createDocumentForEvent(
          newUser._id,
          "id_card",
          fileData,
          newUser._id,
          "ID Card uploaded during registration"
        );
        documents.push(doc);
      }

      // Handle Resume
      const resumeFile = formData.get("resume");
      if (resumeFile && resumeFile instanceof File) {
        const arrayBuffer = await resumeFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileData = {
          buffer,
          filename: resumeFile.name || "resume",
          mime_type: resumeFile.type || "application/octet-stream",
          size: resumeFile.size || buffer.length,
        };
        const doc = await createDocumentForEvent(
          newUser._id,
          "resume",
          fileData,
          newUser._id,
          "Resume uploaded during registration"
        );
        documents.push(doc);
      }

      // Handle multiple certificates
      const certificateFiles = formData.getAll("certificates");
      for (const certFile of certificateFiles) {
        if (certFile instanceof File) {
          const arrayBuffer = await certFile.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const fileData = {
            buffer,
            filename: certFile.name || "certificate",
            mime_type: certFile.type || "application/octet-stream",
            size: certFile.size || buffer.length,
          };
          const doc = await createDocumentForEvent(
            newUser._id,
            "certificate",
            fileData,
            newUser._id,
            "Certificate uploaded during registration"
          );
          documents.push(doc);
        }
      }

      // Handle NPWP Document
      const npwpFile = formData.get("npwp_file");
      if (npwpFile && npwpFile instanceof File) {
        const arrayBuffer = await npwpFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileData = {
          buffer,
          filename: npwpFile.name || "npwp",
          mime_type: npwpFile.type || "application/octet-stream",
          size: npwpFile.size || buffer.length,
        };
        const doc = await createDocumentForEvent(
          newUser._id,
          "npwp",
          fileData,
          newUser._id,
          "NPWP document uploaded during registration"
        );
        documents.push(doc);
      }

      // Return user data without password
      const userData = newUser.toObject();
      delete userData.password;

      await logAudit(c, "user_register", "auth", newUser._id, null, {
        email: newUser.email,
        documents_count: documents.length,
      });

      return c.json({
        message: "Registration successful. Your account is pending approval.",
        data: {
          user: userData,
          documents: documents.map(doc => ({
            _id: doc._id,
            document_type: doc.document_type,
            file_name: doc.file_name,
          })),
        },
      }, 201);
    } catch (err) {
      console.error("Register error:", err);
      
      if (err.name === "ValidationError") {
        return c.json({ 
          message: err.message || "Validation error" 
        }, 400);
      }

      if (err.code === 11000) {
        return c.json({ 
          message: "Email already registered" 
        }, 409);
      }

      return c.json({ message: "Internal server error" }, 500);
    }
  }
}

export default AuthController;