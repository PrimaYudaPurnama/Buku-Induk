import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary from env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload file to Cloudinary with versioning support
 * @param {Buffer|string} file - File buffer or file path
 * @param {object} options - Upload options
 * @param {string} options.folder - Folder path in Cloudinary
 * @param {string} options.public_id - Public ID (without version)
 * @param {string} options.resource_type - Resource type (image, raw, video, etc.)
 * @param {boolean} options.overwrite - Overwrite existing file (default: false for versioning)
 * @returns {Promise<object>} Upload result
 */
export const uploadFile = async (file, options = {}) => {
  const {
    folder = "uploads",
    public_id,
    resource_type = "auto",
    overwrite = false,
  } = options;

  try {
    // If file is Buffer, convert to base64
    let uploadData;
    if (Buffer.isBuffer(file)) {
      // Determine mime type from buffer or options
      const mimeType = options.mime_type || "application/octet-stream";
      const base64String = `data:${mimeType};base64,${file.toString("base64")}`;
      uploadData = base64String;
    } else {
      uploadData = file; // Assume it's a file path
    }

    const uploadOptions = {
      folder,
      resource_type,
      overwrite,
      // Ensure file is publicly accessible (no signed URLs needed)
      type: 'upload', // Explicit upload type
      access_mode: 'public', // Make file publicly accessible
    };

    if (public_id) {
      uploadOptions.public_id = public_id;
    }

    const result = await cloudinary.uploader.upload(uploadData, uploadOptions);

    return {
      public_id: result.public_id,
      url: result.secure_url,
      version: result.version,
      format: result.format,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
      created_at: result.created_at,
    };
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Delete file from Cloudinary by public_id
 * @param {string} publicId - Public ID of the file
 * @param {object} options - Delete options
 * @param {string} options.resource_type - Resource type
 * @returns {Promise<object>} Delete result
 */
export const deleteByPublicId = async (publicId, options = {}) => {
  const { resource_type = "image" } = options;

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type,
    });

    return {
      result: result.result,
      public_id: publicId,
    };
  } catch (error) {
    console.error("Cloudinary delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Get file URL with version
 * @param {string} publicId - Public ID
 * @param {number} version - Version number (optional)
 * @param {string} mimeType - MIME type of the file (optional)
 * @returns {string} File URL
 */
export const getFileUrl = (publicId, version = null, mimeType = null) => {
  const options = {};
  
  if (version) {
    options.version = version;
  }
  
  // For non-image files (docx, pdf, etc.), add flags to prevent forced download
  if (mimeType) {
    const isImage = mimeType.startsWith('image/');
    const isPdf = mimeType === 'application/pdf';
    const isOfficeDoc = mimeType.includes('wordprocessingml') || 
                       mimeType.includes('spreadsheetml') ||
                       mimeType.includes('presentationml') ||
                       mimeType === 'application/msword' ||
                       mimeType === 'application/vnd.openxmlformats-officedocument';
    
    if (!isImage && (isPdf || isOfficeDoc)) {
      // Add flags to allow inline viewing instead of forcing download
      options.flags = ['fl_attachment'];
      options.attachment = false;
    }
  }
  
  if (version) {
    return cloudinary.url(publicId, options);
  }
  return cloudinary.url(publicId, options);
};

/**
 * Get file URL for viewing (not downloading)
 * @param {string} publicId - Public ID
 * @param {string} mimeType - MIME type of the file
 * @returns {string} File URL optimized for viewing
 */
export const getFileViewUrl = (publicId, mimeType) => {
  const isImage = mimeType?.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';
  
  // Check for Office documents (.docx, .xlsx, .pptx, .doc, .xls, .ppt)
  const isOfficeDoc = mimeType?.includes('wordprocessingml') || 
                     mimeType?.includes('spreadsheetml') ||
                     mimeType?.includes('presentationml') ||
                     mimeType === 'application/msword' ||
                     mimeType === 'application/vnd.openxmlformats-officedocument' ||
                     mimeType === 'application/vnd.ms-word' ||
                     mimeType === 'application/vnd.ms-excel' ||
                     mimeType === 'application/vnd.ms-powerpoint' ||
                     mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                     mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                     mimeType === 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  
  // For images, return normal URL
  if (isImage) {
    return cloudinary.url(publicId, {
      resource_type: 'image',
      secure: true,
    });
  }
  
  // For PDF, return raw URL (browsers can display PDF inline)
  if (isPdf) {
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      secure: true,
    });
  }
  
  // For Office docs (.docx, .xlsx, .pptx), use backend proxy endpoint
  // This ensures proper headers and access control
  if (isOfficeDoc) {
    // Return proxy URL that will serve file with proper Content-Disposition: inline
    // Format: /api/v1/documents/{documentId}/view
    // Note: This requires documentId, so we'll need to pass it or use a different approach
    // For now, return direct Cloudinary URL but frontend should use proxy endpoint
    return cloudinary.url(publicId, {
      resource_type: 'raw',
      secure: true,
    });
  }
  
  // For other file types, return raw URL
  return cloudinary.url(publicId, {
    resource_type: 'raw',
    secure: true,
  });
};

/**
 * Generate versioned public_id
 * @param {string} basePublicId - Base public ID
 * @param {number} version - Version number
 * @returns {string} Versioned public ID
 */
export const getVersionedPublicId = (basePublicId, version) => {
  return `${basePublicId}_v${version}`;
};

