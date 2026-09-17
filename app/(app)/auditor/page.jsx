"use client";
import { useEffect, useState } from "react";
import {
  BarChart3, CheckCircle2, UserCheck, Siren, Plus, Trash2, RefreshCw,
} from "lucide-react";
import Card from "../../../components/Card";

const DAYS = ["2026-10-09", "2026-10-10", "2026-10-11"];
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };
const INCIDENT_TYPES = ["Reclamo deportivo", "Lesión / asistencia médica", "Logística / infraestructura", "Conducta / disciplinario", "Otro"];
const INCIDENT_STATES = ["Abierta", "En curso", "Resuelta"];

function estadoColor(estado) {
  if (estado === "Resuelta") return { bg: "#16261E", border: "#2E4A3A", text: "#4FAE72" };
  if (estado === "En curso") return { bg: "#2E2712", border: "#5C4A22", text: "#E0C15A" };
  return { bg: "#3A241F", border: "#5C3A32", text: "#E0684A" };
}

function StatCard({ label, value, sub, tone = "neutral" }) {
  const tones = { neutral: "text-[#C9A227]", good: "text-[#4FAE72]", warn: "text-[#E0C15A]", bad: "text-[#E0684A]" };
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-[#7A8FBE] mt-0.5">{sub}</p>}
    </Card>
  );
}

export default function AuditorPage() {
  const [sub, setSub] = useState("resumen");
  const [disciplines, setDisciplines] = useState([]);
  const [matches, setMatches] = useState([]);
  const [results, setResults] = useState({});
  const [attendance, setAttendance] = useState([]);
  const [departamentales, setDepartamentales] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [totalEquipos, setTotalEquipos] = useState(0);
  const [loading, setLoading] = useState(true);

  async function loadAll() {
    const [dRes, mRes, rRes, aRes, depRes, iRes, teRes] = await Promise.all([
      fetch("/api/disciplinas"), fetch("/api/matches"), fetch("/api/resultados"),
      fetch("/api/asistencia"), fetch("/api/departamentales"), fetch("/api/incidencias"),
      fetch("/api/team-entries"),
    ]);
    setDisciplines((await dRes.json()).disciplines || []);
    setMatches((await mRes.json()).matches || []);
    setResults((await rRes.json()).results || {});
    setAttendance((await aRes.json()).attendance || []);
    setDepartamentales((await depRes.json()).departamentales || []);
    setIncidents((await iRes.json()).incidents || []);
    setTotalEquipos((await teRes.json()).total || 0);
    setLoading(false);
  }
  useEffect(() => { loadAll(); }, []);

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;

  const totalCategoriasDefinidas = disciplines.reduce((acc, d) => acc + d.categories.length, 0);
  const categoriasConSorteo = disciplines.reduce((acc, d) => acc + d.categories.filter((c) => c.drawn).length, 0);
  const partidosJugados = matches.filter((m) => results[m.id]?.jugado).length;
  const partidosPendientes = matches.length - partidosJugados;
  const incidenciasAbiertas = incidents.filter((i) => i.estado !== "Resuelta").length;
  const asistenciaPorDia = DAYS.map((day) => {
    const presentes = attendance.filter((a) => a.day === day && a.presente).length;
    return { day, presentes, total: departamentales.length };
  });

  const SUBS = [
    { id: "resumen", label: "Resumen", icon: BarChart3 },
    { id: "resultados", label: "Resultados", icon: CheckCircle2 },
    { id: "asistencia", label: "Asistencia", icon: UserCheck },
    { id: "incidencias", label: "Incidencias", icon: Siren },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-5 border-b border-[#21426E]">
        {SUBS.map((s) => {
          const Icon = s.icon;
          const active = sub === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                active ? "bg-[#163A67] border border-b-0 border-[#21426E] text-[#C9A227]" : "text-[#9FB0D0] hover:text-[#C9A227]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
              {s.id === "incidencias" && incidenciasAbiertas > 0 && (
                <span className="ml-1 bg-[#E0684A] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">{incidenciasAbiertas}</span>
              )}
            </button>
          );
        })}
      </div>

      {sub === "resumen" && (
        <ResumenTab
          stats={{ totalCategoriasDefinidas, categoriasConSorteo, totalEquipos, partidosProgramados: matches.length, partidosJugados, partidosPendientes, incidenciasAbiertas, asistenciaPorDia }}
          matches={matches} results={results} disciplines={disciplines}
        />
      )}
      {sub === "resultados" && <ResultadosTab matches={matches} results={results} disciplines={disciplines} onSaved={loadAll} />}
      {sub === "asistencia" && <AsistenciaTab departamentales={departamentales} attendance={attendance} asistenciaPorDia={asistenciaPorDia} onSaved={loadAll} />}
      {sub === "incidencias" && <IncidenciasTab disciplines={disciplines} departamentales={departamentales} incidents={incidents} onSaved={loadAll} />}
    </div>
  );
}

