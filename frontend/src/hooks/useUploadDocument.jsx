import { useState } from "react";
import { uploadDocument } from "../utils/api";

export const useUploadDocument = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const upload = async (file, userId, documentType, description = "") => {
    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("user_id", userId);
      formData.append("document_type", documentType);
      if (description) formData.append("description", description);

      const result = await uploadDocument(formData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { upload, loading, error };
};

