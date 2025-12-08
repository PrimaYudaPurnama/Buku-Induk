import express from "express";
import { authenticate, authorize } from "./middleware/auth.js";

const router = express.Router();

// Route hanya untuk Administrator
router.get(
  "/admin-only",
  authenticate, // ambil user dari token
  authorize({ roles: ["admin"] }), // cek role id
  (req, res) => {
    res.json({ message: "Welcome Admin!" });
  }
);

// Route untuk siapa saja yang punya permission users.* 
router.get(
  "/manage-users",
  authenticate,
  authorize({ permissions: ["users.*"] }),
  (req, res) => {
    res.json({ message: "You can manage users" });
  }
);

router.get(
  "/executive",
  authenticate,
  authorizeByLevel(3), // minimal level 3 (director atau lebih tinggi, misal admin=2)
  (req, res) => {
    res.json({ message: "Welcome executive" });
  }
);
