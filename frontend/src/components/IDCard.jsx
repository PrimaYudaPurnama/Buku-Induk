import { Printer, X, RotateCcw, Globe } from "lucide-react";
import { useEffect, useState } from "react";

const COMPANY_LOGO =
  "https://res.cloudinary.com/dtbqhmgjz/image/upload/v1764926597/employees/dev/documents/e8d94016-d909-48b7-add0-3e6a745eb67a-1764926594722-Logo%20Resolusi.png";

// Fungsi sederhana untuk generate QR Code URL
const generateQRCodeURL = (data) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(data)}`;
};

export default function IDCard({ 
  user = {
    full_name: "RASANANDA SANTATARA",
    role_id: { name: "Solution Manager" },
    employee_code: "EMP001",
    phone: "0822 0222 0333",
    profile_photo_url: "https://via.placeholder.com/150"
  },
  onClose = () => {} 
}) {
  const [showBack, setShowBack] = useState(false);

  const qrBase = typeof window !== "undefined" ? window.location.origin : "https://resolusiindonesia.com";
  const qrValue = user?.employee_code
    ? `${qrBase}/id/${encodeURIComponent(user.employee_code)}`
    : `${qrBase}/id/unknown`;
  
  const QR_CODE = generateQRCodeURL(qrValue);

  useEffect(() => {
    const styleId = "id-card-print-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @media print {
          @page { size: A4 portrait; margin: 15mm; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .front-card, .back-card { display: block !important; }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const handlePrint = () => window.print();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 bg-slate-100 border-b flex items-center justify-between no-print">
          <h2 className="font-bold text-slate-800">Preview ID Card</h2>
          <div className="flex gap-2">
            <button 
              onClick={() => setShowBack(!showBack)} 
              className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm hover:bg-slate-50 transition-all"
            >
              <RotateCcw className="w-4 h-4" /> {showBack ? 'Sisi Depan' : 'Sisi Belakang'}
            </button>
            <button 
              onClick={handlePrint} 
              className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              <Printer className="w-4 h-4" /> Print
            </button>
            <button 
              onClick={onClose} 
              className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-10 flex flex-col items-center bg-slate-200 print-area">
          <div className="flex flex-col items-center gap-8">
            
            {/* FRONT SIDE */}
            <div className={`front-card ${showBack ? "hidden" : "block"}`}>
              <div 
                className="bg-white relative overflow-hidden shadow-2xl rounded-lg flex flex-col"
                style={{ width: "54mm", height: "85.6mm" }}
              >
                
                {/* Top Blue Wave Background */}
                <svg
                  className="absolute top-0 left-0 w-full h-56"
                  viewBox="0 0 240 224"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="wave-cutout-small">
                      <rect x="0" y="0" width="240" height="224" fill="white" />
                      <path
                        d="M0 0 H240 V100 C220 90, 100 30, 0 175 Z"
                        fill="black"
                        transform="rotate(180 120 112)"
                      />
                    </mask>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width="240"
                    height="224"
                    fill="#3089C3"
                    mask="url(#wave-cutout-small)"
                  />
                </svg>

                <svg
                  className="absolute top-0 left-0 w-full h-56"
                  viewBox="0 0 240 224"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <mask id="wave-cutout-big">
                      <rect x="0" y="0" width="240" height="224" fill="white" />
                      <path
                        d="M0 0 H240 V101 C170 83, 100 50, 0 220 Z"
                        fill="black"
                        transform="rotate(180 120 112)"
                      />
                    </mask>
                  </defs>
                  <rect
                    x="0"
                    y="0"
                    width="240"
                    height="224"
                    fill="#2A5DA9"
                    mask="url(#wave-cutout-big)"
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
                  <div className="absolute top-3 left-4 bg-white px-1 py-1 rounded-md shadow-md flex items-center">
                    <img src={COMPANY_LOGO} alt="Logo" className="w-4.5 h-auto" />
                    <div className="text-left leading-tight">
                      <p className="text-[11px] text-yellow-400 font-bold -mb-[2px]">
                        RESOLUSI
                      </p>
                      <p className="text-[5.2px] text-blue-500 font-semibold">
                        Reka Solusi Teknologi
                      </p>
                    </div>
                  </div>

                  {/* Photo Frame */}
                  <div className="w-[96px] h-[128px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-400 rounded-2xl overflow-hidden border-[3.5px] border-white shadow-lg mb-0.5 mt-7">
                    <img
                      src={user.profile_photo_url || "https://via.placeholder.com/150"}
                      alt="Profile"
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Name Section */}
                  <div className="text-center px-3">
                    <h1 className="text-[#2A5DA9] text-base bold leading-tight uppercase tracking-wide" style={{fontFamily: 'Lato, sans-serif', fontWeight: 900}}>
                    {user.full_name.split(' ')[0]} <span className="text-black" style={{fontFamily: 'Lato, sans-serif', fontWeight: 300}}>{user.full_name.split(' ').slice(1).join(' ')}</span>
                    </h1>
                    <p className="text-slate-600 text-[10px]" style={{fontFamily: 'raleway, sans-serif', fontWeight: 400}}>{user.role_id?.name || "-"}</p>
                  </div>

                  {/* Info Details */}
                  <div className="flex flex-col gap-0 text-[9px] text-slate-800 mb-1 w-full px-8">
                    <div className="flex items-center">
                      <span className="w-11 text-left" style={{fontFamily: 'Lato, sans-serif', fontWeight: 400}}>ID</span>
                      <span className="mr-1">:</span>
                      <span className="flex-1 text-left" style={{fontFamily: 'Lato, sans-serif', fontWeight: 400}}>{user.employee_code || "-"}</span>
                    </div>
                    <div className="flex items-center">
                      <span className="w-11 text-left" style={{fontFamily: 'Lato, sans-serif', fontWeight: 400}}>Phone</span>
                      <span className="mr-1">:</span>
                      <span className="flex-1 text-left" style={{fontFamily: 'Lato, sans-serif', fontWeight: 400}}>{user.phone || "-"}</span>
                    </div>
                  </div>

                  {/* QR Code */}
                  <div className=" p-1 mb-1.5">
                    <div className="p-1">
                      <img 
                        src={QR_CODE} 
                        alt="QR Code" 
                        className="w-[70px] h-[70px]"
                      />
                    </div>
                  </div>

                  {/* Footer Website */}
                  <div className="mt-auto pb-0.5 flex items-center gap-1 text-[7px] text-slate-500">
                    <Globe className="w-2 h-2 text-blue-700" />
                    <span style={{fontFamily: 'Lato, sans-serif', fontWeight: 400}}>www.resolusiindonesia.com</span>
                  </div>
                </div>
              </div>
            </div>

            {/* BACK SIDE */}
            <div className={`back-card ${showBack ? "block" : "hidden"}`}>
              <div
                className="bg-white relative overflow-hidden shadow-2xl rounded-lg flex flex-col"
                style={{ width: "54mm", height: "85.6mm" }}
              >
                
                {/* Top Blue Wave */}
                <svg className="absolute top-0 left-0 w-full h-16" viewBox="0 0 240 64" preserveAspectRatio="none">
                  <path d="M 0 0 L 240 0 L 240 32 Q 180 48 120 40 Q 60 32 0 50 Z" fill="#3089C3" />
                </svg>
                <svg className="absolute top-0 left-0 w-full h-16" viewBox="0 0 240 64" preserveAspectRatio="none">
                  <path d="M 0 0 L 240 0 L 240 32 Q 180 48 120 40 Q 60 32 0 50 Z" fill="#2A5DA9" transform="scale(1, 0.8)" transform-origin="top"/>
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
                    <div className="text-center">
                      <p className="text-[20px] text-yellow-300 font-bold -mb-[7px]">RESOLUSI</p>
                      <p className="text-[9.3px] text-blue-500 font-semibold">Reka Solusi Teknologi</p>
                    </div>
                  </div>

                  {/* Big QR Code */}
                  <div className="bg-white p-2 rounded-xl">
                    <img 
                      src={QR_CODE} 
                      alt="QR Code" 
                      className="w-[80px] h-[80px]"
                    />
                  </div>

                  {/* Rules / Terms */}
                  <div className="text-[7px] text-slate-700 text-justify leading-snug space-y-1 px-2 pt-2" style={{lineHeight: '1', fontFamily: 'Lato, sans-serif', fontWeight: 400}}>
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
                    d="M0 200 H1440 V100 C1100 150, 800 200, 30 190 C300 120, 0, 0 100 Z"
                    fill="#3089C3"
                  />
                </svg>
                <svg
                  className="absolute bottom-0 left-0 w-full h-28"
                  viewBox="0 0 1440 200"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 200 H1440 V80 C1100 150, 800 200, 30 190 C300 120, 0, 0 100 Z"
                    fill="#2A5DA9"
                    transform="scale(1, 0.6)"
                    transform-origin="bottom"
                  />
                </svg>
              </div>
            </div>

          </div>
        </div>

        <div className="p-4 bg-white text-center no-print">
          <p className="text-[10px] text-slate-400 italic">Gunakan kertas yang sesuai untuk hasil terbaik.</p>
        </div>
      </div>
    </div>
  );
}