import React, { useEffect, useMemo, useState } from "react";
import { Clock, Save, RefreshCw, ToggleLeft, ToggleRight } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { fetchWeeklySchedule, seedWeeklySchedule, updateWeeklyScheduleDay } from "../utils/api.jsx";

const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function WeeklyScheduleAdmin() {
  const { user } = useAuthStore();
  const isHR = useMemo(() => {
    const role = user?.role || user?.roles || user?.permissions;
    // Allow if the user object indicates HR-like role; adjust as needed to match backend
    return typeof role === "string" ? role.toLowerCase().includes("hr") : JSON.stringify(role || "").toLowerCase().includes("hr");
  }, [user]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weekly, setWeekly] = useState([]);

  const fetchWeekly = async () => {
    try {
      setLoading(true);
      const data = await fetchWeeklySchedule();
      setWeekly(Array.isArray(data) ? data : []);
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
    const item = weekly.find((d) => d.day_of_week === dow);
    if (!item) return;
    try {
      setSaving(true);
      await updateWeeklyScheduleDay(dow, {
        is_working_day: !!item.is_working_day,
        check_in: item.check_in,
        check_out: item.check_out,
      });
    } finally {
      setSaving(false);
    }
  };

  // if (!isHR) {
  //   return (
  //     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
  //       <div className="text-slate-300 text-sm">Akses terbatas. Hanya HR.</div>
  //     </div>
  //   );
  // }

  return (
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
            className="px-3 py-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Seed/Sync 7 Hari
          </button>
        </div>

        {loading ? (
          <div className="text-slate-400 text-sm">Memuat...</div>
        ) : (
          <div className="space-y-3">
            {Array.from({ length: 7 }).map((_, dow) => {
              const item = weekly.find((x) => x.day_of_week === dow) || {
                day_of_week: dow,
                is_working_day: dow !== 0,
                check_in: dow === 6 ? "08:00" : dow === 0 ? null : "08:00",
                check_out: dow === 6 ? "12:00" : dow === 0 ? null : "16:00",
              };
              const working = !!item.is_working_day;
              return (
                <div key={dow} className="p-4 rounded-2xl border border-slate-700 bg-slate-900/60">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-slate-100 font-medium">{dayNames[dow]}</div>
                    <button
                      onClick={() => updateLocal(dow, { is_working_day: !working, ...(working ? {} : { check_in: "08:00", check_out: dow === 6 ? "12:00" : "16:00" }) })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${working ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" : "bg-slate-800 text-slate-300 border-slate-700"}`}
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
                      className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center gap-2"
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
  );
}

