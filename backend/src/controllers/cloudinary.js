import User from "../models/user.js";
import file_metaData from "../models/file_metaData.js";
import { v2 as cloudinary } from "cloudinary";

// konfigurasi cloudinary dari env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

class cloudinary_metaData {
  // Upload profile picture
  async uploadProfilePhoto(c) {
    try {
      const userId = c.req.param("id");
      const uploaded_by = c.req.param("by") || userId;
      const user = await User.findById(userId);
      if (!user) return c.json({ success: false, message: "User not found" }, 404);

      const file = await c.req.formData().then(fd => fd.get("file"));
      if (!file) return c.json({ success: false, message: "No file uploaded" }, 400);

      // Convert ke Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Convert ke Base64
      const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

      const uploadResult = await cloudinary.uploader.upload(base64String, {
        folder: `users/${userId}`,
        resource_type: "image",
        public_id: `profile_${Date.now()}`,
        overwrite: true,
      });


      // Simpan metadata
      const photo = new file_metaData({
        user_id: userId,
        uploaded_by: uploaded_by || userId,
        cloudinary_public_id: uploadResult.public_id,
        url: uploadResult.secure_url,
        original_filename: uploadResult.original_filename,
        size: uploadResult.bytes,
        mime_type: uploadResult.format,
      });

      await photo.save();

      // Update profile_photo_url user
      user.profile_photo_url = uploadResult.secure_url;
      await user.save();

      return c.json({ success: true, data: photo });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: err.message }, 500);
    }
  }

  // Get user's current profile photo
  async getProfilePhoto(c) {
    try {
      const userId = c.req.param("id");
      const user = await User.findById(userId).select("profile_photo_url full_name");
      if (!user) return c.json({ success: false, message: "User not found" }, 404);

      return c.json({ success: true, data: { profile_photo_url: user.profile_photo_url, full_name: user.full_name } });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: err.message }, 500);
    }
  }

  // Upload profile photo for account setup (no userId required)
  async uploadProfilePhotoForSetup(c) {
    try {
      const file = await c.req.formData().then(fd => fd.get("file"));
      if (!file) return c.json({ success: false, message: "No file uploaded" }, 400);

      // Convert ke Buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Convert ke Base64
      const base64String = `data:${file.type};base64,${buffer.toString("base64")}`;

      const uploadResult = await cloudinary.uploader.upload(base64String, {
        folder: `temp/profile_photos`,
        resource_type: "image",
        public_id: `setup_${Date.now()}`,
        overwrite: false,
      });

      // Return only URL (don't save to database, user doesn't exist yet)
      return c.json({ 
        success: true, 
        data: { 
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id 
        } 
      });
    } catch (err) {
      console.error(err);
      return c.json({ success: false, message: err.message }, 500);
    }
  }
}

export default new cloudinary_metaData();
