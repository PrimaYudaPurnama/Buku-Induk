import React, { useEffect, useMemo, useState } from "react";
import { Calendar, Save, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuthStore } from "../stores/useAuthStore";
import { fetchWorkDaysRange, upsertWorkDay, seedWorkDays } from "../utils/api.jsx";
import toast, { Toaster } from "react-hot-toast";

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const formatDateId = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export default function WorkDayAdmin() {
  const { user } = useAuthStore();
  const isHR = useMemo(() => {
    const role = user?.role || user?.roles || user?.permissions;
    return typeof role === "string" ? role.toLowerCase().includes("hr") : JSON.stringify(role || "").toLowerCase().includes("hr");
  }, [user]);

  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(false);
  const [workdays, setWorkdays] = useState([]);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seedTargetMonth, setSeedTargetMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const getMonthRangeFromYYYYMM = (ym) => {
    const [ys, ms] = String(ym || "").split("-");
    const y = Number(ys);
    const m = Number(ms);
    if (Number.isNaN(y) || Number.isNaN(m) || m < 1 || m > 12) return null;
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    return { from: formatDateId(first), to: formatDateId(last) };
  };


  const monthParam = useMemo(
    () => `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}`,
    [monthCursor]
  );

  const monthLabel = useMemo(
    () =>
      monthCursor.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      }),
    [monthCursor]
  );

  const rangeForMonth = (date) => {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
    return { from: formatDateId(first), to: formatDateId(last) };
  };

  const fetchWorkdays = async () => {
    const { from, to } = rangeForMonth(monthCursor);
    try {
      setLoading(true);
      const data = await fetchWorkDaysRange({ from, to });
      setWorkdays(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(error?.message || "Gagal memuat data workday");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkdays();
  }, [monthParam]);

  const mapByKey = useMemo(() => {
    const m = new Map();
    for (const d of workdays) {
      const key = formatDateId(new Date(d.date));
      m.set(key, d);
    }
    return m;
  }, [workdays]);

  const cells = useMemo(() => {
    const firstDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
    const lastDay = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
    const startOffset = firstDay.getDay();
    const total = lastDay.getDate();
    const out = [];
    for (let i = 0; i < startOffset; i++) out.push(null);
    for (let d = 1; d <= total; d++) {
      const date = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), d);
      const key = formatDateId(date);
      out.push({ key, jsDate: date, doc: mapByKey.get(key) || null });
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [monthCursor, mapByKey]);

  const onSave = async () => {
    if (!selected) return;
    const body = {
      is_override: true,
      is_working_day: !!selected.is_working_day,
      is_holiday: !!selected.is_holiday,
      holiday_name: selected.holiday_name || "",
    };
    try {
      setSaving(true);
      await upsertWorkDay(selected.key, body);
      await fetchWorkdays();
      toast.success(`WorkDay ${selected.key} berhasil disimpan`);
      setSelected(null);
    } catch (error) {
      toast.error(error?.message || "Gagal menyimpan workday");
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
    <>
    <Toaster position="top-center" />
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-md font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Pengaturan Hari Kerja (Per Tanggal)
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-slate-100 text-sm min-w-40 text-center">{monthLabel}</span>
              <button
                onClick={() => setMonthCursor((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                className="p-2 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={async () => {
                  try {
                    const range = getMonthRangeFromYYYYMM(seedTargetMonth);
                    if (!range) {
                      toast.error("Format bulan tidak valid");
                      return;
                    }
                    const res = await seedWorkDays({ from: range.from, to: range.to });
                    if (res?.existing > 0 && res?.created === 0) {
                      toast("Data WorkDay untuk bulan terpilih sudah ada semua.");
                    } else if (res?.existing > 0) {
                      toast.success(`Seed selesai. Dibuat: ${res.created}, sudah ada: ${res.existing}`);
                    } else {
                      toast.success(`Seed bulan ${seedTargetMonth} berhasil: ${res?.created || 0} data dibuat`);
                    }
                    await fetchWorkdays();
                  } catch (error) {
                    toast.error(error?.message || "Gagal seed WorkDay bulan dipilih");
                  }
                }}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs"
              >
                Seed Bulan Dipilih
              </button>
              <button
                onClick={async () => {
                  try {
                    const nextStart = new Date();
                    nextStart.setMonth(nextStart.getMonth() + 1, 1);
                    const nextEnd = new Date(nextStart.getFullYear(), nextStart.getMonth() + 1, 0);
                    const res = await seedWorkDays({
                      from: formatDateId(nextStart),
                      to: formatDateId(nextEnd),
                    });
                    if (res?.existing > 0 && res?.created === 0) {
                      toast("Data WorkDay bulan depan sudah ada semua.");
                    } else if (res?.existing > 0) {
                      toast.success(`Seed bulan depan selesai. Dibuat: ${res.created}, sudah ada: ${res.existing}`);
                    } else {
                      toast.success(`Seed bulan depan berhasil: ${res?.created || 0} data dibuat`);
                    }
                    await fetchWorkdays();
                  } catch (error) {
                    toast.error(error?.message || "Gagal seed WorkDay bulan depan");
                  }
                }}
                className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs"
              >
                Seed Bulan Depan
              </button>
              <input
                type="month"
                value={seedTargetMonth}
                onChange={(e) => setSeedTargetMonth(e.target.value)}
                className="px-2 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs border border-slate-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((name) => (
              <div key={name} className="text-center text-xs text-slate-500 py-1">{name}</div>
            ))}
          </div>

          {loading ? (
            <div className="text-slate-400 text-sm py-8">Memuat...</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {cells.map((cell, idx) =>
                cell ? (
                  <button
                    key={cell.key}
                    onClick={() => {
                      const base = cell.doc || { is_working_day: cell.jsDate.getDay() !== 0, is_holiday: cell.jsDate.getDay() === 0, holiday_name: "", is_override: false };
                      setSelected({ key: cell.key, ...base });
                    }}
                    className={`h-20 rounded-xl border p-2 text-left transition ${
                      cell.doc
                        ? cell.doc.is_holiday
                          ? "bg-red-500/20 border-red-500/40 text-red-300"
                          : cell.doc.is_working_day
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                          : "bg-slate-900 border-slate-700 text-slate-500"
                        : cell.jsDate.getDay() === 0
                        ? "bg-slate-900 border-slate-700 text-slate-500"
                        : "bg-slate-800 border-slate-700 text-slate-300"
                    }`}
                  >
                    <div className="text-xs font-semibold">{Number(cell.key.slice(-2))}</div>
                    <div className="text-[10px] mt-1">
                      {cell.doc
                        ? cell.doc.is_working_day
                          ? "Kerja"
                          : cell.doc.is_holiday
                          ? (cell.doc.holiday_name || "Libur")
                          : "Libur"
                        : cell.jsDate.getDay() === 0
                        ? "Libur"
                        : "Kerja"}
                    </div>
                  </button>
                ) : (
                  <div key={`empty-${idx}`} className="h-20 rounded-xl bg-transparent" />
                )
              )}
            </div>
          )}
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
          <h3 className="text-white font-semibold mb-3">Edit Tanggal</h3>
          {!selected ? (
            <div className="text-sm text-slate-400">Pilih tanggal pada kalender di kiri.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-500">{selected.key}</div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                <div className="text-sm text-slate-200">Hari Kerja</div>
                <input
                  type="checkbox"
                  checked={!!selected.is_working_day}
                  onChange={(e) => setSelected((s) => ({ ...s, is_working_day: e.target.checked, ...(e.target.checked ? { is_holiday: false } : {}) }))}
                />
              </div>

              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700">
                <label className="text-sm text-slate-200 flex items-center justify-between mb-2">
                  <span>Libur</span>
                  <input
                    type="checkbox"
                    checked={!!selected.is_holiday}
                    onChange={(e) => setSelected((s) => ({ ...s, is_holiday: e.target.checked, ...(e.target.checked ? { is_working_day: false } : {}) }))}
                  />
                </label>
                <input
                  type="text"
                  placeholder="Nama libur (opsional)"
                  value={selected.holiday_name || ""}
                  onChange={(e) => setSelected((s) => ({ ...s, holiday_name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-800/60 border border-slate-700 rounded-xl text-sm text-white"
                />
                <p className="text-[11px] text-slate-500 mt-2">
                  Perubahan hanya berdampak ke presensi mendatang. Data yang sudah lewat tidak berubah.
                </p>
              </div>

              <button
                onClick={onSave}
                disabled={saving}
                className="w-full px-3 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                Simpan Perubahan
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

