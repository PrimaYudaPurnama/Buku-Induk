import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { fetchUserDocuments } from "../utils/api";
import DocumentCard from "../components/DocumentCard";

const DocumentViewer = () => {
  const { id } = useParams();
  const userId = id;
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedType, setSelectedType] = useState("");

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setLoading(true);
        const result = await fetchUserDocuments(userId, {
          type: selectedType || undefined,
        });
        setDocuments(result.data || []);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (userId) {
      loadDocuments();
    }
  }, [userId, selectedType]);

  const handleView = (document) => {
    window.open(document.file_url, "_blank");
  };

  const handleDownload = (document) => {
    const link = document.createElement("a");
    link.href = document.file_url;
    link.download = document.file_name;
    link.click();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Memuat dokumen...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Dokumen Pengguna</h1>
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Semua Tipe</option>
          <option value="contract">Contract</option>
          <option value="id_card">ID Card</option>
          <option value="certification">Certification</option>
          <option value="performance_review">Performance Review</option>
          <option value="disciplinary">Disciplinary</option>
          <option value="resignation">Resignation</option>
          <option value="termination">Termination</option>
        </select>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          Tidak ada dokumen
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <DocumentCard
              key={doc._id}
              document={doc}
              onView={handleView}
              onDownload={handleDownload}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default DocumentViewer;

