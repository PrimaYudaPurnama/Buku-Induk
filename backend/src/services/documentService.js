import Document from "../models/document.js";
import file_metaData from "../models/file_metaData.js";
import { uploadFile, deleteByPublicId } from "../utils/cloudinary.js";

/**
 * Create document for an event with soft versioning
 * @param {string} userId - User ID (can be null if accountRequestId is provided)
 * @param {string} type - Document type (contract, id_card, certification, etc.)
 * @param {object} fileData - File data { buffer, filename, mime_type, size }
 * @param {string} uploadedBy - User ID who uploaded
 * @param {string} description - Optional description
 * @param {string} accountRequestId - Optional AccountRequest ID (for documents before user creation)
 * @returns {Promise<object>} Created document
 */
export const createDocumentForEvent = async (
  userId,
  type,
  fileData,
  uploadedBy,
  description = "",
  accountRequestId = null
) => {
  // Determine folder and public_id based on whether it's for a user or account request
  let folder, basePublicId, existingDocs;
  
  if (accountRequestId) {
    // For account request documents
    existingDocs = await Document.find({
      account_request_id: accountRequestId,
      document_type: type,
    }).sort({ created_at: -1 });
    
    folder = `documents/account_requests/${accountRequestId}/${type}`;
    basePublicId = `${folder}/${type}_${accountRequestId}`;
  } else {
    // For user documents
    existingDocs = await Document.find({
      user_id: userId,
      document_type: type,
    }).sort({ created_at: -1 });
    
    folder = `documents/${userId}/${type}`;
    basePublicId = `${folder}/${type}_${userId}`;
  }

  // Calculate next version number
  const version = existingDocs.length > 0 ? existingDocs.length + 1 : 1;

  // Determine resource type based on mime type
  let resourceType = "auto";
  const isImage = fileData.mime_type?.startsWith("image/");
  const isOfficeDoc = fileData.mime_type?.includes("wordprocessingml") ||
                     fileData.mime_type?.includes("spreadsheetml") ||
                     fileData.mime_type?.includes("presentationml") ||
                     fileData.mime_type === "application/msword" ||
                     fileData.mime_type === "application/vnd.ms-word" ||
                     fileData.mime_type === "application/vnd.ms-excel" ||
                     fileData.mime_type === "application/vnd.ms-powerpoint" ||
                     fileData.mime_type === "application/vnd.openxmlformats-officedocument";
  
  if (!isImage && (isOfficeDoc || fileData.mime_type === "application/pdf")) {
    resourceType = "raw"; // Use raw for Office docs and PDFs
  }

  // Upload to Cloudinary (with versioning - don't overwrite)
  const uploadResult = await uploadFile(fileData.buffer, {
    folder,
    public_id: `${basePublicId}_v${version}`,
    resource_type: resourceType,
    overwrite: false,
    mime_type: fileData.mime_type,
  });

  // Create document record
  const document = await Document.create({
    user_id: userId || null,
    account_request_id: accountRequestId || null,
    document_type: type,
    file_name: fileData.filename || `document_${version}.${uploadResult.format}`,
    file_url: uploadResult.url,
    file_size: fileData.size || uploadResult.bytes,
    mime_type: fileData.mime_type || uploadResult.format,
    cloudinary_public_id: uploadResult.public_id,
    description: description || `Version ${version} of ${type}`,
    uploaded_by: uploadedBy,
  });

  return document;
};

/**
 * Get all documents for a user, optionally filtered by type
 * @param {string} userId - User ID
 * @param {string} type - Optional document type filter
 * @returns {Promise<Array>} Array of documents
 */
export const getUserDocuments = async (userId, type = null) => {
  const query = { user_id: userId };
  if (type) {
    query.document_type = type;
  }

  const documents = await Document.find(query)
    .populate("uploaded_by", "full_name email")
    .sort({ created_at: -1 });

  return documents;
};

/**
 * Get document by ID
 * @param {string} documentId - Document ID
 * @returns {Promise<object>} Document
 */
export const getDocumentById = async (documentId) => {
  const document = await Document.findById(documentId)
    .populate("user_id", "full_name email")
    .populate("uploaded_by", "full_name email");

  if (!document) {
    throw new Error("Document not found");
  }

  return document;
};

/**
 * Delete document (soft delete - mark as deleted, keep in Cloudinary)
 * @param {string} documentId - Document ID
 * @param {string} deletedBy - User ID who deleted
 * @returns {Promise<object>} Deleted document
 */
export const deleteDocument = async (documentId, deletedBy) => {
  const document = await Document.findById(documentId);
  if (!document) {
    throw new Error("Document not found");
  }

  // Optionally delete from Cloudinary (commented out to keep versioning)
  // await deleteByPublicId(document.cloudinary_public_id);

  // For now, we'll just remove the document record
  // In a real system, you might want to add a `deleted_at` field for soft delete
  await Document.findByIdAndDelete(documentId);

  return document;
};

/**
 * Get document versions for a user and type
 * @param {string} userId - User ID
 * @param {string} type - Document type
 * @returns {Promise<Array>} Array of document versions
 */
export const getDocumentVersions = async (userId, type) => {
  const documents = await Document.find({
    user_id: userId,
    document_type: type,
  })
    .populate("uploaded_by", "full_name email")
    .sort({ created_at: -1 });

  return documents;
};

/**
 * Upload file metadata (for profile photos or general files)
 * @param {string} userId - User ID
 * @param {object} fileData - File data { buffer, filename, mime_type, size }
 * @param {string} uploadedBy - User ID who uploaded
 * @param {string} folder - Optional folder path
 * @returns {Promise<object>} Created file metadata
 */
export const uploadFileMetadata = async (
  userId,
  fileData,
  uploadedBy,
  folder = "files"
) => {
  // Generate folder path
  const cloudinaryFolder = `${folder}/${userId}`;
  const publicId = `${cloudinaryFolder}/${Date.now()}_${fileData.filename || "file"}`;

  // Upload to Cloudinary
  const uploadResult = await uploadFile(fileData.buffer, {
    folder: cloudinaryFolder,
    public_id: publicId,
    resource_type: "auto",
    overwrite: false,
    mime_type: fileData.mime_type,
  });

  // Create file metadata record
  const metadata = await file_metaData.create({
    user_id: userId,
    uploaded_by: uploadedBy,
    cloudinary_public_id: uploadResult.public_id,
    url: uploadResult.url,
    original_filename: fileData.filename || uploadResult.public_id,
    size: fileData.size || uploadResult.bytes,
    mime_type: fileData.mime_type || uploadResult.format,
  });

  return metadata;
};

/**
 * Map approval event to document type
 * @param {string} eventType - Event type (promotion, termination, transfer)
 * @returns {string} Document type
 */
export const mapEventToDocumentType = (eventType) => {
  const mapping = {
    promotion: "contract",
    termination: "termination",
    transfer: "contract", // Surat perpindahan
  };

  return mapping[eventType] || "other";
};

