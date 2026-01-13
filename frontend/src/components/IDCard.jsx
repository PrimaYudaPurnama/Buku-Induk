import { Printer, X, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

const COMPANY_LOGO = "https://res.cloudinary.com/dtbqhmgjz/image/upload/v1764926597/employees/dev/documents/e8d94016-d909-48b7-add0-3e6a745eb67a-1764926594722-Logo%20Resolusi.png";

export default function IDCard({ user, onClose }) {
  const printRef = useRef(null);
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const styleId = "id-card-print-style";
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
          width: 54mm !important;
          height: 85.6mm !important;
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

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-lg flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900/90 rounded-3xl shadow-2xl max-w-2xl w-full border border-blue-900/50 overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-800/60 flex items-center justify-between no-print">
          <h2 className="text-2xl font-bold text-white">ID Card</h2>
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
            <div className="print-label hidden">SISI DEPAN - Potong sesuai garis</div>
            
            {/* Front Side */}
            <div
            className={`print-card bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-xl shadow-xl border border-blue-500/30 overflow-hidden ${showBack ? 'hidden' : 'block'}`}
            style={{
                width: "216px",
                height: "342.4px",
            }}
            >
            <div className="relative h-full p-3 flex flex-col">

                {/* Header */}
                <div className="flex items-center gap-2 mb-2">
                <img
                    src={COMPANY_LOGO}
                    alt="Company Logo"
                    className="h-8 w-auto object-contain"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <div className="text-white leading-tight">
                    <div className="text-xs font-semibold">RESOLUSI</div>
                    <div className="text-[9px] text-slate-300">EMPLOYEE ID</div>
                </div>
                </div>

                <div className="h-px bg-blue-500/30 mb-3" />

                {/* Photo */}
                <div className="flex justify-center mb-2">
                <div className="w-20 h-20 rounded-full border-2 border-blue-400/50 overflow-hidden bg-slate-800 flex items-center justify-center">
                    {user.profile_photo_url ? (
                    <img src={user.profile_photo_url} alt={user.full_name} className="w-full h-full object-cover" />
                    ) : (
                    <span className="text-2xl font-bold text-white">
                        {user.full_name?.[0]?.toUpperCase() || "?"}
                    </span>
                    )}
                </div>
                </div>

                {/* User Info */}
                <div className="flex-1 grid gap-2 text-center">
                <div>
                    {/* <div className="text-[9px] text-slate-400 uppercase">Nama</div> */}
                    <div className="text-sm font-semibold text-white leading-tight">
                    {user.full_name}
                    </div>
                </div>

                <div>
                    <div className="text-[9px] text-slate-400 uppercase">Posisi</div>
                    <div className="text-[10px] text-blue-300 leading-tight">
                    {user.role_id?.name || "-"}
                    </div>
                </div>

                <div>
                    <div className="text-[9px] text-slate-400 uppercase">Divisi</div>
                    <div className="text-[10px] text-slate-200 leading-tight">
                    {user.division_id?.name || "-"}
                    </div>
                </div>
                </div>

                {/* Employee ID */}
                <div className="mt-3 pt-2 border-t border-blue-500/20 text-center">
                <div className="text-[9px] text-slate-400">Employee ID</div>
                <div className="text-xs font-mono font-bold text-blue-400 tracking-wide">
                    {user.employee_code || user._id.slice(-8).toUpperCase()}
                </div>
                </div>

                {/* Footer */}
                <div className="mt-2 text-[9px] text-slate-400 flex justify-between">
                <span>
                    {user.termination_date ? formatDate(user.termination_date) : "Permanent"}
                </span>
                <span className={user.status === "active" ? "text-green-400" : "text-amber-400"}>
                    ● {user.status?.toUpperCase()}
                </span>
                </div>
            </div>
            </div>


            {/* Label Belakang */}
            <div className="print-label hidden">SISI BELAKANG - Lipat atau tempel</div>

            {/* Back Side */}
            <div
            className={`print-card bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 rounded-xl shadow-xl border border-blue-500/30 overflow-hidden ${showBack ? 'block' : 'hidden'}`}
            style={{
                width: "216px",
                height: "342.4px",
            }}
            >
            <div className="relative h-full p-3 flex flex-col text-center">

                {/* Logo */}
                <div className="mb-3">
                <img
                    src={COMPANY_LOGO}
                    alt="Company Logo"
                    className="h-10 w-auto object-contain mx-auto opacity-80"
                    onError={(e) => (e.currentTarget.style.display = "none")}
                />
                </div>

                <div className="h-px bg-blue-500/30 mb-3" />

                {/* Ownership Info */}
                <div className="flex-1 flex flex-col justify-center gap-3 text-white">
                <div>
                    <div className="text-[9px] text-slate-400 mb-1">
                    Kartu ini adalah milik:
                    </div>
                    <div className="text-sm font-semibold leading-tight">
                    Resolusi Teknologi Indonesia
                    </div>
                </div>

                <div className="pt-3 border-t border-blue-500/20">
                    <div className="text-[9px] text-slate-400 mb-2">
                    Jika ditemukan, harap dikembalikan ke:
                    </div>
                    <div className="text-[10px] text-blue-300 leading-relaxed">
                    admin@resolusi.co.id<br />
                    021-XXX-XXXX
                    </div>
                </div>
                </div>

                {/* Footer */}
                <div className="mt-3 text-[8px] text-slate-500">
                © Resolusi Teknologi Indonesia
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
            Ukuran: 54mm × 85.6mm (Portrait ID Card) • Print akan menampilkan depan dan belakang dalam satu kertas A4
          </p>
        </div>
      </div>
    </div>
  );
}