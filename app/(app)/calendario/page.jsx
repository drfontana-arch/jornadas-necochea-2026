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
        className="text-xs bg-[#2FD3C4] text-[#0C2043] px-2.5 py-1.5 rounded-lg"
      >
        Guardar
      </button>
    </div>
  );
}

export default function CalendarioPage() {
  const [matches, setMatches] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [violations, setViolations] = useState([]);
  const [ignored, setIgnored] = useState({});
  const [ignoredViolations, setIgnoredViolations] = useState({});
  const [departamentales, setDepartamentales] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterDisc, setFilterDisc] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sorteandoTodo, setSorteandoTodo] = useState(false);
  const [ultimoDetalle, setUltimoDetalle] = useState(null);
  const [revision, setRevision] = useState(null);
  const [revisionLoading, setRevisionLoading] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 4200); }

  async function load() {
    const [mRes, depRes, dRes] = await Promise.all([
      fetch("/api/matches?withConflicts=1"), fetch("/api/departamentales"), fetch("/api/disciplinas"),
    ]);
    const mData = await mRes.json();
    const depData = await depRes.json();
    const dData = await dRes.json();
    setMatches(mData.matches || []);
    setConflicts(mData.conflicts || []);
    setViolations(mData.violations || []);
    setDepartamentales(depData.departamentales || []);
    setDisciplines(dData.disciplines || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function autoResolve(matchId) {
    const res = await fetch(`/api/matches/${matchId}/autoresolver`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "No se pudo autoresolver."); return; }
    showToast(`Partido reprogramado automáticamente a ${DAY_LABEL[data.slot.day] || data.slot.day} ${data.slot.time} (cancha ${data.slot.court}).`);
    load();
  }

  async function abrirRevision() {
    setRevisionLoading(true);
    const res = await fetch("/api/sorteo-global");
    const data = await res.json();
    setRevision(data.pendientes || []);
    setRevisionLoading(false);
  }

  async function actualizarConfigCategoria(catId, patch) {
    await fetch(`/api/categorias/${catId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    abrirRevision();
  }

  async function confirmarSorteoTodo() {
    setSorteandoTodo(true);
    setUltimoDetalle(null);
    try {
      const res = await fetch("/api/sorteo-global", { method: "POST" });
      let data;
      try {
        data = await res.json();
      } catch {
        showToast("El servidor tardó demasiado o falló. Apretá el botón de nuevo -- retoma desde donde quedó.");
        return;
      }
      if (!res.ok) { showToast(data.error || "No se pudo completar el sorteo global."); return; }
      setUltimoDetalle(data);
      setRevision(null);
      showToast(`Sorteo global terminado: ${data.sorteadas} categoría(s) sorteada(s), ${data.saltadas} sin poder sortear.`);
      load();
    } finally {
      setSorteandoTodo(false);
    }
  }

  function baseDept(label) {
    if (!label) return label;
    return label.replace(/\s+\d+$/, "").trim();
  }
  function isReal(m) {
    return m && !String(m.id).startsWith("ind-");
  }
  function matchLabel(m) {
    if (m.teamB) return `${m.teamA} vs ${m.teamB}`;
    if (m.teamA) return `${m.teamA} (horario de competencia)`;
    return "A definir vs A definir";
  }

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;

  const visibleConflicts = conflicts.filter((c) => !ignored[c.pairId]);
  const visibleViolations = violations.filter((v) => !ignoredViolations[v.id]);
  const sorted = matches
    .filter((m) => !filterDept || baseDept(m.teamA) === filterDept || baseDept(m.teamB) === filterDept)
    .filter((m) => !filterDay || m.day === filterDay)
    .filter((m) => !filterDisc || m.disciplineId === filterDisc)
    .sort((a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || ""));

  return (
    <div className="space-y-5">
      {visibleViolations.length > 0 && (
        <Card className="p-5 border-[#E0C15A]">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#E0C15A]">
            <AlertTriangle className="w-5 h-5" /> Partidos que violan una restricción horaria ({visibleViolations.length})
          </h2>
          <div className="space-y-3">
            {visibleViolations.map((v) => (
              <div key={v.id} className="border border-[#5C4A22] bg-[#2E2712] rounded-lg p-3 text-sm">
                <p className="font-semibold mb-1">{v.label} tiene una restricción para este horario:</p>
                <p className="font-mono text-xs mb-2">{v.match.disciplineName} · {v.match.categoryName} — {matchLabel(v.match)} — {DAY_LABEL[v.match.day] || v.match.day} {v.match.time}</p>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setIgnoredViolations((prev) => ({ ...prev, [v.id]: true }))} className="flex items-center gap-1 text-xs bg-[#163A67] border border-[#2A4E85] px-2.5 py-1.5 rounded-lg hover:bg-[#0C2043]">
                    <Check className="w-3.5 h-3.5" /> Seguir igual
                  </button>
                  {isReal(v.match) ? (
                    <>
                      <button onClick={() => autoResolve(v.match.id)} className="flex items-center gap-1 text-xs bg-[#2FD3C4] text-[#0C2043] px-2.5 py-1.5 rounded-lg hover:bg-[#1E9C90]">
                        <RefreshCw className="w-3.5 h-3.5" /> Autoresolver (buscar horario libre)
                      </button>
                      <ReprogramarControl match={v.match} onSaved={load} />
                    </>
                  ) : (
                    <span className="text-xs text-[#7A8FBE] self-center">Horario fijo de disciplina individual — no se reprograma desde acá.</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {visibleConflicts.length > 0 && (
        <Card className="p-5 border-[#E0684A]">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#E0684A]">
            <AlertTriangle className="w-5 h-5" /> Superposiciones horarias detectadas ({visibleConflicts.length})
          </h2>
          <div className="space-y-3">
            {visibleConflicts.map((c) => {
              const target = isReal(c.m2) ? c.m2 : isReal(c.m1) ? c.m1 : null;
              return (
                <div key={c.pairId} className="border border-[#5C3A32] bg-[#3A241F] rounded-lg p-3 text-sm">
                  <p className="font-semibold mb-1">{c.dept} juega en dos lugares a la vez:</p>
                  <p className="font-mono text-xs mb-1">{c.m1.disciplineName} · {c.m1.categoryName} — {matchLabel(c.m1)} — {DAY_LABEL[c.m1.day] || c.m1.day} {c.m1.time}</p>
                  <p className="font-mono text-xs mb-2">{c.m2.disciplineName} · {c.m2.categoryName} — {matchLabel(c.m2)} — {DAY_LABEL[c.m2.day] || c.m2.day} {c.m2.time}</p>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setIgnored((prev) => ({ ...prev, [c.pairId]: true }))} className="flex items-center gap-1 text-xs bg-[#163A67] border border-[#2A4E85] px-2.5 py-1.5 rounded-lg hover:bg-[#0C2043]">
                      <Check className="w-3.5 h-3.5" /> Seguir igual con el sorteo
                    </button>
                    {target ? (
                      <>
                        <button onClick={() => autoResolve(target.id)} className="flex items-center gap-1 text-xs bg-[#2FD3C4] text-[#0C2043] px-2.5 py-1.5 rounded-lg hover:bg-[#1E9C90]">
                          <RefreshCw className="w-3.5 h-3.5" /> Autoresolver (buscar horario libre)
                        </button>
                        <ReprogramarControl match={target} onSaved={load} />
                      </>
                    ) : (
                      <span className="text-xs text-[#7A8FBE] self-center">Ambos horarios son de disciplinas individuales — no se reprograman desde acá.</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {revision && (
        <Card className="p-5 border-[#E0C15A]">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-lg">Revisión antes de sortear todo</h2>
              <p className="text-xs text-[#9FB0D0]">
                Ajustá la modalidad, el tamaño de grupo o cuántos clasifican por grupo de cada categoría antes de confirmar.
                Las que están en rojo no se van a poder sortear tal como están configuradas.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRevision(null)} className="text-xs bg-[#163A67] border border-[#2A4E85] px-3 py-2 rounded-lg">Cancelar</button>
              <button
                onClick={confirmarSorteoTodo}
                disabled={sorteandoTodo}
                className="text-xs bg-[#2FD3C4] text-[#0C2043] font-semibold px-3 py-2 rounded-lg disabled:opacity-50"
              >
                {sorteandoTodo ? "Sorteando…" : "Confirmar y sortear todo"}
              </button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto space-y-1.5">
            {revision.length === 0 && <p className="text-sm text-[#4FAE72]">No hay categorías pendientes de sortear.</p>}
            {revision.map((r) => (
              <div key={r.id} className={`text-sm rounded-lg px-3 py-2 border ${r.ok ? "border-[#21426E] bg-[#0C2043]" : "border-[#5C3A32] bg-[#3A241F]"}`}>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-semibold">{r.disciplineName} — {r.name} <span className="text-[#7A8FBE] font-normal">({r.teamCount} equipo/s)</span></span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs"
                      value={r.modality}
                      onChange={(e) => actualizarConfigCategoria(r.id, { modality: e.target.value })}
                    >
                      <option value="draw">Llave directa</option>
                      <option value="grupos">Grupos</option>
                      <option value="grupos_playoff">Grupos + playoff</option>
                    </select>
                    {r.modality !== "draw" && (
                      <>
                        <label className="text-xs text-[#9FB0D0] flex items-center gap-1">
                          Tamaño grupo
                          <input
                            type="number" min={2} defaultValue={r.groupSize}
                            className="w-14 bg-[#0C2043] border border-[#2A4E85] rounded px-1.5 py-1 text-xs"
                            onBlur={(e) => actualizarConfigCategoria(r.id, { group_size: Number(e.target.value) })}
                          />
                        </label>
                        {r.modality === "grupos_playoff" && (
                          <label className="text-xs text-[#9FB0D0] flex items-center gap-1">
                            Clasifican
                            <input
                              type="number" min={1} defaultValue={r.advancePerGroup}
                              className="w-14 bg-[#0C2043] border border-[#2A4E85] rounded px-1.5 py-1 text-xs"
                              onBlur={(e) => actualizarConfigCategoria(r.id, { advance_per_group: Number(e.target.value) })}
                            />
                          </label>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {!r.ok && <p className="text-xs text-[#E0684A] mt-1">{r.reason}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {ultimoDetalle && (
        <Card className="p-5 border-[#2A4E85]">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-lg">Resultado del sorteo global</h2>
            <button onClick={() => setUltimoDetalle(null)} className="text-xs text-[#7A8FBE] hover:text-[#EDE7D6]">Cerrar</button>
          </div>
          <p className="text-sm text-[#9FB0D0] mb-3">
            {ultimoDetalle.sorteadas} categoría(s) sorteada(s) · {ultimoDetalle.saltadas} sin poder sortear.
          </p>
          <div className="max-h-[300px] overflow-y-auto space-y-1">
            {ultimoDetalle.detalle.filter((d) => !d.ok).map((d, i) => (
              <div key={i} className="text-sm bg-[#2E2712] border border-[#5C4A22] rounded px-3 py-1.5">
                <strong>{d.categoria}</strong> — {d.error}
              </div>
            ))}
            {ultimoDetalle.detalle.filter((d) => !d.ok).length === 0 && (
              <p className="text-sm text-[#4FAE72]">Se sortearon todas las categorías con equipos suficientes.</p>
            )}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-bold text-lg">Fixture general</h2>
          <button
            onClick={abrirRevision}
            disabled={revisionLoading}
            className="flex items-center gap-2 bg-[#E0C15A] text-[#132A4C] text-sm font-semibold px-3 py-2 rounded-lg hover:brightness-95 disabled:opacity-50"
          >
            {revisionLoading ? "Cargando…" : "Revisar y sortear todo lo pendiente"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
            <option value="">Todos los días</option>
            {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
          </select>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDisc} onChange={(e) => setFilterDisc(e.target.value)}>
            <option value="">Todas las disciplinas</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDept} onChange={(e) => setFilterDept(e.target.value)}>
            <option value="">Todas las departamentales</option>
            {departamentales.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
          <span className="text-[#7A8FBE] text-sm self-center">Póster del día:</span>
          {DAYS.map((d) => (
            <a key={d} href={`/poster/dia/${d}`} target="_blank" rel="noreferrer" className="text-sm text-[#2FD3C4] hover:underline self-center">
              {DAY_LABEL[d]}
            </a>
          ))}
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
                    <td className="py-1.5 pr-3">{m.bye ? `${m.teamA || "?"} vs BYE` : matchLabel(m)}</td>
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
      {toast && <div className="fixed bottom-5 right-5 bg-[#2FD3C4] text-[#0C2043] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">{toast}</div>}
    </div>
  );
}
