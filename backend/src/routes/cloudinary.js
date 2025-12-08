import { Hono } from "hono";
import cloudinary_metaData from "../controllers/cloudinary.js";

const cloudinaryRouter = new Hono();

//app.route("/api/v1/files", cloudinaryRouter);

// Upload profile picture
cloudinaryRouter.post("/:id/upload", (c) => cloudinary_metaData.uploadProfilePhoto(c));

// Get profile picture
cloudinaryRouter.get("/:id", (c) => cloudinary_metaData.getProfilePhoto(c));

export default cloudinaryRouter;
