import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar,
  Clock,
  ListChecks,
  Activity,
  Target,
  BadgeCheck,
} from "lucide-react";
import { getAttendanceByDate, getMyAttendanceCalendar } from "../utils/api.jsx";

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const formatDateId = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const normalizeAbsenceType = (t) => String(t || "").toLowerCase();
const getAbsenceLabel = (absenceType) => {
  const t = normalizeAbsenceType(absenceType);
  if (t === "sick") return "Sakit";
  if (t === "leave") return "Cuti";
  if (t === "permission") return "Izin";
  return "Izin";
};

export default function MyAttendanceHistory() {
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [loading, setLoading] = useState(false);
  const [calendarData, setCalendarData] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDetail, setSelectedDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [selectedMeta, setSelectedMeta] = useState(null);

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

  const fetchCalendar = async () => {
    try {
      setLoading(true);
      const res = await getMyAttendanceCalendar({ month: monthParam });
      const payload = res?.data || {};
      setCalendarData(payload.days || []);
      const today = new Date();
      const isSameMonth =
        today.getFullYear() === monthCursor.getFullYear() &&
        today.getMonth() === monthCursor.getMonth();
      const todayKey = formatDateId(today);
      const defaultDate = isSameMonth
        ? todayKey
        : formatDateId(new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1));
      setSelectedDate(defaultDate);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCalendar();
  }, [monthParam]);

  useEffect(() => {
    if (!selectedDate) return;
    const fetchDetail = async () => {
      try {
        setLoadingDetail(true);
        const res = await getAttendanceByDate(selectedDate);
        setSelectedDetail(res?.data || null);
      } finally {
        setLoadingDetail(false);
      }
    };
    fetchDetail();
  }, [selectedDate]);

  const dayMap = useMemo(() => {
    const m = new Map();
    for (const d of calendarData) m.set(d.date, d);
    return m;
  }, [calendarData]);

  useEffect(() => {
    if (!selectedDate) return;
    setSelectedMeta(dayMap.get(selectedDate) || null);
  }, [selectedDate, dayMap]);

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
      out.push(
        dayMap.get(key) || {
          date: key,
          hasAttendance: false,
          is_working_day: false,
          is_holiday: false,
          holiday_name: "",
          has_workday_config: false,
        }
      );
    }
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [monthCursor, dayMap]);

  const statusClass = (status, hasAttendance, isWorkingDay, isHoliday, absenceType) => {
    if (!hasAttendance) {
      // Semua hari non-aktif/libur (termasuk Minggu) tampilkan warna yang sama,
      // supaya tidak berubah menjadi merah saat `holiday_name` ada.
      if (!isWorkingDay) return "bg-slate-900 border-slate-700 text-slate-300";
      return "bg-slate-800 border-slate-700 text-slate-400";
    }
    if (status === "normal") return "bg-emerald-500/20 border-emerald-500/40 text-emerald-300";
    if (status === "late_checkin" || status === "early_checkout") return "bg-yellow-500/20 border-yellow-500/40 text-yellow-300";
    if (status === "late") return "bg-red-500/20 border-red-500/40 text-red-300";
    // manual = bisa dari absence (izin/cuti/sakit) atau manual biasa
    if (status === "manual") {
      const t = normalizeAbsenceType(absenceType);
      if (t && t !== "none") {
        if (t === "sick") return "bg-rose-500/20 border-rose-500/40 text-rose-300";
        if (t === "leave") return "bg-orange-500/20 border-orange-500/40 text-orange-300";
        if (t === "permission") return "bg-indigo-500/20 border-indigo-500/40 text-indigo-300";
        return "bg-indigo-500/20 border-indigo-500/40 text-indigo-300";
      }
      return "bg-blue-500/20 border-blue-500/40 text-blue-300";
    }
    if (status === "forget") return "bg-purple-500/20 border-purple-500/40 text-purple-300";
    return "bg-slate-800 border-slate-700 text-slate-300";
  };

  const getCalendarCellLabel = (cell) => {
    if (!cell?.hasAttendance) {
      if (cell?.has_workday_config === false) return "Belum diset HR";
      if (cell?.is_holiday) return cell?.holiday_name || "Libur";
      return cell?.is_working_day === false ? "Libur" : "Belum";
    }

    const status = cell?.status;
    const absenceType = normalizeAbsenceType(cell?.absence_type);
    if (status === "manual" && absenceType && absenceType !== "none") {
      return getAbsenceLabel(absenceType);
    }
    if (status === "normal") return "Hadir";
    if (status === "late") return "Terlambat";
    if (status === "late_checkin") return "Terlambat masuk";
    if (status === "early_checkout") return "Pulang cepat";
    if (status === "manual") return "Otomatis";
    if (status === "forget") return "Lupa";
    return "Belum";
  };

  const stats = useMemo(() => {
    const workingDays = calendarData.filter((d) => d.is_working_day !== false);
    const attendedWorkingDays = workingDays.filter((d) => d.hasAttendance);
    const libur = calendarData.filter((d) => d.is_holiday || d.is_working_day === false).length;

    const terlambat = attendedWorkingDays.filter(
      (d) => d.status === "late" || d.status === "late_checkin"
    ).length;

    const izin = attendedWorkingDays.filter((d) => {
      const absenceType = normalizeAbsenceType(d?.absence_type);
      return d?.status === "manual" && absenceType && absenceType !== "none";
    }).length;

    const hadir = attendedWorkingDays.length - izin;
    const totalAttendance = calendarData.filter((d) => d.hasAttendance).length;

    return { hadir, terlambat, libur, izin, totalAttendance };
  }, [calendarData]);

  const projectsGroupedFromTasks = useMemo(() => {
    const tasks = Array.isArray(selectedDetail?.tasks_today) ? selectedDetail.tasks_today : [];
    if (!tasks.length) return [];

    const projectMap = new Map();
    for (const t of tasks) {
      const pid =
        t?.project_id?._id?.toString?.() ||
        t?.project_id?._id ||
        t?.project_id?.toString?.() ||
        t?.project_id ||
        "no-project";

      const projLabel =
        t?.project_id?.name ||
        t?.project_id?.code ||
        (pid === "no-project" ? "Tanpa Proyek" : "Proyek");

      if (!projectMap.has(pid)) projectMap.set(pid, { pid, projLabel, tasks: [] });
      projectMap.get(pid).tasks.push({
        tid: t?._id?.toString?.() || t?._id || `${projLabel}-${t?.title || "task"}-${Math.random()}`,
        title: t?.title || "-",
        status: t?.status || "ongoing",
      });
    }

    // Stabil: urutkan project by label, dan task sesuai urutan array input
    return Array.from(projectMap.values()).sort((a, b) => String(a.projLabel).localeCompare(String(b.projLabel)));
  }, [selectedDetail]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/80 border border-slate-800 rounded-3xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white text-xl font-semibold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-400" />
              Riwayat Presensi Saya
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
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 flex-wrap mb-4">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="text-[11px] text-slate-400">Hadir</div>
                <div className="text-white text-lg font-semibold">{stats.hadir}</div>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="text-[11px] text-slate-400">Terlambat</div>
                <div className="text-white text-lg font-semibold">{stats.terlambat}</div>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="text-[11px] text-slate-400">Libur</div>
                <div className="text-white text-lg font-semibold">{stats.libur}</div>
              </div>
              <div className="px-3 py-2 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="text-[11px] text-slate-400">Izin</div>
                <div className="text-white text-lg font-semibold">{stats.izin}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap justify-end">
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500/40 border border-emerald-500/40" />
                Normal
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500/30 border border-yellow-500/40" />
                Terlambat masuk / Pulang cepat
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500/30 border border-red-500/40" />
                Terlambat
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500/30 border border-blue-500/40" />
                Manual
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500/30 border border-indigo-500/40" />
                Izin
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500/30 border border-orange-500/40" />
                Cuti
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500/30 border border-rose-500/40" />
                Sakit
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500/30 border border-purple-500/40" />
                Lupa
              </div>
              <div className="text-xs text-slate-300 flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-700" />
                  Libur (Minggu/Non-Working)
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-2 mb-2">
            {dayNames.map((name) => (
              <div key={name} className="text-center text-xs text-slate-500 py-1">{name}</div>
            ))}
          </div>
          {loading ? (
            <div className="text-slate-400 text-sm py-8">Memuat kalender...</div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {cells.map((cell, idx) =>
                cell ? (
                  <button
                    key={cell.date}
                    onClick={() => setSelectedDate(cell.date)}
                    className={`h-20 rounded-xl border p-2 text-left transition ${
                      statusClass(cell.status, cell.hasAttendance, cell.is_working_day !== false, cell.is_holiday, cell.absence_type)
                    } ${selectedDate === cell.date ? "ring-2 ring-blue-500" : ""}`}
                  >
                    <div className="text-xs font-semibold">{Number(cell.date.slice(-2))}</div>
                    <div className="text-[10px] mt-1">
                      {getCalendarCellLabel(cell)}
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
          <h3 className="text-white font-semibold mb-3">Detail Tanggal</h3>
          <p className="text-xs text-slate-500 mb-4">{selectedDate || "-"}</p>
          {loadingDetail ? (
            <div className="text-sm text-slate-400">Memuat detail...</div>
          ) : !selectedDetail ? (
            (() => {
              const hasWorkDayConfig = selectedMeta?.has_workday_config ?? false;
              const isHoliday = selectedMeta?.is_holiday ?? false;
              const isWorkingDay = selectedMeta?.is_working_day !== false;
              const holidayName = selectedMeta?.holiday_name || "Libur";

              if (!hasWorkDayConfig) {
                return <div className="text-sm text-slate-400">Tanggal belum diset HR (work day config).</div>;
              }

              if (isHoliday || !isWorkingDay) {
                return <div className="text-sm text-slate-400">Hari libur: {holidayName}</div>;
              }

              return <div className="text-sm text-slate-400">Tidak ada presensi pada tanggal ini.</div>;
            })()
          ) : (
            <div className="space-y-3 text-sm">
              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700 flex items-start justify-between gap-3">
                <div>
                  <div className="text-slate-300 text-xs">Status</div>
                  <div className="text-white font-semibold mt-1">
                    {selectedDetail.status === "manual" &&
                    normalizeAbsenceType(selectedDetail.absence_type) &&
                    normalizeAbsenceType(selectedDetail.absence_type) !== "none"
                      ? getAbsenceLabel(selectedDetail.absence_type)
                      : (selectedDetail.status || "-")}
                  </div>
                  {selectedDetail.absence_type && (
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        selectedDetail.absence_type === "sick"
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : selectedDetail.absence_type === "leave"
                          ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                          : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                      }`}>
                        {selectedDetail.absence_type.toUpperCase()}
                      </span>
                      <span className="text-xs text-slate-400">
                        (Presensi dibuat dari pengajuan {selectedDetail.absence_type === "sick" ? "Sakit" : selectedDetail.absence_type === "leave" ? "Cuti" : selectedDetail.absence_type === "permission" ? "Izin" : selectedDetail.status === "forget" ? "Lupa Presensi" : "normal"})
                      </span>
                    </div>
                  )}
                  {selectedDetail.late_reason && (
                    <div className="text-xs text-slate-300 mt-2">
                      Alasan terlambat: {selectedDetail.late_reason}
                    </div>
                  )}
                </div>
                {selectedDetail.approved_at ? (
                  <div className="text-xs text-slate-300 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <BadgeCheck className="w-4 h-4 text-emerald-300" />
                      Disetujui
                    </div>
                    <div className="mt-1">
                      {new Date(selectedDetail.approved_at).toLocaleDateString("id-ID")}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                <div className="text-slate-300 flex items-center gap-2"><Clock className="w-4 h-4" /> Check-in</div>
                <div className="text-white mt-1">{new Date(selectedDetail.checkIn_at).toLocaleString("id-ID")}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                <div className="text-slate-300 flex items-center gap-2"><Clock className="w-4 h-4" /> Check-out</div>
                <div className="text-white mt-1">
                  {selectedDetail.checkOut_at
                    ? new Date(selectedDetail.checkOut_at).toLocaleString("id-ID")
                    : "-"}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                <div className="text-slate-300 flex items-center gap-2">
                  <Target className="w-4 h-4" /> Proyek & Task
                </div>
                <div className="mt-2 space-y-2">
                  {projectsGroupedFromTasks.length === 0 ? (
                    <div className="text-slate-400 text-xs">Tidak ada task</div>
                  ) : (
                    projectsGroupedFromTasks.map((proj) => (
                      <div key={proj.pid} className="space-y-1">
                        <div className="text-white text-xs font-semibold">{proj.projLabel}</div>
                        <div className="space-y-1">
                          {proj.tasks.map((t) => (
                            <div key={t.tid} className="text-xs text-slate-200 ml-4">
                              - {t.title} ({t.status})
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                <div className="text-slate-300 flex items-center gap-2"><Activity className="w-4 h-4" /> Aktivitas</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(selectedDetail.activities || []).length === 0 ? (
                    <div className="text-slate-400 text-xs">Tidak ada aktivitas</div>
                  ) : (
                    (selectedDetail.activities || []).map((a) => (
                      <span
                        key={a._id || a}
                        className="px-3 py-1.5 bg-blue-500/15 text-blue-300 border border-blue-500/25 rounded-full text-xs font-medium"
                      >
                        {a.name_activity || a.name || a}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {selectedDetail.note ? (
                <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700">
                  <div className="text-slate-300 mb-1">Catatan</div>
                  <div className="text-slate-100 whitespace-pre-wrap text-xs">{selectedDetail.note}</div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

