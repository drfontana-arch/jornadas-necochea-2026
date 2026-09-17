"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Check, RefreshCw } from "lucide-react";
import Card from "../../../components/Card";

const DAYS = ["2026-10-09", "2026-10-10", "2026-10-11"];
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

function ReprogramarControl({ match, onSaved }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(match.day);
  const [time, setTime] = useState(match.time);
  const [court, setCourt] = useState(match.court);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs bg-[#163A67] border border-[#2A4E85] px-2.5 py-1.5 rounded-lg hover:bg-[#0C2043]">
        <RefreshCw className="w-3.5 h-3.5" /> Reprogramar este partido
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs" value={day} onChange={(e) => setDay(e.target.value)}>
        {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
      </select>
      <input type="time" className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs" value={time} onChange={(e) => setTime(e.target.value)} />
      <input type="number" min={1} className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs w-16" value={court} onChange={(e) => setCourt(Number(e.target.value))} />
      <button
        onClick={async () => {
          await fetch(`/api/matches/${match.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ day, time, court }),
          });
          setOpen(false);
          onSaved();
        }}
        className="text-xs bg-[#C9A227] text-[#0C2043] px-2.5 py-1.5 rounded-lg"
      >
        Guardar
      </button>
    </div>
  );
}

export default function CalendarioPage() {
  const [matches, setMatches] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [ignored, setIgnored] = useState({});
  const [departamentales, setDepartamentales] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3600); }

  async function load() {
    const [mRes, depRes] = await Promise.all([fetch("/api/matches?withConflicts=1"), fetch("/api/departamentales")]);
    const mData = await mRes.json();
    const depData = await depRes.json();
    setMatches(mData.matches || []);
    setConflicts(mData.conflicts || []);
    setDepartamentales(depData.departamentales || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function autoResolve(c) {
    const res = await fetch(`/api/matches/${c.m2.id}/autoresolver`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "No se pudo autoresolver."); return; }
    showToast(`Partido reprogramado automáticamente a ${DAY_LABEL[data.slot.day] || data.slot.day} ${data.slot.time} (cancha ${data.slot.court}).`);
    load();
  }

  function baseDept(label) {
    if (!label) return label;
    return label.replace(/\s+\d+$/, "").trim();
  }

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;

  const visibleConflicts = conflicts.filter((c) => !ignored[c.pairId]);
  const sorted = matches
    .filter((m) => !filterDept || baseDept(m.teamA) === filterDept || baseDept(m.teamB) === filterDept)
    .sort((a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || ""));

  return (
    <div className="space-y-5">
      {visibleConflicts.length > 0 && (
        <Card className="p-5 border-[#E0684A]">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#E0684A]">
            <AlertTriangle className="w-5 h-5" /> Superposiciones horarias detectadas ({visibleConflicts.length})
          </h2>
          <div className="space-y-3">
            {visibleConflicts.map((c) => (
              <div key={c.pairId} className="border border-[#5C3A32] bg-[#3A241F] rounded-lg p-3 text-sm">
                <p className="font-semibold mb-1">{c.dept} juega en dos lugares a la vez:</p>
                <p className="font-mono text-xs mb-1">{c.m1.disciplineName} · {c.m1.categoryName} — {c.m1.teamA} vs {c.m1.teamB} — {DAY_LABEL[c.m1.day] || c.m1.day} {c.m1.time}</p>
                <p className="font-mono text-xs mb-2">{c.m2.disciplineName} · {c.m2.categoryName} — {c.m2.teamA} vs {c.m2.teamB} — {DAY_LABEL[c.m2.day] || c.m2.day} {c.m2.time}</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setIgnored((prev) => ({ ...prev, [c.pairId]: true }))} className="flex items-center gap-1 text-xs bg-[#163A67] border border-[#2A4E85] px-2.5 py-1.5 rounded-lg hover:bg-[#0C2043]">
                    <Check className="w-3.5 h-3.5" /> Seguir igual con el sorteo
                  </button>
                  <button onClick={() => autoResolve(c)} className="flex items-center gap-1 text-xs bg-[#C9A227] text-[#0C2043] px-2.5 py-1.5 rounded-lg hover:bg-[#A9841C]">
                    <RefreshCw className="w-3.5 h-3.5" /> Autoresolver (buscar horario libre)
                  </button>
                  <ReprogramarControl match={c.m2} onSaved={load} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-bold text-lg">Fixture general</h2>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">Todas las departamentales</option>
            {departamentales.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9FB0D0] border-b border-[#21426E]">
                <th className="py-2 pr-3">Día</th><th className="py-2 pr-3">Hora</th><th className="py-2 pr-3">Cancha</th>
                <th className="py-2 pr-3">Disciplina</th><th className="py-2 pr-3">Categoría</th><th className="py-2 pr-3">Etapa</th><th className="py-2 pr-3">Partido</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const inConflict = visibleConflicts.some((c) => c.m1.id === m.id || c.m2.id === m.id);
                return (
                  <tr key={m.id} className={`border-b border-[#12294C] ${inConflict ? "bg-[#3A241F]" : ""}`}>
                    <td className="py-1.5 pr-3 font-mono">{DAY_LABEL[m.day] || m.day}</td>
                    <td className="py-1.5 pr-3 font-mono">{m.time}</td>
                    <td className="py-1.5 pr-3">{m.court}</td>
                    <td className="py-1.5 pr-3">{m.disciplineName}</td>
                    <td className="py-1.5 pr-3">{m.categoryName}</td>
                    <td className="py-1.5 pr-3">{m.stage}</td>
                    <td className="py-1.5 pr-3">{m.teamA || "?"} vs {m.bye ? "BYE" : m.teamB || "?"}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-[#7A8FBE]">Todavía no hay partidos sorteados y programados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {toast && <div className="fixed bottom-5 right-5 bg-[#C9A227] text-[#0C2043] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">{toast}</div>}
    </div>
  );
}
