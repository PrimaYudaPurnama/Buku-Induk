import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { fetchUserDocuments } from "../utils/api";
import DocumentCard from "../components/DocumentCard";
import toast from "react-hot-toast";

const API_BASE = "http://localhost:3000";

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

  const handleView = (doc) => {
    // Use view_url if available (from backend), otherwise fallback to file_url
    let url = doc.view_url || doc.file_url;
    
    // If it's a relative URL (starts with /), prepend API base URL
    if (url && url.startsWith('/')) {
      url = `${API_BASE}${url}`;
    }
    
    if (url) {
      window.open(url, "_blank");
    } else {
      toast.error('URL dokumen tidak tersedia');
    }
  };

  const handleDownload = async (doc) => {
    try {
      // Use view_url if available, otherwise use file_url
      const url = doc.view_url || doc.file_url;
      
      // If it's a relative URL (proxy endpoint), fetch and download
      if (url.startsWith('/')) {
        const fullUrl = `${API_BASE}${url}`;
        const response = await fetch(fullUrl, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to download document');
        }
        
        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = window.document.createElement("a");
        link.href = downloadUrl;
        
        // Get filename from Content-Disposition header or use doc.file_name
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = doc.file_name;
        
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            filename = filenameMatch[1].replace(/['"]/g, '');
          }
        }
        
        link.download = filename;
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);
      } else {
        // Direct URL - use standard download
        const link = window.document.createElement("a");
        link.href = url;
        link.download = doc.file_name;
        link.target = "_blank";
        window.document.body.appendChild(link);
        link.click();
        window.document.body.removeChild(link);
      }
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Gagal mengunduh dokumen');
    }
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent mb-2">
            Dokumen Pengguna
          </h1>
          <p className="text-slate-400">Lihat dan unduh dokumen pengguna</p>
        </div>

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-6">
          <div className="flex justify-between items-center">
            <label className="text-sm font-medium text-slate-300">Filter Tipe Dokumen</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Tipe</option>
              <option value="contract">Contract</option>
              <option value="id_card">ID Card</option>
              <option value="certificate">Certificate</option>
              <option value="resume">Resume</option>
              <option value="performance_review">Performance Review</option>
              <option value="disciplinary">Disciplinary</option>
              <option value="resignation">Resignation</option>
              <option value="termination">Termination</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-14 h-14 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-400 text-lg">Error: {error}</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-lg">Tidak ada dokumen</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    </div>
  );
};

export default DocumentViewer;

