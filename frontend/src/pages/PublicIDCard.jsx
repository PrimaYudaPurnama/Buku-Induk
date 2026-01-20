import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { AlertCircle, Loader2, Globe, User, Briefcase, ShieldAlert, Users } from "lucide-react";
import QRCode from "react-qr-code";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api/v1";

const safeGet = (obj, path, fallback = "-") => {
  try {
    return path.split(".").reduce((acc, key) => acc?.[key], obj) ?? fallback;
  } catch {
    return fallback;
  }
};

export default function PublicIDCard() {
  const { code } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!code) return;
    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/public/id/${encodeURIComponent(code)}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.message || "Data tidak ditemukan");
        }
        const body = await res.json();
        setData(body.data);
      } catch (err) {
        setError(err.message || "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [code]);

  const qrValue = useMemo(() => {
    const base = import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin;
    return `${base}/id/${encodeURIComponent(code || "unknown")}`;
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl shadow-2xl p-8 backdrop-blur">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-6 h-6 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold">Verifikasi ID Card</h1>
              <p className="text-slate-400 text-sm">Data publik yang aman untuk dibagikan</p>
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-10 gap-3 text-slate-300">
              <Loader2 className="w-6 h-6 animate-spin" />
              Memuat...
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 text-red-200 px-4 py-3 rounded-2xl">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && data && (
            <div className="grid grid-cols-1 md:grid-cols-[1.2fr_0.8fr] gap-6">
              <div className="bg-gradient-to-br from-blue-900/60 to-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-slate-800 border border-slate-700 flex items-center justify-center text-3xl font-semibold">
                    {data.profile_photo_url ? (
                      <img
                        src={data.profile_photo_url}
                        alt={data.full_name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span>{data.full_name?.[0]?.toUpperCase() || "?"}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-lg font-bold">{data.full_name}</div>
                    <div className="text-slate-300 text-sm">{data.employee_code}</div>
                    <div className="mt-1 inline-flex px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-200 border border-emerald-500/30">
                      {data.status}
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-3 text-sm text-slate-200">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-300" />
                    <span className="text-slate-400 w-28">Nama</span>
                    <span className="font-semibold">{data.full_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-blue-300" />
                    <span className="text-slate-400 w-28">Role</span>
                    <span className="font-semibold">
                      {safeGet(data, "role.name")}
                      {data.role?.hierarchy_level ? ` (Level ${data.role.hierarchy_level})` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-blue-300" />
                    <span className="text-slate-400 w-28">Divisi</span>
                    <span className="font-semibold">{safeGet(data, "division.name")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-blue-300" />
                    <span className="text-slate-400 w-28">Tipe</span>
                    <span className="font-semibold capitalize">{data.employment_type || "-"}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl p-5 shadow-xl flex flex-col items-center justify-center gap-4 text-slate-900">
                <QRCode value={qrValue} size={180} bgColor="#ffffff" fgColor="#0f172a" />
                <div className="text-center text-sm">
                  <div className="font-semibold text-slate-800">Scan untuk verifikasi</div>
                  <div className="text-slate-500 break-all">{qrValue}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
