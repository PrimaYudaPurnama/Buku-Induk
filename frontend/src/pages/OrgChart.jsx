import React, { useEffect, useState } from "react";
import { Building2, UserCircle2, Sparkles, Users } from "lucide-react";
import { fetchOrgChart } from "../utils/api.jsx";

const Avatar = ({ name, photoUrl }) => {
  const initials =
    name && name.trim().length > 0
      ? name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .slice(0, 2)
          .toUpperCase()
      : "?";

  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="w-16 h-16 rounded-full object-cover border-4 border-slate-900 shadow-lg"
      />
    );
  }

  return (
    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-xl font-bold shadow-lg">
      {initials}
    </div>
  );
};

const PersonCard = ({ person, badge }) => {
  if (!person) return null;

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar name={person.full_name} photoUrl={person.profile_photo_url} />
      <div className="text-center">
        <p className="text-base font-semibold text-white">{person.full_name}</p>
        {person.role?.name && (
          <p className="text-sm text-slate-400">{person.role.name}</p>
        )}
        {badge && (
          <span className="mt-2 inline-flex items-center rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-1.5 text-xs font-medium text-white shadow-md">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};

const DivisionSection = ({ division }) => {
  const levels = Object.keys(division.members_by_role_level || {})
    .map((k) => parseInt(k, 10))
    .sort((a, b) => a - b);

  return (
    <section className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-8 space-y-8">
      {/* Header */}
      <header className="flex items-center gap-5">
        <div className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl flex items-center justify-center shadow-lg">
          <Building2 className="w-8 h-8 text-white" />
        </div>
        <div>
          <h3 className="text-2xl font-bold text-white flex items-center gap-3">
            {division.name}
            <Sparkles className="w-5 h-5 text-blue-400" />
          </h3>
          {division.description && (
            <p className="text-base text-slate-300 mt-2">{division.description}</p>
          )}
        </div>
      </header>

      {/* Manager + Active General */}
      <div className="flex flex-col items-center gap-6">
        <PersonCard person={division.manager} badge="Manager Divisi" />
        {division.active_general && (
          <>
            <div className="w-1 h-16 bg-gradient-to-b from-blue-500 to-indigo-600 rounded-full shadow-md" />
            <PersonCard person={division.active_general} badge="Penanggung Jawab Harian" />
          </>
        )}
      </div>

      {/* Connector to members */}
      {(levels.length > 0 || division.members.length > 0) && (
        <div className="flex flex-col items-center">
          <div className="w-1 h-10 bg-gradient-to-b from-indigo-600 to-transparent" />
          <div className="h-1 w-24 bg-gradient-to-r from-transparent via-blue-600 to-transparent" />
        </div>
      )}

      {/* Members by role level */}
      {levels.length > 0 && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {levels.map((lvl) => {
            const key = String(lvl);
            const members = division.members_by_role_level[key] || [];
            if (!members.length) return null;

            const roleName = members[0]?.role?.name || "Posisi";

            return (
              <div
                key={key}
                className="bg-slate-800/70 backdrop-blur-sm rounded-2xl p-6 border border-slate-700/50"
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-md">
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="text-xl font-semibold text-white">{roleName}</h4>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {members.map((m) => (
                    <PersonCard key={m._id} person={m} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {!levels.length && division.members.length === 0 && (
        <p className="text-center text-slate-400 text-base italic">
          Belum ada anggota yang terdaftar dalam divisi ini.
        </p>
      )}
    </section>
  );
};

export default function OrgChart() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetchOrgChart();
        setData(res.data);
      } catch (e) {
        console.error("fetchOrgChart error:", e);
        setError(e.message || "Gagal memuat silsilah perusahaan");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const unassigned = data?.unassigned_users || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 p-6 relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center justify-center gap-6">
            <Building2 className="w-12 h-12 text-indigo-400" />
            Silsilah Perusahaan
          </h1>
          <p className="text-xl text-slate-300 mt-4 flex items-center justify-center gap-3">
            <Sparkles className="w-5 h-5" />
            Visualisasi struktur organisasi secara hierarkis
          </p>
        </div>

        {/* Legend */}
        <div className="bg-slate-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-blue-900/50 p-6 mb-10 flex items-center justify-center gap-6">
          <div className="flex items-center gap-3">
            <UserCircle2 className="w-8 h-8 text-blue-400" />
            <div className="text-slate-300">
              <p className="font-medium">Legend</p>
              <p className="text-sm">Foto profil = avatar, badge = jabatan khusus</p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="space-y-8">
            {[1, 2, 3].map((i) => (
              <div 
                key={i}
                className="h-64 rounded-3xl bg-slate-800/50 backdrop-blur-sm animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-20">
            <AlertCircle className="w-20 h-20 text-red-400 mx-auto mb-6" />
            <p className="text-2xl text-red-400">{error}</p>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-12">
            {data.divisions.map((division) => (
              <DivisionSection key={division._id} division={division} />
            ))}

            {unassigned.length > 0 && (
              <section className="bg-gradient-to-br from-amber-900/30 to-orange-900/30 backdrop-blur-xl rounded-3xl shadow-2xl border border-amber-700/40 p-8 space-y-6">
                <header className="flex items-center gap-5">
                  <div className="w-14 h-14 bg-gradient-to-br from-amber-600 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                    <Users className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-white">
                      Karyawan Tanpa Divisi
                    </h3>
                    <p className="text-base text-amber-300 mt-2">
                      {unassigned.length} karyawan belum ditugaskan
                    </p>
                  </div>
                </header>

                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                  {unassigned.map((u) => (
                    <PersonCard key={u._id} person={u} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}