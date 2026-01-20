import { Printer, X, RotateCcw, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

const COMPANY_LOGO =
  "https://res.cloudinary.com/dtbqhmgjz/image/upload/v1764926597/employees/dev/documents/e8d94016-d909-48b7-add0-3e6a745eb67a-1764926594722-Logo%20Resolusi.png";

export default function IDCard({ user, onClose, side = "front", onSideChange }) {
  const [showBack, setShowBack] = useState(side === "back");

  useEffect(() => {
    setShowBack(side === "back");
  }, [side]);

  const toggleSide = () => {
    const nextSide = showBack ? "front" : "back";
    setShowBack(!showBack);
    onSideChange?.(nextSide);
  };

  const qrBase =
    import.meta.env.VITE_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const qrValue = user?.employee_code
    ? `${qrBase}/id/${encodeURIComponent(user.employee_code)}`
    : `${qrBase || "https://resolusiindonesia.com"}/id/unknown`;

  useEffect(() => {
    const styleId = "id-card-print-style";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @media print {
        @page { size: A4 portrait; margin: 10mm; }
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body * { visibility: hidden; }
        .print-container, .print-container * { visibility: visible; }
        .print-container {
          position: absolute;
          inset: 0;
          width: 100%;
          display: flex !important;
          flex-direction: column;
          align-items: center;
          gap: 12mm;
          background: white !important;
        }
        .print-card {
          width: 54mm !important;
          height: 85.6mm !important;
          display: block !important;
          break-inside: avoid;
          page-break-inside: avoid;
          margin: 0;
          border: 0.1px solid #e5e7eb !important;
        }
        .print-card.print-front,
        .print-card.print-back {
          display: block !important;
        }
        .no-print { display: none !important; }
      }
    `;
    document.head.appendChild(style);
    return () => document.getElementById(styleId)?.remove();
  }, []);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden my-auto">
        {/* Toolbar */}
        <div className="p-4 bg-slate-100 border-b flex items-center justify-between no-print">
          <h2 className="font-bold text-slate-800">Preview ID Card</h2>
          <div className="flex gap-2">
            <button
              onClick={toggleSide}
              className="p-2 hover:bg-white rounded-full transition-colors text-slate-600"
              title="Putar Kartu"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all font-medium text-sm">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Container */}
        <div className="p-10 flex justify-center bg-slate-200/50">
          <div className="print-container flex flex-col items-center gap-8">
            
            {/* FRONT SIDE */}
            <div
              className={`print-card print-front bg-white relative overflow-hidden shadow-2xl rounded-[18px] flex flex-col ${
                showBack ? "hidden md:block" : "block"
              }`}
              style={{ width: "54mm", height: "85.6mm" }}
            >
              
             {/* Top Blue Wave Background */}
              <svg
                className="absolute top-0 left-0 w-full h-56"
                viewBox="0 0 240 224"
                preserveAspectRatio="none"
              >
                <path
                  d="
                    M0 0
                    H240
                    V140
                    C200 110, 170 90, 140 80
                    C100 65, 60 70, 0 110
                    Z
                  "
                  fill="#2d5ea8"
                />
              </svg>   
              {/* Bottom Pattern Background */}
              <div
                className="absolute bottom-0 left-0 w-full h-[32%] z-0"
                style={{
                  backgroundImage: `url('https://res.cloudinary.com/dtbqhmgjz/image/upload/v1768812232/bg_idcard_bfhhgp.png')`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "bottom center",
                  backgroundSize: "cover",
                }}
              />

                
              <div className="relative z-10 flex flex-col h-full items-center pt-4">
                {/* Company Logo Box */}
                <div className="absolute top-3 left-4 bg-white px-1 py-1 rounded-xl shadow-md flex items-center">
                  <img src={COMPANY_LOGO} alt="Logo" className="w-4.5 h-auto" />
                  <div className="text-left leading-tight">
                    <p className="text-[11px] text-yellow-400 font-bold -mb-1">
                      RESOLUSI
                    </p>
                    <p className="text-[5.4px] text-slate-500 font-semibold">
                      Reka Solusi Teknologi
                    </p>
                  </div>
                </div>

                {/* Photo Frame */}
                <div className="w-[96px] h-[128px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-400 rounded-2xl overflow-hidden border-[4px] border-white shadow-lg mb-0.5 mt-7">
                  <img
                    src={user.profile_photo_url || "https://via.placeholder.com/150"}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                </div>


                {/* Name Section */}
                <div className="text-center px-3">
                  <h1 className="text-[#1e3a8a] font-black text-base leading-tight uppercase tracking-wide" style={{fontFamily: 'Arial, sans-serif'}}>
                    {user.full_name || "-"}
                  </h1>
                  <p className="text-slate-600 text-xs font-semibold">{user.role_id?.name || "-"}</p>
                </div>

                {/* Info Details */}
                <div className="flex flex-col gap-0 text-[10px] text-slate-800 mb-1.5 w-full px-8">
                  <div className="flex items-center">
                    <span className="w-11 text-left font-bold">ID</span>
                    <span className="mr-1">:</span>
                    <span className="flex-1 text-left font-semibold">{user.employee_code || "-"}</span>
                  </div>
                  <div className="flex items-center">
                    <span className="w-11 text-left font-bold">Phone</span>
                    <span className="mr-1">:</span>
                    <span className="flex-1 text-left font-semibold">{user.phone || "-"}</span>
                  </div>
                </div>

                {/* QR Code */}
                <div className="bg-white p-1 rounded-lg shadow-md mb-1.5">
                  <div className="bg-white p-1 rounded">
                    <QRCode
                      value={qrValue}
                      size={70}
                      bgColor="#ffffff"
                      fgColor="#0f172a"
                      style={{ height: "70px", width: "70px" }}
                    />
                  </div>
                </div>

                {/* Footer Website */}
                <div className="mt-auto pb-0.5 flex items-center gap-1 text-[7px] text-slate-500 font-medium">
                  <Globe className="w-2 h-2" />
                  <span>www.resolusiindonesia.com</span>
                </div>
              </div>
            </div>

            {/* BACK SIDE */}
            <div
              className={`print-card print-back bg-white relative overflow-hidden shadow-2xl rounded-[18px] flex flex-col ${
                showBack ? "block" : "hidden md:block"
              }`}
              style={{ width: "54mm", height: "85.6mm" }}
            >
              
              {/* Top Blue Wave */}
              <svg className="absolute top-0 left-0 w-full h-16" viewBox="0 0 240 64" preserveAspectRatio="none">
                <path d="M 0 0 L 240 0 L 240 32 Q 180 48 120 40 Q 60 32 0 50 Z" fill="#3089C3" />
              </svg>
              <svg className="absolute top-0 left-0 w-full h-16" viewBox="0 0 240 64" preserveAspectRatio="none">
                <path d="M 0 0 L 240 0 L 240 32 Q 180 48 120 40 Q 60 32 0 50 Z" fill="#2A5DA9" transform="scale(1, 0.8)"
                  transform-origin="top"/>
              </svg>

              {/* Bottom Pattern Background */}
              <div
                className="absolute bottom-0 left-0 w-full h-[32%] z-0"
                style={{
                  backgroundImage: `url('https://res.cloudinary.com/dtbqhmgjz/image/upload/v1768812232/bg_idcard_bfhhgp.png')`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "bottom center",
                  backgroundSize: "cover",
                }}
              />

              <div className="relative z-10 flex flex-col h-full items-center px-5 pt-3">
                {/* Logo Back */}
                <div className="w-10 mb-1 mt-8 flex items-center justify-center">
                  <img src={COMPANY_LOGO} alt="Logo" className="w-full h-auto" />
                  <div classname="text-center">
                  <p className="text-[22px] text-yellow-300 font-bold mb-[-10px]">RESOLUSI</p>
                  <p className="text-[10px] text-slate-500 font-semibold">Reka Solusi Teknologi</p>
                  </div>
                </div>

                {/* Big QR Code */}
                <div className="bg-white p-2 rounded-xl shadow-md">
                  <QRCode
                    value={qrValue}
                    size={80}
                    bgColor="#ffffff"
                    fgColor="#0f172a"
                    style={{ height: "80px", width: "80px" }}
                  />
                </div>

                {/* Rules / Terms */}
                <div className="text-[7px] text-slate-700 text-justify leading-snug space-y-1 px-2 pt-2" style={{lineHeight: '1'}}>
                  <p><span className="font-bold">1.</span> ID Card dan QR Code merupakan milik perusahaan dan hanya digunakan oleh pemegang yang terdaftar.</p>
                  <p><span className="font-bold">2.</span> ID Card dan/atau QR Code dilarang dipinjamkan, digandakan, atau disalahgunakan.</p>
                  <p><span className="font-bold">3.</span> Segala aktivitas yang dilakukan menggunakan ID Card dan/atau QR Code menjadi tanggung jawab pemegang.</p>
                  <p><span className="font-bold">4.</span> Kehilangan atau kerusakan ID Card wajib segera dilaporkan kepada perusahaan.</p>
                  <p><span className="font-bold">5.</span> Perusahaan berhak menonaktifkan ID Card dan QR Code sesuai kebijakan yang berlaku.</p>
                </div>
              </div>

              {/* Bottom Right Blue Wave */}
              <svg
                className="absolute bottom-0 left-0 w-full h-28"
                viewBox="0 0 1440 200"
                preserveAspectRatio="none"
              >
                <path
                  d="
                    M0 200
                    H1440
                    V100
                    C1100 150, 800 200, 30 190
                    C300 120, 0, 0 100
                    Z
                  "
                  fill="#3089C3"
                />
              </svg>
              <svg
                className="absolute bottom-0 left-0 w-full h-28"
                viewBox="0 0 1440 200"
                preserveAspectRatio="none"
              >
                <path
                  d="
                    M0 200
                    H1440
                    V80
                    C1100 150, 800 200, 30 190
                    C300 120, 0, 0 100
                    Z
                  "
                  fill="#2A5DA9"
                  transform="scale(1, 0.6)"
                  transform-origin="bottom"
                />
              </svg>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}