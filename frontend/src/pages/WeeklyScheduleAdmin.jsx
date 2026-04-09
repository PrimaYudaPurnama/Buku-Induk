import React, { useEffect, useMemo, useState } from "react";
import { Clock, Save, RefreshCw, ToggleLeft } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { fetchWeeklySchedule, seedWeeklySchedule, updateWeeklyScheduleDay } from "../utils/api.jsx";
import toast, { Toaster } from "react-hot-toast"; // ✅ FIX #1: import Toaster

const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

// Default fallback per hari jika backend belum ada datanya
const getDefaultDay = (dow) => ({
  day_of_week: dow,
  is_working_day: dow !== 0,
  check_in: dow === 0 ? null : "08:00",
  check_out: dow === 0 ? null : dow === 6 ? "12:00" : "16:00",
});

export default function WeeklyScheduleAdmin() {
  const { user } = useAuthStore();
  const isHR = useMemo(() => {
    const role = user?.role || user?.roles || user?.permissions;
    return typeof role === "string"
      ? role.toLowerCase().includes("hr")
      : JSON.stringify(role || "").toLowerCase().includes("hr");
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // ✅ FIX #2: Inisialisasi state dengan 7 hari default agar tidak pernah kosong
  const [weekly, setWeekly] = useState(() =>
    Array.from({ length: 7 }, (_, dow) => getDefaultDay(dow))
  );

  const fetchWeekly = async () => {
    try {
      setLoading(true);
      const data = await fetchWeeklySchedule();
      const fetched = Array.isArray(data) ? data : [];

      // ✅ FIX #3: Merge data dari server dengan default, sehingga semua 7 hari selalu ada
      setWeekly(
        Array.from({ length: 7 }, (_, dow) => {
          const fromServer = fetched.find((x) => x.day_of_week === dow);
          return fromServer ?? getDefaultDay(dow);
        })
      );
    } catch (error) {
      toast.error(error?.message || "Gagal memuat jadwal mingguan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWeekly();
  }, []);

  const handleSeed = async () => {
    try {
      setSaving(true);
      await seedWeeklySchedule();
      await fetchWeekly();
      toast.success("Jadwal mingguan berhasil disinkronkan");
    } catch (error) {
      toast.error(error?.message || "Gagal seed/sync jadwal mingguan");
    } finally {
      setSaving(false);
    }
  };

  const updateLocal = (dow, patch) => {
    setWeekly((prev) =>
      prev.map((d) => (d.day_of_week === dow ? { ...d, ...patch } : d))
    );
  };

  const saveDay = async (dow) => {
    // ✅ FIX #4: item sekarang pasti ada karena state sudah di-init dengan 7 hari
    const item = weekly.find((d) => d.day_of_week === dow);
    if (!item) return;

    try {
      setSaving(true);
      await updateWeeklyScheduleDay(dow, {
        is_working_day: !!item.is_working_day,
        check_in: item.check_in,
        check_out: item.check_out,
      });
      toast.success(`Jadwal ${dayNames[dow]} berhasil disimpan`);
    } catch (error) {
      toast.error(error?.message || "Gagal menyimpan jadwal harian");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* ✅ FIX #1: Toaster wajib ada agar toast tampil */}
      <Toaster
        position="top-center"
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
        <div className="max-w-3xl mx-auto bg-slate-900/80 border border-slate-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-xl font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-400" />
              Pengaturan Jam Mingguan
            </h2>
            <button
              onClick={handleSeed}
              disabled={saving}
              className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
              Seed/Sync 7 Hari
            </button>
          </div>

          {loading ? (
            <div className="text-slate-400 text-sm">Memuat...</div>
          ) : (
            <div className="space-y-3">
              {weekly.map((item) => {
                const dow = item.day_of_week;
                const working = !!item.is_working_day;
                return (
                  <div
                    key={dow}
                    className="p-4 rounded-2xl border border-slate-700 bg-slate-900/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-slate-100 font-medium">{dayNames[dow]}</div>
                      <button
                        onClick={() =>
                          updateLocal(dow, {
                            is_working_day: !working,
                            // Saat aktifkan kembali, set jam default
                            ...(!working
                              ? {
                                  check_in: "08:00",
                                  check_out: dow === 6 ? "12:00" : "16:00",
                                }
                              : {}),
                          })
                        }
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          working
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            : "bg-slate-800 text-slate-300 border-slate-700"
                        }`}
                      >
                        {working ? "Hari Kerja" : "Libur"}
                      </button>
                    </div>

                    {working ? (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Check-in</div>
                          <input
                            type="time"
                            value={item.check_in || ""}
                            onChange={(e) => updateLocal(dow, { check_in: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-white"
                          />
                        </div>
                        <div>
                          <div className="text-xs text-slate-400 mb-1">Check-out</div>
                          <input
                            type="time"
                            value={item.check_out || ""}
                            onChange={(e) => updateLocal(dow, { check_out: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-white"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-slate-400 flex items-center gap-2">
                        <ToggleLeft className="w-4 h-4" />
                        Jam tidak berlaku pada hari libur ini.
                      </div>
                    )}

                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => saveDay(dow)}
                        disabled={saving}
                        className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2 disabled:opacity-50 transition-colors"
                      >
                        <Save className="w-4 h-4" />
                        Simpan
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}