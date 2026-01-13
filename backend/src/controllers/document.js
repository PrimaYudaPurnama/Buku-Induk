import {
  createDocumentForEvent,
  uploadFileMetadata,
  getUserDocuments,
  getDocumentById as getDocumentByIdService,
  getDocumentVersions,
} from "../services/documentService.js";
import { handleDocumentUploaded } from "../services/notificationService.js";
import { getFileViewUrl } from "../utils/cloudinary.js";
import User from "../models/user.js";
import { canAccessResource } from "../middleware/auth.js";
import { logAudit } from "../utils/auditLogger.js";

/**
 * Enrich document with view_url
 * @param {object} doc - Document object
 * @returns {object} Document with view_url
 */
const enrichDocumentWithViewUrl = (doc) => {
  const docObj = doc.toObject ? doc.toObject() : doc;
  
  const isImage = docObj.mime_type?.startsWith('image/');
  const isPdf = docObj.mime_type === 'application/pdf';
  
  // Check if it's an Office document that needs proxy endpoint
  const isOfficeDoc = docObj.mime_type?.includes('wordprocessingml') || 
                     docObj.mime_type?.includes('spreadsheetml') ||
                     docObj.mime_type?.includes('presentationml') ||
                     docObj.mime_type === 'application/msword' ||
                     docObj.mime_type === 'application/vnd.ms-word' ||
                     docObj.mime_type === 'application/vnd.ms-excel' ||
                     docObj.mime_type === 'application/vnd.ms-powerpoint' ||
                     docObj.mime_type === 'application/vnd.openxmlformats-officedocument';
  
  // For images, use direct Cloudinary URL (browsers can display directly)
  if (isImage && docObj.cloudinary_public_id) {
    docObj.view_url = getFileViewUrl(docObj.cloudinary_public_id, docObj.mime_type);
  }
  // For PDF and Office docs, use proxy endpoint to ensure proper viewing with correct filename
  else if ((isPdf || isOfficeDoc) && docObj._id) {
    // Use backend proxy endpoint that serves file with proper headers and filename
    docObj.view_url = `/api/v1/documents/${docObj._id}/view`;
  }
  // For other file types that might need proper filename (text files, etc.), also use proxy
  else if (docObj._id && docObj.mime_type && !isImage) {
    // Use proxy for non-image files to ensure proper filename
    docObj.view_url = `/api/v1/documents/${docObj._id}/view`;
  }
  // Fallback to Cloudinary URL or original file_url
  else if (docObj.cloudinary_public_id && docObj.mime_type) {
    docObj.view_url = getFileViewUrl(docObj.cloudinary_public_id, docObj.mime_type);
  } else {
    docObj.view_url = docObj.file_url;
  }
  
  return docObj;
};