function ResumenTab({ stats, matches, results, disciplines }) {
  const porDisciplina = disciplines.map((d) => {
    const ms = matches.filter((m) => m.disciplineId === d.id);
    const jugados = ms.filter((m) => results[m.id]?.jugado).length;
    return { id: d.id, name: d.name, programados: ms.length, jugados };
  }).filter((d) => d.programados > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Categorías sorteadas" value={`${stats.categoriasConSorteo}/${stats.totalCategoriasDefinidas}`} />
        <StatCard label="Equipos inscriptos" value={stats.totalEquipos} />
        <StatCard label="Partidos programados" value={stats.partidosProgramados} />
        <StatCard label="Partidos jugados" value={stats.partidosJugados} tone="good" sub={`${stats.partidosPendientes} pendientes`} />
        <StatCard label="Incidencias abiertas" value={stats.incidenciasAbiertas} tone={stats.incidenciasAbiertas > 0 ? "bad" : "good"} />
      </div>
      <Card className="p-5">
        <h3 className="font-bold mb-3">Asistencia general por día</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {stats.asistenciaPorDia.map((a) => (
            <div key={a.day} className="border border-[#21426E] rounded-lg p-3">
              <p className="text-sm font-semibold">{DAY_LABEL[a.day]}</p>
              <p className="text-xl font-bold text-[#C9A227]">{a.presentes}/{a.total}</p>
              <p className="text-xs text-[#7A8FBE]">departamentales presentes</p>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-5">
        <h3 className="font-bold mb-3">Avance por disciplina</h3>
        {porDisciplina.length === 0 ? (
          <p className="text-sm text-[#7A8FBE]">Todavía no hay partidos programados en ninguna disciplina.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9FB0D0] border-b border-[#21426E]">
                <th className="py-2 pr-3">Disciplina</th><th className="py-2 pr-3">Programados</th><th className="py-2 pr-3">Jugados</th><th className="py-2 pr-3">Avance</th>
              </tr>
            </thead>
            <tbody>
              {porDisciplina.map((d) => (
                <tr key={d.id} className="border-b border-[#12294C]">
                  <td className="py-1.5 pr-3 font-medium">{d.name}</td>
                  <td className="py-1.5 pr-3">{d.programados}</td>
                  <td className="py-1.5 pr-3">{d.jugados}</td>
                  <td className="py-1.5 pr-3 w-40">
                    <div className="h-2 bg-[#12294C] rounded-full overflow-hidden">
                      <div className="h-2 bg-[#C9A227]" style={{ width: `${d.programados ? Math.round((d.jugados / d.programados) * 100) : 0}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function ResultadosTab({ matches, results, disciplines, onSaved }) {
  const [filterDay, setFilterDay] = useState("");
  const [filterDisc, setFilterDisc] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  async function save(matchId, patch) {
    await fetch(`/api/resultados/${matchId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    onSaved();
  }

  const rows = matches
    .filter((m) => !filterDay || m.day === filterDay)
    .filter((m) => !filterDisc || m.disciplineId === filterDisc)
    .filter((m) => !onlyPending || !results[m.id]?.jugado)
    .sort((a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || ""));

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Día</label>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
            <option value="">Todos</option>
            {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Disciplina</label>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDisc} onChange={(e) => setFilterDisc(e.target.value)}>
            <option value="">Todas</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#C9A227] mb-1.5">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} /> Solo pendientes de carga
        </label>
      </Card>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9FB0D0] border-b border-[#21426E] bg-[#1E4478]">
                <th className="py-2 px-3">Día / hora</th><th className="py-2 px-3">Disciplina</th><th className="py-2 px-3">Categoría</th>
                <th className="py-2 px-3">Partido</th><th className="py-2 px-3">Jugado</th><th className="py-2 px-3">Resultado</th>
                <th className="py-2 px-3">Ganador</th><th className="py-2 px-3">Hora real</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const r = results[m.id] || {};
                return (
                  <tr key={m.id} className={`border-b border-[#12294C] ${r.jugado ? "bg-[#15261C]" : ""}`}>
                    <td className="py-1.5 px-3 font-mono text-xs whitespace-nowrap">{DAY_LABEL[m.day] || m.day} {m.time}</td>
                    <td className="py-1.5 px-3">{m.disciplineName}</td>
                    <td className="py-1.5 px-3">{m.categoryName}</td>
                    <td className="py-1.5 px-3">{m.teamA || "?"} vs {m.teamB || "?"}</td>
                    <td className="py-1.5 px-3">
                      <input type="checkbox" checked={!!r.jugado} onChange={(e) => save(m.id, { jugado: e.target.checked })} />
                    </td>
                    <td className="py-1.5 px-3">
                      <input type="text" placeholder="ej. 3-1" defaultValue={r.resultado || ""} onBlur={(e) => save(m.id, { resultado: e.target.value })}
                        className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs w-20" />
                    </td>
                    <td className="py-1.5 px-3">
                      <select defaultValue={r.ganador || ""} onChange={(e) => save(m.id, { ganador: e.target.value })} className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs">
                        <option value="">—</option>
                        {m.teamA && <option value={m.teamA}>{m.teamA}</option>}
                        {m.teamB && <option value={m.teamB}>{m.teamB}</option>}
                        <option value="Empate">Empate</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1">
                        <input type="time" defaultValue={r.hora_inicio_real || ""} onBlur={(e) => save(m.id, { hora_inicio_real: e.target.value })} className="bg-[#0C2043] border border-[#2A4E85] rounded px-1.5 py-1 text-xs" />
                        <span className="text-[#7A8FBE]">–</span>
                        <input type="time" defaultValue={r.hora_fin_real || ""} onBlur={(e) => save(m.id, { hora_fin_real: e.target.value })} className="bg-[#0C2043] border border-[#2A4E85] rounded px-1.5 py-1 text-xs" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-[#7A8FBE]">No hay partidos que coincidan con el filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AsistenciaTab({ departamentales, attendance, asistenciaPorDia, onSaved }) {
  function isPresent(day, depId) {
    return attendance.some((a) => a.day === day && a.departamental_id === depId && a.presente);
  }
  async function toggle(day, depId, presente) {
    await fetch("/api/asistencia", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, departamentalId: depId, presente }),
    });
    onSaved();
  }
  async function marcarTodos(day, presente) {
    await Promise.all(departamentales.map((d) => toggle(day, d.id, presente)));
    onSaved();
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm text-[#9FB0D0] mb-4">Asistencia general de cada departamental por día (no se carga asistencia individual de participantes).</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9FB0D0] border-b border-[#21426E]">
                <th className="py-2 pr-3">Departamental</th>
                {DAYS.map((d) => <th key={d} className="py-2 px-3 text-center">{DAY_LABEL[d]}</th>)}
              </tr>
            </thead>
            <tbody>
              {departamentales.map((d) => (
                <tr key={d.id} className="border-b border-[#12294C]">
                  <td className="py-1.5 pr-3 font-medium">{d.name}</td>
                  {DAYS.map((day) => (
                    <td key={day} className="py-1.5 px-3 text-center">
                      <input type="checkbox" checked={isPresent(day, d.id)} onChange={(e) => toggle(day, d.id, e.target.checked)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2 pr-3 text-xs font-semibold text-[#9FB0D0]">Marcar todos</td>
                {DAYS.map((day) => (
                  <td key={day} className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => marcarTodos(day, true)} className="text-[10px] bg-[#16261E] text-[#4FAE72] border border-[#2E4A3A] rounded px-1.5 py-0.5">Todos</button>
                      <button onClick={() => marcarTodos(day, false)} className="text-[10px] bg-[#0C2043] text-[#9FB0D0] border border-[#2A4E85] rounded px-1.5 py-0.5">Ninguno</button>
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <div className="grid sm:grid-cols-3 gap-3">
        {asistenciaPorDia.map((a) => <StatCard key={a.day} label={DAY_LABEL[a.day]} value={`${a.presentes}/${a.total}`} sub="departamentales presentes" />)}
      </div>
    </div>
  );
}

function IncidentCard({ incident, disciplines, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [estado, setEstado] = useState(incident.estado);
  const [responsable, setResponsable] = useState(incident.responsable || "");
  const [resolucion, setResolucion] = useState(incident.resolucion || "");
  const colors = estadoColor(incident.estado);
  const disc = disciplines.find((d) => d.id === incident.discipline_id);

  async function guardar() {
    await fetch(`/api/incidencias/${incident.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado, responsable, resolucion }),
    });
    setEditing(false);
    onSaved();
  }
  async function eliminar() {
    if (!confirm("¿Eliminar esta incidencia del registro?")) return;
    await fetch(`/api/incidencias/${incident.id}`, { method: "DELETE" });
    onSaved();
  }

  return (
    <div className="border rounded-lg p-4" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-mono text-[#9FB0D0]">
            {DAY_LABEL[incident.day] || incident.day || "—"}{incident.hora ? ` · ${incident.hora}` : ""} — {disc ? disc.name : "General"}{incident.categoria ? ` · ${incident.categoria}` : ""}
          </p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{incident.tipo}</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: colors.text, backgroundColor: "#163A67", border: `1px solid ${colors.border}` }}>{incident.estado}</span>
      </div>
      <p className="text-sm text-[#EDE7D6] mb-1">{incident.descripcion}</p>
      {incident.involucrados && <p className="text-xs text-[#9FB0D0] mb-1"><strong>Involucrados:</strong> {incident.involucrados}</p>}
      {incident.responsable && !editing && <p className="text-xs text-[#9FB0D0] mb-1"><strong>Responsable:</strong> {incident.responsable}</p>}
      {incident.resolucion && !editing && <p className="text-xs text-[#4FAE72] mt-1"><strong>Resolución:</strong> {incident.resolucion}</p>}

      {editing ? (
        <div className="mt-3 space-y-2 bg-[#163A67] border border-[#21426E] rounded-lg p-3">
          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Estado</label>
            <select className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs w-full" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {INCIDENT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Responsable</label>
            <input type="text" className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs w-full" value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Resolución / novedades</label>
            <textarea className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs w-full" rows={2} value={resolucion} onChange={(e) => setResolucion(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={guardar} className="text-xs bg-[#C9A227] text-[#0C2043] px-3 py-1.5 rounded-lg">Guardar</button>
            <button onClick={() => setEditing(false)} className="text-xs bg-[#163A67] border border-[#2A4E85] px-3 py-1.5 rounded-lg">Cancelar</button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs bg-[#163A67] border border-[#2A4E85] px-2.5 py-1.5 rounded-lg hover:bg-[#0C2043]"><RefreshCw className="w-3.5 h-3.5" /> Actualizar estado</button>
          <button onClick={eliminar} className="flex items-center gap-1 text-xs bg-[#163A67] border border-[#2A4E85] px-2.5 py-1.5 rounded-lg hover:bg-[#3A241F] hover:text-[#E0684A]"><Trash2 className="w-3.5 h-3.5" /> Eliminar</button>
        </div>
      )}
    </div>
  );
}

function IncidenciasTab({ disciplines, departamentales, incidents, onSaved }) {
  const [showForm, setShowForm] = useState(false);
  const [filterEstado, setFilterEstado] = useState("");
  const [form, setForm] = useState({ day: DAYS[0], hora: "", disciplineId: "", categoria: "", involucrados: "", tipo: INCIDENT_TYPES[0], descripcion: "", responsable: "" });

  async function submit() {
    if (!form.descripcion.trim()) return;
    await fetch("/api/incidencias", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setForm({ day: DAYS[0], hora: "", disciplineId: "", categoria: "", involucrados: "", tipo: INCIDENT_TYPES[0], descripcion: "", responsable: "" });
    setShowForm(false);
    onSaved();
  }

  const filtered = incidents.filter((i) => !filterEstado || i.estado === filterEstado);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#9FB0D0]">Filtrar por estado</label>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
            <option value="">Todas ({incidents.length})</option>
            {INCIDENT_STATES.map((s) => <option key={s} value={s}>{s} ({incidents.filter((i) => i.estado === s).length})</option>)}
          </select>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 bg-[#C9A227] text-[#0C2043] text-sm px-4 py-2.5 rounded-lg hover:bg-[#A9841C]">
          <Plus className="w-4 h-4" /> Registrar incidencia
        </button>
      </Card>

      {showForm && (
        <Card className="p-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Día</label>
              <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Hora aproximada</label>
              <input type="time" className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Disciplina</label>
              <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full" value={form.disciplineId} onChange={(e) => setForm({ ...form, disciplineId: e.target.value })}>
                <option value="">General / sin disciplina específica</option>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Categoría (opcional)</label>
              <input type="text" className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Tipo</label>
              <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Departamentales / equipos involucrados (opcional)</label>
            <input type="text" list="dept-suggestions" placeholder="ej. Necochea, Mar del Plata" className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full"
              value={form.involucrados} onChange={(e) => setForm({ ...form, involucrados: e.target.value })} />
            <datalist id="dept-suggestions">{departamentales.map((d) => <option key={d.id} value={d.name} />)}</datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Descripción</label>
            <textarea className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full" rows={3}
              value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Qué pasó, dónde, y cualquier detalle relevante para el seguimiento." />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Responsable de atenderla (opcional)</label>
            <input type="text" className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm w-full" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="bg-[#C9A227] text-[#0C2043] text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-95">Guardar incidencia</button>
            <button onClick={() => setShowForm(false)} className="bg-[#163A67] border border-[#2A4E85] text-sm px-4 py-2 rounded-lg">Cancelar</button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && <Card className="p-6 text-center text-sm text-[#7A8FBE]">No hay incidencias registradas{filterEstado ? ` en estado "${filterEstado}"` : ""}.</Card>}
        {filtered.map((i) => <IncidentCard key={i.id} incident={i} disciplines={disciplines} onSaved={onSaved} />)}
      </div>
    </div>
  );
}
