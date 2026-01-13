import { Printer, X, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COMPANY_LOGO = "https://res.cloudinary.com/dtbqhmgjz/image/upload/v1764926597/employees/dev/documents/e8d94016-d909-48b7-add0-3e6a745eb67a-1764926594722-Logo%20Resolusi.png";

export default function NameCard({ user = { full_name: "John Doe", role_id: { name: "Software Engineer" }, division_id: { name: "Engineering" }, phone: "+62 812 3456 7890", email: "john@resolusi.co.id" }, onClose = () => {} }) {
  const printRef = useRef(null);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const styleId = "name-card-print-style";
    if (document.getElementById(styleId)) {
      return;
    }
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @media print {
        @page {
          size: A4 portrait;
          margin: 15mm;
        }
        body * {
          visibility: hidden;
        }
        .print-container, .print-container * {
          visibility: visible;
        }
        .print-container {
          position: absolute;
          left: 50%;
          top: 0;
          transform: translateX(-50%);
        }
        .print-card {
          width: 90mm !important;
          height: 50mm !important;
          transform: none !important;
          margin-bottom: 20mm !important;
          display: block !important;
        }
        .print-label {
          display: block !important;
          text-align: center;
          margin-bottom: 8mm;
          font-size: 11pt;
          font-weight: bold;
          color: #333;
        }
        .no-print {
          display: none !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        document.head.removeChild(existingStyle);
      }
    };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-2xl w-full border border-blue-900/50 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/60 flex items-center justify-between no-print">
          <h2 className="text-2xl font-bold text-white">Kartu Nama</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl transition-all"
            >
              <Printer className="w-5 h-5" />
              Print
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="p-6 flex flex-col items-center gap-6 bg-slate-800/30">
          <div className="print-container">
            {/* Label Depan */}
            <div className="print-label" style={{ display: 'none' }}>SISI DEPAN - Potong sesuai garis</div>
            
            {/* Front Side */}
            <div
              className="print-card bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-xl shadow-xl border border-blue-500/30 overflow-hidden relative"
              style={{ 
                width: "360px", 
                height: "200px",
                display: showBack ? 'none' : 'block'
              }}
            >
              <div className="relative h-full p-5 flex flex-col justify-between">
                {/* Logo */}
                <div>
                  <img
                    src={COMPANY_LOGO}
                    alt="Company Logo"
                    className="h-10 w-auto object-contain mb-2"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  <div className="text-[10px] text-slate-400 tracking-wide">
                    RESOLUSI TEKNOLOGI INDONESIA
                  </div>
                </div>

                {/* Identity */}
                <div>
                  <div className="text-lg font-bold text-white leading-tight">
                    {user.full_name}
                  </div>
                  <div className="text-sm text-blue-300">
                    {user.role_id?.name}
                  </div>
                  <div className="text-xs text-slate-400">
                    {user.division_id?.name}
                  </div>
                </div>
              </div>
            </div>

            {/* Label Belakang */}
            <div className="print-label" style={{ display: 'none' }}>SISI BELAKANG - Lipat atau tempel</div>

            {/* Back Side */}
            <div
              className="print-card bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-xl shadow-xl border border-blue-500/30 overflow-hidden relative"
              style={{ 
                width: "360px", 
                height: "200px",
                display: showBack ? 'block' : 'none'
              }}
            >
              {/* Shape */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-indigo-600 rounded-full blur-3xl" />
              </div>

              <div className="relative h-full p-5 flex flex-col justify-center gap-3 text-sm">
                {user.phone && (
                  <div className="text-slate-200">
                    <span className="text-blue-400 font-semibold">T</span> {user.phone}
                  </div>
                )}
                {user.email && (
                  <div className="text-slate-200">
                    <span className="text-blue-400 font-semibold">E</span> {user.email}
                  </div>
                )}
                <div className="text-slate-200">
                  <span className="text-blue-400 font-semibold">W</span> resolusi.co.id
                </div>
              </div>
            </div>
          </div>

          {/* Flip Button */}
          <button
            onClick={() => setShowBack(!showBack)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-200 hover:bg-slate-700/60 transition-all no-print"
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-sm">Lihat {showBack ? 'Depan' : 'Belakang'}</span>
          </button>
        </div>

        {/* Info */}
        <div className="p-4 bg-slate-800/50 border-t border-slate-800/60 no-print">
          <p className="text-xs text-slate-400 text-center">
            Ukuran: 90mm × 50mm (Standard Name Card Size) • Print akan menampilkan depan dan belakang dalam satu kertas A4
          </p>
        </div>
      </div>
    </div>
  );
}