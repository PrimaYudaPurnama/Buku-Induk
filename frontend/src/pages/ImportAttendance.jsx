import { useState, useEffect, useCallback } from "react";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";

// ─────────────────────────────────────────────────────────────────────────────
// Data fetching hook
// ─────────────────────────────────────────────────────────────────────────────
function useAttendanceAnalytics({ startDate, endDate } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (startDate) params.set("start", startDate);
      if (endDate) params.set("end", endDate);

      const res = await fetch(`${API_BASE}/import/attendance?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetch_();
  }, [fetch_]);

  return { data, loading, error, refetch: fetch_ };
}

// ─────────────────────────────────────────────────────────────────────────────
// Import widget
// ─────────────────────────────────────────────────────────────────────────────
function ImportWidget({ onSuccess }) {
  const [status, setStatus] = useState(null); // null | "uploading" | result object
  const [file, setFile] = useState(null);

  async function handleImport() {
    if (!file) return;
    setStatus("uploading");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/import/attendance`, {
        method: "POST",
        body: form,
      });
      const result = await res.json();
      setStatus(result);
      if (result.success_rows > 0) onSuccess?.();
    } catch (err) {
      setStatus({ error: err.message });
    }
  }

  return (
    <div className="import-widget" style={styles.card}>
      <h3 style={{ margin: "0 0 12px" }}>Import Attendance (Excel)</h3>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setFile(e.target.files[0] ?? null)}
        />
        <button
          onClick={handleImport}
          disabled={!file || status === "uploading"}
          style={styles.button}
        >
          {status === "uploading" ? "Uploading…" : "Import"}
        </button>
      </div>

      {status && status !== "uploading" && (
        <div style={{ marginTop: 12, fontSize: 14 }}>
          {status.error ? (
            <span style={{ color: "crimson" }}>Error: {status.error}</span>
          ) : (
            <>
              <span style={{ color: "green" }}>✓ {status.success_rows} rows imported</span>
              {status.failed_rows > 0 && (
                <details style={{ marginTop: 6 }}>
                  <summary style={{ color: "orange", cursor: "pointer" }}>
                    {status.failed_rows} rows failed
                  </summary>
                  <ul style={{ fontSize: 12, marginTop: 4 }}>
                    {status.errors.map((e, i) => (
                      <li key={i}>
                        Row {e.rowNumber}: {e.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Stat card
// ─────────────────────────────────────────────────────────────────────────────
function StatCard({ label, value }) {
  return (
    <div style={styles.statCard}>
      <div style={{ fontSize: 28, fontWeight: 700 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 13, color: "#666", marginTop: 4 }}>{label}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Simple bar chart (no external dependency)
// ─────────────────────────────────────────────────────────────────────────────
function BarChart({ data, labelKey, valueKey, title }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d[valueKey]));

  return (
    <div style={styles.card}>
      <h4 style={{ margin: "0 0 12px" }}>{title}</h4>
      {data.map((d) => (
        <div key={d[labelKey]} style={{ marginBottom: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span>{d[labelKey]}</span>
            <span>{d[valueKey]}</span>
          </div>
          <div style={{ background: "#eee", borderRadius: 4, height: 8, marginTop: 3 }}>
            <div
              style={{
                width: `${(d[valueKey] / max) * 100}%`,
                background: "#4f46e5",
                borderRadius: 4,
                height: "100%",
                transition: "width 0.4s",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────
export default function AttendanceAnalytics() {
  const [dateRange, setDateRange] = useState({ startDate: "", endDate: "" });
  const { data, loading, error, refetch } = useAttendanceAnalytics(dateRange);

  return (
    <div style={styles.page}>
      <h2 style={{ marginBottom: 20 }}>Attendance Analytics</h2>

      {/* Import widget – after successful import, auto-refetch analytics */}
      <ImportWidget onSuccess={refetch} />

      {/* Date filters */}
      <div style={{ ...styles.card, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <label style={styles.label}>
          From
          <input
            type="date"
            value={dateRange.startDate}
            onChange={(e) => setDateRange((p) => ({ ...p, startDate: e.target.value }))}
            style={styles.input}
          />
        </label>
        <label style={styles.label}>
          To
          <input
            type="date"
            value={dateRange.endDate}
            onChange={(e) => setDateRange((p) => ({ ...p, endDate: e.target.value }))}
            style={styles.input}
          />
        </label>
        <button onClick={refetch} style={styles.button}>
          Apply
        </button>
      </div>

      {/* Content */}
      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error}</p>}

      {data && (
        <>
          {/* Summary stats */}
          <div style={styles.statRow}>
            <StatCard label="Total Attendance" value={data.total_attendance} />
            <StatCard label="Unique Employees" value={data.unique_employees} />
            <StatCard label="Late Check-ins" value={data.late_count} />
            <StatCard label="Manual Records" value={data.manual_count} />
          </div>

          {/* Activity frequency */}
          <BarChart
            title="Activity Frequency"
            data={data.activity_frequency}   // [{ name, count }]
            labelKey="name"
            valueKey="count"
          />

          {/* Project contribution */}
          <BarChart
            title="Project Contribution (avg %)"
            data={data.project_contributions} // [{ name, avg_pct }]
            labelKey="name"
            valueKey="avg_pct"
          />
        </>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Inline styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = {
  page: { maxWidth: 900, margin: "0 auto", padding: "24px 16px", fontFamily: "sans-serif" },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, marginBottom: 16 },
  statCard: {
    background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8,
    padding: "16px 24px", textAlign: "center", flex: "1 1 140px",
  },
  statRow: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 },
  button: {
    padding: "8px 16px", background: "#4f46e5", color: "#fff",
    border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600,
  },
  label: { display: "flex", flexDirection: "column", fontSize: 13, fontWeight: 600, gap: 4 },
  input: { padding: "6px 8px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13 },
};