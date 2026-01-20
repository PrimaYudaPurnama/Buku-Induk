import { Printer, X, RotateCcw, Phone, Mail, Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { IoMdMail, IoIosGlobe } from "react-icons/io";
import { IoCall } from "react-icons/io5";

const COMPANY_LOGO = "https://res.cloudinary.com/dtbqhmgjz/image/upload/v1764926597/employees/dev/documents/e8d94016-d909-48b7-add0-3e6a745eb67a-1764926594722-Logo%20Resolusi.png";
// Placeholder untuk QR Code (Ganti dengan dynamic QR jika perlu)
const QR_CODE = "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://www.resolusiindonesia.com";
// Background World Map Dot Matrix (SVG Pattern)
const WORLD_MAP = "url(\"data:image/svg+xml,%3Csvg width='400' height='200' viewBox='0 0 400 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M100 50h2v2h-2zm10 0h2v2h-2zm10 0h2v2h-2z' fill='%23ccc' fill-opacity='0.2'/%3E%3C/svg%3E\")";

export default function NameCard({ 
  user = { 
    full_name: "RASANANDA SANTATARA", 
    role_id: { name: "Solution Manager" }, 
    phone: "0822 0222 0333", 
    email: "resolusi@mail.com",
    website: "www.resolusiindonesia.com",
    address: "Jl. Elang Jawa No.9, Karangsari Wedomartani, Ngemplak, Sleman D.I Yogyakarta 55584"
  }, 
  onClose = () => {} 
}) {
  const [showBack, setShowBack] = useState(false);

  useEffect(() => {
    const styleId = "name-card-print-style";
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
          <h2 className="font-bold text-slate-800">Preview Kartu Nama</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowBack(!showBack)} className="flex items-center gap-2 px-3 py-1.5 bg-white border rounded-lg text-sm hover:bg-slate-50 transition-all">
              <RotateCcw className="w-4 h-4" /> {showBack ? 'Sisi Depan' : 'Sisi Belakang'}
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
              <Printer className="w-4 h-4" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors"><X className="w-5 h-5" /></button>
          </div>
        </div>

        {/* Card Content */}
        <div className="p-10 flex flex-col items-center bg-slate-200 print-area">
          <div className="flex flex-col items-center gap-8">
            {/* FRONT SIDE */}
            <div className={`front-card ${showBack ? "hidden" : "block"}`}>
              <div className="relative bg-white overflow-hidden rounded-lg border border-slate-200" style={{ width: "90mm", height: "55mm", backgroundImage: WORLD_MAP, backgroundSize: 'cover' }}>
                <div
                  className="absolute bottom-0 left-0 w-full h-full z-0"
                  style={{
                    backgroundImage: `url('https://res.cloudinary.com/dtbqhmgjz/image/upload/v1768884213/map_depan_voupzr.png')`,
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "bottom center",
                    backgroundSize: "90% auto",

                  }}
                />
                {/* Top Logo */}
                
                <div className="absolute top-3 right-4 px-1 py-1 flex items-center">
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

                {/* Name and Role */}
                <div className="mt-16 left-0 right-0 px-4 absolute">
                  <h1 className="text-l font-bold text-slate-800 tracking-tight uppercase">
                    {user.full_name.split(' ')[0]} <span className="font-normal">{user.full_name.split(' ').slice(1).join(' ')}</span>
                  </h1>
                  <div className="flex items-center gap-2">
                    <p className="text-blue-600 text-[8px] font-semibold tracking-wide uppercase whitespace-nowrap">
                      {user.role_id?.name}
                    </p>
                    <div className="flex-1 h-[2px] bg-black"></div>
                  </div>

                </div>

                {/* Contact Info */}
                <div className="absolute bottom-6 left-4 space-y-0.5">
                  <div className="flex items-center gap-2 text-[7.5px] text-slate-700">
                    <IoCall className="w-3 h-2 fill-blue-600" /> <span class>087767802000</span>
                  </div>
                  <div className="flex items-center gap-2 text-[7.5px] text-slate-700">
                    <IoMdMail  className="w-3 h-2 fill-blue-600" /> <span>info@resolusiindonesia.com</span>
                  </div>
                  <div className="flex items-center gap-2 text-[7.5px] text-slate-700">
                    <IoIosGlobe className="w-3 h-2 fill-blue-600" /> <span>www.resolusiindonesia.com</span>
                  </div>
                </div>

                {/* QR and Address */}
                <div className="absolute bottom-6 right-6 text-right flex flex-col items-end">
                  <img src={QR_CODE} alt="QR" className="w-10 h-10 mb-2" />
                  <p className="text-[6px] leading-tight text-slate-500 max-w-[140px]">
                  Jl. Elang Jawa No.9, Karangsari, Wedomartani, Kec. Ngemplak, Kabupaten Sleman, Daerah Istimewa Yogyakarta 55584
                  </p>
                </div>

                {/* Bottom Accent Bars */}
                <div className="absolute bottom-0 left-0 w-full h-3 flex">
                  <div className="w-1/2 bg-blue-600 "></div>
                  <div className="w-1/2 bg-orange-500  ml-0.5"></div>
                </div>
              </div>
            </div>

            {/* BACK SIDE */}
            <div className={`back-card ${showBack ? "block" : "hidden"}`}>
              <div
              className="relative shadow-2xl overflow-hidden rounded-lg"
              style={{ width: "90mm", height: "55mm" }}
            >
              {/* World Map Background */}
              <div
                className="absolute inset-0 z-0"
                style={{
                  backgroundImage: `url(${WORLD_MAP})`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "center",
                  backgroundSize: "cover",
                  opacity: 0.15, // KUNCI
                }}
              />
            
              {/* Dark Overlay */}
              <div className="absolute inset-0 bg-[#1a222c]/90 z-0" />
            
              {/* Bottom Map Accent */}
              <div
                className="absolute bottom-0 left-0 w-full h-full z-0"
                style={{
                  backgroundImage: `url('https://res.cloudinary.com/dtbqhmgjz/image/upload/v1768884219/map_belakang_lnuifx.png')`,
                  backgroundRepeat: "no-repeat",
                  backgroundPosition: "bottom center",
                  backgroundSize: "90% auto",
                  opacity: 0.75,
                }}
              />
            
              {/* CONTENT */}
              <div className="relative z-10 h-full flex flex-col items-center justify-center">
                <div className="w-full h-[2px] bg-white/80 absolute top-1/2"></div>
            
                <div className="absolute bg-white rounded-full  px-3 py-1 flex items-center">
                    <img src={COMPANY_LOGO} alt="Logo" className="w-7 h-auto" />
                    <div className="text-left leading-tight">
                      <p className="text-[15px] text-yellow-400 font-bold -mb-[2px]">
                        RESOLUSI
                      </p>
                      <p className="text-[7px] text-blue-500 font-semibold">
                        Reka Solusi Teknologi
                      </p>
                    </div>
                  </div>
            
                {/* Bottom tagline */}
                <div className="absolute bottom-3 w-full text-center z-10">
                  <p className="text-white text-[6.8px] tracking-widest opacity-90">
                    One Stop Digital Solution for Your Business
                  </p>
                </div>

              </div>
            
              {/* Bottom Accent */}
              <div className="absolute bottom-0 left-0 w-full h-3 flex z-10">
                <div className="w-1/2 bg-blue-600"></div>
                <div className="w-1/2 bg-white ml-1"></div>
              </div>
            </div>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-white text-center no-print">
          <p className="text-[10px] text-slate-400 italic">Gunakan kertas Art Paper 260gsm untuk hasil terbaik.</p>
        </div>
      </div>
    </div>
  );
}