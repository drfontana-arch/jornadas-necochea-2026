"use client";
import { useEffect, useState } from "react";
import { Shuffle, RefreshCw, AlertTriangle, Clock } from "lucide-react";
import Card from "../../../components/Card";
import SelectorBar from "../../../components/SelectorBar";
import { nextPow2, extraQualifierLabel } from "../../../lib/sorteoLogic";

const DAYS = ["2026-10-09", "2026-10-10", "2026-10-11"];
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };
function groupLetter(i) { return String.fromCharCode(65 + i); }
// Disciplinas alcanzadas por el Art. de Copa Oro/Plata: ahí se puede
// cargar hasta el 3er puesto de cada grupo, aunque la modalidad no tenga
// playoff -- lo pidió Enzo para registrar el resultado completo, no solo
// los clasificados a playoff.
const COPA_ORO_PLATA_DISCIPLINES = ["futbol11", "futbolReducido", "basquet", "voley", "hockey"];

export default function SorteoPage() {
  const [disciplines, setDisciplines] = useState([]);
  const [selDiscipline, setSelDiscipline] = useState("");
  const [selCategory, setSelCategory] = useState("");
  const [category, setCategory] = useState(null);
  const [entries, setEntries] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [matches, setMatches] = useState({ groupMatches: [], playoffMatches: [], drawMatches: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reshuffleGroupOrder, setReshuffleGroupOrder] = useState(true);
  const [toast, setToast] = useState(null);
  // Conflictos/restricciones que dejó el ÚLTIMO sorteo o playoff corrido
  // en esta pantalla -- se limpia al cambiar de categoría, para no
  // mostrar el resultado de otra.
  const [sorteoIssues, setSorteoIssues] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3600); }

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/disciplinas");
      const data = await res.json();
      setDisciplines(data.disciplines || []);
      if (data.disciplines?.[0]) {
        setSelDiscipline(data.disciplines[0].id);
        setSelCategory(data.disciplines[0].categories[0]?.id || "");
      }
      setLoading(false);
    })();
  }, []);

  async function loadCategoryData() {
    if (!selCategory) return;
    const [catRes, entRes, partRes, matchRes] = await Promise.all([
      fetch(`/api/categorias/${selCategory}`),
      fetch(`/api/categorias/${selCategory}/team-entries`),
      fetch(`/api/categorias/${selCategory}/participantes`),
      fetch(`/api/categorias/${selCategory}/matches`),
    ]);
    setCategory((await catRes.json()).category);
    setEntries((await entRes.json()).entries || []);
    setParticipants((await partRes.json()).participants || []);
    setMatches(await matchRes.json());
  }
  useEffect(() => { setSorteoIssues(null); loadCategoryData(); }, [selCategory]);

  const discipline = disciplines.find((d) => d.id === selDiscipline);
  const disciplineCategory = discipline?.categories.find((c) => c.id === selCategory);

  async function updateSettings(patch) {
    await fetch(`/api/categorias/${selCategory}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    loadCategoryData();
  }

  async function runDraw() {
    setBusy(true);
    setSorteoIssues(null);
    try {
      const res = await fetch(`/api/categorias/${selCategory}/sorteo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "No se pudo sortear."); return; }
      const issueCount = (data.conflicts?.length || 0) + (data.violations?.length || 0);
      setSorteoIssues({ conflicts: data.conflicts || [], violations: data.violations || [] });
      showToast(issueCount > 0 ? `Sorteo generado. Quedaron ${issueCount} incompatibilidad(es), abajo el detalle.` : "Sorteo generado sin superposiciones detectadas.");
      loadCategoryData();
    } finally {
      setBusy(false);
    }
  }

  // "Resortear horarios": con los grupos/llave ya armados, vuelve a
  // decidir día/hora/cancha -- y, en categorías con grupos, también
  // rebaraja al azar el orden de enfrentamientos dentro de cada grupo
  // (sin mover a nadie de grupo ni tocar la llave de playoff ya armada).
  // Se bloquea del lado del servidor si ya hay resultados cargados.
  async function rescheduleOnly(reshuffleOrder) {
    setBusy(true);
    setSorteoIssues(null);
    try {
      const res = await fetch(`/api/categorias/${selCategory}/resortear-horarios`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reshuffleOrder }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "No se pudo resortear el horario."); return; }
      const issueCount = (data.conflicts?.length || 0) + (data.violations?.length || 0);
      setSorteoIssues({ conflicts: data.conflicts || [], violations: data.violations || [] });
      showToast(issueCount > 0 ? `Horarios resorteados. Quedaron ${issueCount} incompatibilidad(es), abajo el detalle.` : "Horarios resorteados sin superposiciones detectadas.");
      loadCategoryData();
    } finally {
      setBusy(false);
    }
  }

  async function setStanding(groupIndex, rank, label) {
    await fetch(`/api/categorias/${selCategory}/standing`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ groupIndex, rank, label }),
    });
    loadCategoryData();
  }

  async function generatePlayoff() {
    setBusy(true);
    setSorteoIssues(null);
    try {
      const res = await fetch(`/api/categorias/${selCategory}/playoff`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "No se pudo generar el playoff."); return; }
      const issueCount = (data.conflicts?.length || 0) + (data.violations?.length || 0);
      setSorteoIssues({ conflicts: data.conflicts || [], violations: data.violations || [] });
      showToast(issueCount > 0 ? `Llave de playoff generada. Quedaron ${issueCount} incompatibilidad(es), abajo el detalle.` : "Llave de playoff generada, sin superposiciones.");
      loadCategoryData();
    } finally {
      setBusy(false);
    }
  }

  if (loading || !category) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;

  function teamLabel(entry) {
    const count = entries.filter((e) => e.dept === entry.dept).length;
    return count > 1 ? `${entry.dept} ${entry.num}` : entry.dept;
  }
  // Si nadie está anotado en equipo/pareja pero sí hay personas inscriptas
  // sueltas (Ajedrez, Tenis Singles, etc.), se cuentan y muestran esas
  // personas en vez de "0 equipos" -- el sorteo también sabe armar la
  // llave/grupos con ellas (ver runSorteoForCategory en sorteoRunner.js).
  const registeredLabels = entries.length > 0 ? entries.map(teamLabel) : participants.map((p) => `${p.fullName} (${p.departamental})`);

  const isCopaOroPlataDiscipline = COPA_ORO_PLATA_DISCIPLINES.includes(selDiscipline);
  // Cuántos puestos se pueden cargar por grupo: los que clasifican a
  // playoff (si hay), o hasta 3° si la disciplina está alcanzada por Copa
  // Oro/Plata (para registrar el resultado completo aunque no haya
  // playoff), lo que sea mayor.
  const standingsRankCount = Math.max(
    category.modality === "grupos_playoff" ? (category.advance_per_group || 0) : 0,
    isCopaOroPlataDiscipline ? 3 : 0
  );

  // Si los clasificados directos (grupos × clasifican por grupo) no cierran
  // en una potencia de 2, la semifinal/final quedaría con un BYE. Para
  // evitarlo, se completa a mano con clasificados del puesto siguiente
  // (ej. "el mejor segundo" entre todos los segundos), elegidos entre los
  // que ya tengan ese puesto cargado arriba.
  const numGroups = category.groups ? category.groups.length : 0;
  const k = category.advance_per_group || 0;
  const baseQualifierCount = numGroups * k;
  const neededExtra = category.modality === "grupos_playoff" && baseQualifierCount > 0
    ? Math.max(0, nextPow2(baseQualifierCount) - baseQualifierCount)
    : 0;
  const extraCandidates = neededExtra > 0
    ? category.groups
        .map((g, gi) => ({ gi, label: (category.group_standings[gi] || [])[k] }))
        .filter((c) => c.label)
    : [];
  const extraPicks = category.group_standings.extra || [];

  async function toggleExtraQualifier(label) {
    const next = extraPicks.includes(label) ? extraPicks.filter((l) => l !== label) : [...extraPicks, label];
    await updateSettings({ group_standings: { ...category.group_standings, extra: next } });
    // Reemplaza el comodín ("Mejor 2do puesto"/"...#N") por el nombre real
    // en la llave de playoff ya armada -- mismo mecanismo que "1A"/"2B" al
    // cargar posiciones de grupo. Si se destilda o se elige otro después
    // de ya haberse reemplazado, puede hacer falta reprogramar ese
    // partido a mano (el comodín ya reemplazado no vuelve a aparecer).
    for (let i = 0; i < next.length && i < neededExtra; i++) {
      const placeholder = extraQualifierLabel(k, i, neededExtra);
      await fetch(`/api/categorias/${selCategory}/resolver-comodin`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeholder, label: next[i] }),
      });
    }
    loadCategoryData();
  }

  return (
    <SelectorBar
      disciplines={disciplines}
      selDiscipline={selDiscipline}
      setSelDiscipline={(id) => {
        setSelDiscipline(id);
        const d = disciplines.find((x) => x.id === id);
        setSelCategory(d.categories[0]?.id || "");
      }}
      selCategory={selCategory}
      setSelCategory={setSelCategory}
    >
      <div className="space-y-5">
        <Card className="p-5">
          <div className="flex flex-wrap items-end gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Modalidad</label>
              <div className="flex gap-2">
                {[
                  { id: "grupos", label: "Grupos" },
                  { id: "grupos_playoff", label: "Grupos + playoff" },
                  { id: "draw", label: "Llave directa" },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => updateSettings({ modality: m.id })}
                    className={`text-sm px-3 py-1.5 rounded-lg border ${
                      category.modality === m.id ? "bg-[#2FD3C4] text-[#0C2043] border-[#2FD3C4]" : "border-[#2A4E85] text-[#C9D6EC]"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {category.modality !== "draw" && (
              <>
                <label className="text-xs text-[#9FB0D0]">
                  Equipos por grupo
                  <input
                    type="number" min={2} defaultValue={category.group_size}
                    onBlur={(e) => updateSettings({ group_size: Number(e.target.value) })}
                    className="block w-20 mt-1 bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-sm"
                  />
                </label>
                {category.modality === "grupos_playoff" && (
                  <label className="text-xs text-[#9FB0D0]">
                    Clasifican por grupo
                    <input
                      type="number" min={1} defaultValue={category.advance_per_group}
                      onBlur={(e) => updateSettings({ advance_per_group: Number(e.target.value) })}
                      className="block w-20 mt-1 bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-sm"
                    />
                  </label>
                )}
              </>
            )}
            {(category.modality === "grupos_playoff" || category.modality === "draw") && (
              <label className="text-xs text-[#9FB0D0]">
                Reservar día solo para semifinal/final
                <select
                  value={category.playoff_only_day || ""}
                  onChange={(e) => updateSettings({ playoff_only_day: e.target.value || null })}
                  className="block w-48 mt-1 bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-sm"
                >
                  <option value="">Ninguno</option>
                  {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
                </select>
              </label>
            )}
          </div>
          {category.playoff_only_day && (category.modality === "grupos_playoff" || category.modality === "draw") && (
            <p className="text-xs text-[#9FB0D0] mb-3">
              {category.modality === "draw"
                ? `Las rondas anteriores a semifinal no van a usar ${DAY_LABEL[category.playoff_only_day]} -- ese día queda reservado para semifinal y final.`
                : `La fase de grupos no va a usar ${DAY_LABEL[category.playoff_only_day]} -- ese día queda reservado para semifinal y final.`}
            </p>
          )}
          <p className="text-sm text-[#9FB0D0] mb-3">
            {registeredLabels.length} equipo(s)/participante(s) inscriptos en {disciplineCategory?.name}.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={runDraw}
              disabled={busy || registeredLabels.length < 2}
              className="flex items-center gap-2 bg-[#2FD3C4] text-[#0C2043] font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-50"
            >
              <Shuffle className="w-4 h-4" /> {category.drawn ? "Volver a sortear" : "Sortear"}
            </button>
            {category.drawn && (
              <button
                onClick={() => rescheduleOnly(reshuffleGroupOrder)}
                disabled={busy}
                title="Mantiene los grupos y la llave ya armados -- solo vuelve a decidir día/hora/cancha/sede."
                className="flex items-center gap-2 bg-transparent text-[#2FD3C4] font-semibold text-sm px-4 py-2.5 rounded-lg border border-[#2FD3C4] hover:bg-[#13284f] disabled:opacity-50"
              >
                <Clock className="w-4 h-4" /> Resortear horarios
              </button>
            )}
            {category.drawn && category.modality !== "draw" && (
              <label className="flex items-center gap-1.5 text-xs text-[#9FB0D0]">
                <input type="checkbox" checked={reshuffleGroupOrder} onChange={(e) => setReshuffleGroupOrder(e.target.checked)} />
                Rebarajar también el orden dentro de los grupos
              </label>
            )}
            {category.drawn && (
              <a href={`/poster/${selCategory}`} target="_blank" rel="noreferrer" className="text-sm text-[#2FD3C4] hover:underline">
                Ver póster / imprimir →
              </a>
            )}
          </div>
        </Card>

        {sorteoIssues && (sorteoIssues.conflicts.length > 0 || sorteoIssues.violations.length > 0) && (
          <Card className="p-5 border-[#E0684A]">
            <h3 className="font-bold mb-1 flex items-center gap-2 text-[#E0684A]">
              <AlertTriangle className="w-5 h-5" /> {sorteoIssues.conflicts.length + sorteoIssues.violations.length} incompatibilidad(es) generadas por este sorteo
            </h3>
            <p className="text-xs text-[#9FB0D0] mb-3">
              Quedaron así después de armar los horarios de esta categoría. Se pueden resolver desde "Fixture y conflictos" (Autoresolver o reprogramar).
            </p>
            <ul className="space-y-1.5 text-sm">
              {sorteoIssues.conflicts.map((c) => (
                <li key={c.pairId} className="border border-[#5C3A32] bg-[#3A241F] rounded-lg px-3 py-2">
                  <strong>{c.dept}</strong> juega en dos lugares a la vez:
                  <div className="font-mono text-xs mt-1">
                    {c.m1.disciplineName} · {c.m1.categoryName} — {DAY_LABEL[c.m1.day] || c.m1.day} {c.m1.time}
                  </div>
                  <div className="font-mono text-xs">
                    {c.m2.disciplineName} · {c.m2.categoryName} — {DAY_LABEL[c.m2.day] || c.m2.day} {c.m2.time}
                  </div>
                </li>
              ))}
              {sorteoIssues.violations.map((v) => (
                <li key={v.id} className="border border-[#5C4A22] bg-[#2E2712] rounded-lg px-3 py-2">
                  <strong>{v.label}</strong> tiene una restricción horaria sin respetar:
                  <div className="font-mono text-xs mt-1">
                    {v.match.disciplineName} · {v.match.categoryName} — {DAY_LABEL[v.match.day] || v.match.day} {v.match.time}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}

        {category.modality === "grupos" && matches.groupMatches.length > 0 && (
          <Card className="p-5">
            <h3 className="font-bold mb-3">Grupos</h3>
            <div className="grid md:grid-cols-2 gap-4">
              {(category.groups || []).map((g, gi) => (
                <div key={gi} className="border border-[#21426E] rounded-lg p-3">
                  <p className="font-semibold text-sm mb-2">Grupo {groupLetter(gi)}</p>
                  <ul className="text-sm space-y-0.5 mb-3">
                    {g.map((t) => <li key={t}>{t}</li>)}
                  </ul>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-1">Partidos</p>
                  <ul className="text-xs font-mono space-y-1">
                    {matches.groupMatches.filter((m) => m.group === gi).map((m) => (
                      <li key={m.id}>{m.teamA} vs {m.teamB} — {DAY_LABEL[m.day] || m.day || "sin día"} {m.time || ""}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Card>
        )}

        {(category.modality === "grupos_playoff" || (category.modality === "grupos" && isCopaOroPlataDiscipline)) && category.groups && (
          <Card className="p-5">
            <h3 className="font-bold mb-3">Posiciones finales de grupo</h3>
            {isCopaOroPlataDiscipline && (
              <p className="text-xs text-[#7A8FBE] mb-3">
                Se puede cargar hasta el 3er puesto de cada grupo (disciplina alcanzada por Copa Oro/Plata), aunque no todos clasifiquen a playoff.
              </p>
            )}
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {category.groups.map((g, gi) => (
                <div key={gi} className="border border-[#21426E] rounded-lg p-3">
                  <p className="font-semibold text-sm mb-2">Grupo {groupLetter(gi)}</p>
                  {Array.from({ length: standingsRankCount }, (_, r) => (
                    <div key={r} className="flex items-center gap-2 mb-1.5 text-sm">
                      <span className="w-6 text-[#2FD3C4] font-mono font-semibold">{r + 1}°</span>
                      <select
                        className="flex-1 bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-sm"
                        value={(category.group_standings[gi] || [])[r] || ""}
                        onChange={(e) => setStanding(gi, r, e.target.value)}
                      >
                        <option value="">-- elegir equipo --</option>
                        {g.map((t) => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {category.modality === "grupos_playoff" && neededExtra > 0 && (
              <div className="border border-[#5C4A22] bg-[#2E2712] rounded-lg p-3 mb-4">
                <p className="text-sm font-semibold text-[#E0C15A] mb-1">
                  Completar la llave ({extraPicks.length} de {neededExtra} elegido{neededExtra > 1 ? "s" : ""})
                </p>
                <p className="text-xs text-[#9FB0D0] mb-2">
                  Con {numGroups} grupo(s) y {k} clasificado(s) por grupo quedan {baseQualifierCount} clasificados directos --
                  no alcanza para una llave sin BYE en semifinal/final. La llave ya salió armada con "Mejor {k === 1 ? "2do" : `${k + 1}º`} puesto" en ese lugar;
                  elegí acá quién es realmente, y se reemplaza solo en la llave.
                </p>
                {extraCandidates.length === 0 ? (
                  <p className="text-xs text-[#E0684A]">
                    Todavía no cargaste el puesto {k + 1} de ningún grupo arriba -- cargalo primero para poder elegir acá.
                  </p>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {extraCandidates.map((c) => (
                      <label key={c.gi} className="flex items-center gap-2 text-sm bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-1.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={extraPicks.includes(c.label)}
                          disabled={!extraPicks.includes(c.label) && extraPicks.length >= neededExtra}
                          onChange={() => toggleExtraQualifier(c.label)}
                        />
                        {c.label} <span className="text-[#7A8FBE]">— Grupo {groupLetter(c.gi)}, puesto {k + 1}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            {category.modality === "grupos_playoff" && (
              <button
                onClick={generatePlayoff}
                disabled={busy || extraPicks.length !== neededExtra}
                title={extraPicks.length !== neededExtra ? `Elegí ${neededExtra} equipo(s) en "Completar la llave" antes de generarla.` : ""}
                className="flex items-center gap-2 bg-[#0C2043] text-[#2FD3C4] text-sm px-4 py-2.5 rounded-lg hover:brightness-95 disabled:opacity-50"
              >
                <RefreshCw className="w-4 h-4" /> Generar llave de playoff
              </button>
            )}
            {matches.playoffMatches.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-1">Llave de playoff</p>
                <ul className="text-sm font-mono space-y-1">
                  {matches.playoffMatches.map((m) => (
                    <li key={m.id}>{m.label}: {m.teamA || "?"} vs {m.teamB || "?"} {m.day ? `— ${DAY_LABEL[m.day] || m.day} ${m.time}` : ""}</li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        )}

        {category.modality === "draw" && matches.drawMatches.length > 0 && (
          <Card className="p-5">
            <h3 className="font-bold mb-3">Llave</h3>
            {Array.from(new Set(matches.drawMatches.map((m) => m.round))).map((r) => (
              <div key={r} className="mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-1">
                  {r === Math.max(...matches.drawMatches.map((m) => m.round)) ? "Final" : `Ronda ${r}`}
                </p>
                <ul className="text-sm font-mono space-y-1">
                  {matches.drawMatches.filter((m) => m.round === r).map((m) => (
                    <li key={m.id}>
                      {m.label}: {m.teamA || "?"} vs {m.bye ? "BYE (pasa directo)" : m.teamB || "?"}
                      {m.day ? ` — ${DAY_LABEL[m.day] || m.day} ${m.time}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </Card>
        )}
      </div>
      {toast && (
        <div className="fixed bottom-5 right-5 bg-[#2FD3C4] text-[#0C2043] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">{toast}</div>
      )}
    </SelectorBar>
  );
}