class DocumentController {
  /**
   * POST /api/v1/documents/upload
   * Upload a document
   */
  static async uploadDocument(c) {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const formData = await c.req.formData();
      const file = formData.get("file");
      const userId = formData.get("user_id") || null;
      const accountRequestId = formData.get("account_request_id") || null;
      const documentType = formData.get("document_type");
      const description = formData.get("description") || "";

      if (!file) {
        return c.json({ message: "No file provided" }, 400);
      }

      if (!documentType) {
        return c.json({ message: "document_type is required" }, 400);
      }

      if (!userId && !accountRequestId) {
        return c.json({ message: "Either user_id or account_request_id is required" }, 400);
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Preserve original filename with extension
      const originalFilename = file.name || "document";
      
      const fileData = {
        buffer,
        filename: originalFilename, // Keep original filename
        mime_type: file.type || "application/octet-stream",
        size: file.size || buffer.length,
      };

      // Create document
      const document = await createDocumentForEvent(
        userId,
        documentType,
        fileData,
        user._id,
        description,
        accountRequestId
      );

      // Log audit
      await logAudit(
        c,
        "document_upload",
        "document",
        document._id,
        null,
        {
          document_type: documentType,
          user_id: userId,
          account_request_id: accountRequestId,
          file_name: document.file_name,
          file_size: document.file_size,
        }
      );

      // Notify user (only if userId is provided)
      // if (userId) {
      //   const targetUser = await User.findById(userId);
      //   if (targetUser) {
      //     await handleDocumentUploaded(targetUser, documentType);
      //   }
      // }

      return c.json({
        message: "Document uploaded successfully",
        data: document,
      });
    } catch (error) {
      console.error("Upload document error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * POST /api/v1/documents/upload-metadata
   * Upload file metadata (for profile photos or general files)
   */
  static async uploadFileMetadata(c) {
    try {
      const user = c.get("user");
      if (!user) {
        return c.json({ message: "Unauthorized" }, 401);
      }

      const formData = await c.req.formData();
      const file = formData.get("file");
      const userId = formData.get("user_id") || user._id.toString();
      const folder = formData.get("folder") || "files";

      if (!file) {
        return c.json({ message: "No file provided" }, 400);
      }

      // Convert file to buffer
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const fileData = {
        buffer,
        filename: file.name || "file",
        mime_type: file.type || "application/octet-stream",
        size: file.size || buffer.length,
      };

      // Upload file metadata
      const metadata = await uploadFileMetadata(userId, fileData, user._id, folder);

      // Log audit
      await logAudit(
        c,
        "file_metadata_upload",
        "file_metadata",
        metadata._id,
        null,
        {
          user_id: userId,
          folder,
          file_name: metadata.original_filename,
          file_size: metadata.size,
        }
      );

      return c.json({
        message: "File uploaded successfully",
        data: metadata,
      });
    } catch (error) {
      console.error("Upload file metadata error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/documents/user/:id
   * Get all documents for a user or account request
   */
  static async getUserDocuments(c) {
    try {
      const id = c.req.param("id");
      const query = c.req.query();
      const { type, limit = 50, offset = 0 } = query;

      const currentUser = c.get("user");
      
      // Check if it's an account request ID (24 char hex) or user ID
      // Try to find as account request first
      const AccountRequest = (await import("../models/accountRequest.js")).default;
      const accountRequest = await AccountRequest.findById(id);
      
      if (accountRequest) {
        // It's an account request, get documents by account_request_id
        const Document = (await import("../models/document.js")).default;
        const queryDoc = { account_request_id: id };
        if (type) queryDoc.document_type = type;
        
        const documents = await Document.find(queryDoc)
          .populate("uploaded_by", "full_name email")
          .sort({ created_at: -1 });

        const paginatedDocs = documents.slice(
          parseInt(offset),
          parseInt(offset) + parseInt(limit)
        );

        // Enrich documents with view_url
        const enrichedDocs = paginatedDocs.map(enrichDocumentWithViewUrl);

        return c.json({
          data: enrichedDocs,
          pagination: {
            total: documents.length,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: parseInt(offset) + parseInt(limit) < documents.length,
          },
        });
      }

      // Otherwise, treat as user ID
      const targetUser = await User.findById(id).populate("division_id");

      if (!targetUser) {
        return c.json({ message: "User not found" }, 404);
      }

      // Check access permission
      if (!canAccessResource(currentUser, targetUser, "read")) {
        return c.json({ message: "Forbidden: Access denied" }, 403);
      }

      const documents = await getUserDocuments(id, type || null);

      // Apply pagination manually
      const paginatedDocs = documents.slice(
        parseInt(offset),
        parseInt(offset) + parseInt(limit)
      );

      // Enrich documents with view_url
      const enrichedDocs = paginatedDocs.map(enrichDocumentWithViewUrl);

      return c.json({
        data: enrichedDocs,
        pagination: {
          total: documents.length,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + parseInt(limit) < documents.length,
        },
      });
    } catch (error) {
      console.error("Get user documents error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/documents/:id
   * Get document by ID
   */
  static async getDocumentById(c) {
    try {
      const documentId = c.req.param("id");

      const document = await getDocumentByIdService(documentId);
      const currentUser = c.get("user");

      // Check access permission
      if (document.user_id) {
        const targetUser = await User.findById(document.user_id._id || document.user_id).populate("division_id");
        if (!canAccessResource(currentUser, targetUser, "read")) {
          return c.json({ message: "Forbidden: Access denied" }, 403);
        }
      }

      // Enrich document with view_url
      const enrichedDoc = enrichDocumentWithViewUrl(document);

      return c.json({
        data: enrichedDoc,
      });
    } catch (error) {
      console.error("Get document by ID error:", error);
      if (error.message === "Document not found") {
        return c.json({ message: error.message }, 404);
      }
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/documents/user/:id/versions/:type
   * Get document versions for a user and type
   */
  static async getDocumentVersions(c) {
    try {
      const userId = c.req.param("id");
      const type = c.req.param("type");

      const versions = await getDocumentVersions(userId, type);

      return c.json({
        data: versions,
      });
    } catch (error) {
      console.error("Get document versions error:", error);
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }

  /**
   * GET /api/v1/documents/:id/view
   * Proxy endpoint to serve document with proper headers for viewing
   */
  static async viewDocument(c) {
    try {
      const documentId = c.req.param("id");
      const document = await getDocumentByIdService(documentId);
      const currentUser = c.get("user");

      // Check access permission
      if (document.user_id) {
        const targetUser = await User.findById(document.user_id._id || document.user_id).populate("division_id");
        if (!canAccessResource(currentUser, targetUser, "read")) {
          return c.json({ message: "Forbidden: Access denied" }, 403);
        }
      }

      // Fetch file from Cloudinary URL
      const response = await fetch(document.file_url);
      if (!response.ok) {
        return c.json({ message: "Failed to fetch document" }, 500);
      }

      const fileBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(fileBuffer);

      // Determine proper Content-Type
      const contentType = document.mime_type || "application/octet-stream";
      
      // Get file extension from file_name for proper Content-Type if mime_type is missing
      let finalContentType = contentType;
      if (!document.mime_type && document.file_name) {
        const ext = document.file_name.split('.').pop()?.toLowerCase();
        const mimeTypes = {
          'pdf': 'application/pdf',
          'doc': 'application/msword',
          'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'xls': 'application/vnd.ms-excel',
          'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'ppt': 'application/vnd.ms-powerpoint',
          'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
        };
        if (mimeTypes[ext]) {
          finalContentType = mimeTypes[ext];
        }
      }

      // Use original filename, but sanitize for Content-Disposition header
      // Keep the original filename as much as possible, only encode special characters
      let sanitizedFilename = document.file_name;
      
      // Ensure filename has proper extension
      if (!sanitizedFilename.includes('.')) {
        // Add extension based on mime type if missing
        const extMap = {
          'application/pdf': 'pdf',
          'application/msword': 'doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
          'application/vnd.ms-excel': 'xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
          'application/vnd.ms-powerpoint': 'ppt',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        };
        const ext = extMap[finalContentType];
        if (ext) {
          sanitizedFilename = `${sanitizedFilename}.${ext}`;
        }
      }
      
      // Limit length but preserve extension
      if (sanitizedFilename.length > 200) {
        const ext = sanitizedFilename.substring(sanitizedFilename.lastIndexOf('.'));
        const nameWithoutExt = sanitizedFilename.substring(0, sanitizedFilename.lastIndexOf('.'));
        sanitizedFilename = nameWithoutExt.substring(0, 200 - ext.length) + ext;
      }

      // Set proper headers for viewing (not downloading)
      // Use inline for PDF and images, attachment for Office docs (browsers can't display them inline)
      const isPdf = finalContentType === 'application/pdf';
      const isImage = finalContentType.startsWith('image/');
      const contentDisposition = (isPdf || isImage) 
        ? `inline; filename="${sanitizedFilename}"`
        : `inline; filename="${sanitizedFilename}"`;

      // Return binary response with proper headers
      return new Response(buffer, {
        headers: {
          "Content-Type": finalContentType,
          "Content-Disposition": contentDisposition,
          "Content-Length": buffer.length.toString(),
          "Cache-Control": "public, max-age=3600",
          "X-Content-Type-Options": "nosniff",
        },
      });
    } catch (error) {
      console.error("View document error:", error);
      if (error.message === "Document not found") {
        return c.json({ message: error.message }, 404);
      }
      return c.json({ message: error.message || "Internal server error" }, 500);
    }
  }
}

export default DocumentController;

