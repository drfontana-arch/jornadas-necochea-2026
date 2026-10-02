"use client";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, RefreshCw, Download, RotateCcw, ChevronDown, Printer } from "lucide-react";
import Card from "../../../components/Card";
import { CourtGrid, AgendaGrid, CategoryLegend } from "../../../components/FixtureGrids";
import { buildCategoryColors, catKeyOf, catLabelOf } from "../../../lib/fixtureGrid";
import { exportFixtureXlsx } from "../../../lib/fixtureExcel";
import { INDIVIDUAL_DISCIPLINES } from "../../../lib/sorteoLogic";

const DAYS = ["2026-10-09", "2026-10-10", "2026-10-11"];
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

function isReal(m) {
  return m && !String(m.id).startsWith("ind-");
}
function matchLabel(m) {
  if (m.teamB) return `${m.teamA} vs ${m.teamB}`;
  if (m.teamA) return `${m.teamA} (horario de competencia)`;
  return "A definir vs A definir";
}

// Fila plegada por defecto: muestra solo el resumen (un renglón) y recién
// al tocarla despliega el detalle y las acciones -- para que un panel con
// muchos conflictos/restricciones no sea una pared de texto.
function CollapsibleRow({ tone = "red", summary, children }) {
  const [open, setOpen] = useState(false);
  const toneClasses = tone === "amber" ? "border-[#5C4A22] bg-[#2E2712]" : "border-[#5C3A32] bg-[#3A241F]";
  return (
    <div className={`border rounded-lg text-sm ${toneClasses}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between gap-2 text-left px-3 py-2">
        <span className="font-semibold">{summary}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}

function ReprogramarControl({ match, onSaved, label }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(match.day || DAYS[0]);
  const [time, setTime] = useState(match.time || "09:00");
  const [court, setCourt] = useState(match.court || 1);
  const [venueLocation, setVenueLocation] = useState(match.location || "");
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [recheckTick, setRecheckTick] = useState(0);

  // Chequea (sin guardar nada) si ese día/hora/cancha generaría alguna
  // superposición, cada vez que se toca un campo -- con una pequeña demora
  // para no mandar un pedido por cada tecla.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setChecking(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/matches/${match.id}/check-horario`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ day, time, court: Number(court) || null }),
        });
        const data = await res.json();
        if (!cancelled) setCheckResult(res.ok ? data : null);
      } finally {
        if (!cancelled) setChecking(false);
      }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [open, day, time, court, recheckTick, match.id]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs bg-[#163A67] border border-[#2A4E85] px-2.5 py-1.5 rounded-lg hover:bg-[#0C2043]">
        <RefreshCw className="w-3.5 h-3.5" /> {label || "Reprogramar este partido"}
      </button>
    );
  }

  const issueCount = checkResult ? checkResult.conflicts.length + checkResult.violations.length + (checkResult.courtClash ? 1 : 0) : 0;

  async function guardar() {
    if (issueCount > 0) {
      const resumen = [
        ...checkResult.conflicts.map((c) => {
          const other = c.m1.id === match.id ? c.m2 : c.m1;
          return `- ${c.dept} también tiene: ${other.disciplineName} · ${other.categoryName} — ${matchLabel(other)}`;
        }),
        ...checkResult.violations.map((v) => `- ${v.label} tiene una restricción horaria cargada para ese momento`),
        checkResult.courtClash
          ? `- La cancha ${court} ya está ocupada a esa hora por: ${checkResult.courtClash.disciplineName} · ${checkResult.courtClash.categoryName} — ${matchLabel(checkResult.courtClash)}`
          : null,
      ].filter(Boolean).join("\n");
      const ok = confirm(`Este horario genera ${issueCount} superposición(es):\n\n${resumen}\n\n¿Confirmás igual?`);
      if (!ok) return;
    }
    await fetch(`/api/matches/${match.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ day, time, court: Number(court), location: venueLocation.trim() || null }),
    });
    setOpen(false);
    setShowDetail(false);
    onSaved();
  }

  return (
    <div className="flex flex-col gap-2 items-start">
      <div className="flex items-center gap-2 flex-wrap">
        <select className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs" value={day} onChange={(e) => setDay(e.target.value)}>
          {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
        </select>
        <input type="time" className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs" value={time} onChange={(e) => setTime(e.target.value)} />
        <input type="number" min={1} className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs w-16" value={court} onChange={(e) => setCourt(Number(e.target.value))} />
        <input type="text" placeholder="Lugar/sede" className="bg-[#0C2043] border border-[#2A4E85] rounded px-2 py-1 text-xs w-28" value={venueLocation} onChange={(e) => setVenueLocation(e.target.value)} />
        {checking && <span className="text-xs text-[#7A8FBE]">Revisando…</span>}
        {!checking && issueCount > 0 && (
          <button
            type="button"
            onClick={() => setShowDetail((v) => !v)}
            title={`${issueCount} superposición(es) con este horario -- tocá para ver el detalle`}
            className="flex items-center gap-1 text-xs bg-[#3A241F] border border-[#E0684A] text-[#E0684A] px-2 py-1.5 rounded-lg hover:bg-[#472A22]"
          >
            <AlertTriangle className="w-3.5 h-3.5" /> {issueCount}
          </button>
        )}
        <button onClick={guardar} className="text-xs bg-[#2FD3C4] text-[#0C2043] px-2.5 py-1.5 rounded-lg">Guardar</button>
        <button onClick={() => setOpen(false)} className="text-xs text-[#7A8FBE] hover:text-[#EDE7D6]">Cancelar</button>
      </div>
      {showDetail && issueCount > 0 && (
        <div className="border border-[#5C3A32] bg-[#3A241F] rounded-lg p-2.5 space-y-2.5 max-w-md">
          {checkResult.conflicts.map((c) => {
            const other = c.m1.id === match.id ? c.m2 : c.m1;
            return (
              <div key={c.pairId} className="text-xs">
                <p className="mb-1">
                  <strong>{c.dept}</strong> también juega: {other.disciplineName} · {other.categoryName} — {matchLabel(other)}
                  {" "}({DAY_LABEL[other.day] || other.day} {other.time})
                </p>
                {isReal(other) && (
                  <ReprogramarControl match={other} label="Editar este partido" onSaved={() => { onSaved(); setRecheckTick((t) => t + 1); }} />
                )}
              </div>
            );
          })}
          {checkResult.violations.map((v) => (
            <p key={v.id} className="text-xs"><strong>{v.label}</strong> tiene una restricción horaria cargada para este momento.</p>
          ))}
          {checkResult.courtClash && (
            <div className="text-xs">
              <p className="mb-1">
                La cancha {court} ya está ocupada a esa hora por: {checkResult.courtClash.disciplineName} · {checkResult.courtClash.categoryName} — {matchLabel(checkResult.courtClash)}
              </p>
              {isReal(checkResult.courtClash) && (
                <ReprogramarControl match={checkResult.courtClash} label="Editar este partido" onSaved={() => { onSaved(); setRecheckTick((t) => t + 1); }} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* Vista previa + confirmación para resetear el fixture de partidos de un
   alcance (una categoría, una disciplina entera, o todo). Antes de dejar
   confirmar, muestra las incompatibilidades horarias que hay AHORA MISMO
   en ese alcance, para decidir si vale la pena resetear o conviene
   resolverlas a mano sin perder el resto del fixture ya sorteado. */
function ResetSorteoPanel({ disciplines, onClose, onDone, showToast }) {
  const disciplinasSorteables = disciplines.filter((d) => !INDIVIDUAL_DISCIPLINES.includes(d.id));
  const [scope, setScope] = useState("categoria");
  const [disciplineId, setDisciplineId] = useState(disciplinasSorteables[0]?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);

  const categoriasDeLaDisciplina = disciplinasSorteables.find((d) => d.id === disciplineId)?.categories || [];

  // Si cambia la disciplina (o arranca el panel) y no hay categoría elegida
  // todavía, arrancamos con la primera de la lista.
  useEffect(() => {
    if (scope === "categoria" && !categoryId && categoriasDeLaDisciplina[0]) {
      setCategoryId(categoriasDeLaDisciplina[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, disciplineId, categoriasDeLaDisciplina.length]);

  useEffect(() => {
    let cancelled = false;
    async function cargarPreview() {
      setError(null);
      if (scope === "categoria" && !categoryId) return;
      if (scope === "disciplina" && !disciplineId) return;
      setLoadingPreview(true);
      setPreview(null);
      try {
        const params = new URLSearchParams({ scope });
        if (scope === "disciplina") params.set("disciplineId", disciplineId);
        if (scope === "categoria") params.set("categoryId", categoryId);
        const res = await fetch(`/api/sorteo-global/reset?${params}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(data.error || "No se pudo calcular la vista previa."); return; }
        setPreview(data);
      } finally {
        if (!cancelled) setLoadingPreview(false);
      }
    }
    cargarPreview();
    return () => { cancelled = true; };
  }, [scope, disciplineId, categoryId]);

  async function confirmar() {
    if (!preview) return;
    const scopeLabel =
      scope === "total"
        ? "TODO el sorteo"
        : scope === "disciplina"
        ? `toda la disciplina "${disciplinasSorteables.find((d) => d.id === disciplineId)?.name}"`
        : `la categoría "${categoriasDeLaDisciplina.find((c) => c.id === categoryId)?.name}"`;
    const ok = confirm(
      `Vas a borrar ${preview.matchesCount} partido(s) de ${preview.categoriesCount} categoría(s) (${scopeLabel}).

` +
        `La modalidad/tamaño de grupo, las sedes y canchas, y las inscripciones NO se tocan.

` +
        `Esta acción no se puede deshacer. ¿Confirmás?`
    );
    if (!ok) return;
    setResetting(true);
    try {
      const body = { scope };
      if (scope === "disciplina") body.disciplineId = disciplineId;
      if (scope === "categoria") body.categoryId = categoryId;
      const res = await fetch("/api/sorteo-global/reset", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "No se pudo resetear el sorteo."); return; }
      showToast(`Reseteado: ${data.matchesDeleted} partido(s) borrado(s) de ${data.categoriesCount} categoría(s). Ya podés volver a sortear.`);
      onDone();
    } finally {
      setResetting(false);
    }
  }

  const incompatCount = preview ? preview.conflicts.length + preview.violations.length : 0;

  return (
    <Card className="p-5 border-[#5C3A32]">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-lg text-[#E0684A] flex items-center gap-2">
          <RotateCcw className="w-5 h-5" /> Resetear sorteo
        </h2>
        <button onClick={onClose} className="text-xs text-[#7A8FBE] hover:text-[#EDE7D6]">Cerrar</button>
      </div>
      <p className="text-xs text-[#9FB0D0] mb-3">
        Borra el fixture de partidos ya sorteados del alcance elegido para volver a sortearlo de cero. NO toca la
        modalidad/tamaño de grupo/clasificados de cada categoría, ni las sedes y canchas, ni las inscripciones.
      </p>

      <div className="flex flex-wrap gap-2 mb-3">
        <select
          className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm"
          value={scope}
          onChange={(e) => { setScope(e.target.value); setPreview(null); }}
        >
          <option value="categoria">Una categoría</option>
          <option value="disciplina">Una disciplina completa</option>
          <option value="total">Todo el sorteo</option>
        </select>
        {(scope === "disciplina" || scope === "categoria") && (
          <select
            className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm"
            value={disciplineId}
            onChange={(e) => { setDisciplineId(e.target.value); setCategoryId(""); }}
          >
            {disciplinasSorteables.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        {scope === "categoria" && (
          <select
            className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
          >
            {categoriasDeLaDisciplina.map((c) => (
              <option key={c.id} value={c.id}>{c.name}{c.drawn ? "" : " (sin sortear)"}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p className="text-sm text-[#E0684A] mb-3">{error}</p>}
      {loadingPreview && <p className="text-sm text-[#9FB0D0]">Calculando…</p>}

      {preview && !loadingPreview && (
        <div className="space-y-3">
          <p className="text-sm">
            Se van a borrar <strong>{preview.matchesCount}</strong> partido(s) de <strong>{preview.categoriesCount}</strong> categoría(s).
            {preview.matchesCount === 0 && " No hay nada sorteado todavía en este alcance."}
          </p>

          {incompatCount > 0 && (
            <div className="border border-[#5C4A22] bg-[#2E2712] rounded-lg p-3">
              <p className="text-sm font-semibold text-[#E0C15A] mb-2 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" /> Este alcance tiene {incompatCount} incompatibilidad(es) horaria(s) ahora mismo
              </p>
              <p className="text-xs text-[#9FB0D0] mb-2">
                Mirá si vale la pena resetear para corregirlas (se pierde el resto del fixture de este alcance), o si
                conviene dejarlas así y resolverlas a mano desde "Fixture y conflictos" (Autoresolver o reprogramar)
                sin resetear nada.
              </p>
              <ul className="space-y-1.5 text-xs font-mono">
                {preview.conflicts.map((c) => (
                  <li key={c.pairId}>
                    {c.dept} juega en dos lugares a la vez: {c.m1.disciplineName} · {c.m1.categoryName} ({DAY_LABEL[c.m1.day] || c.m1.day} {c.m1.time}) — {c.m2.disciplineName} · {c.m2.categoryName} ({DAY_LABEL[c.m2.day] || c.m2.day} {c.m2.time})
                  </li>
                ))}
                {preview.violations.map((v) => (
                  <li key={v.id}>
                    {v.label} tiene una restricción horaria sin respetar: {v.match.disciplineName} · {v.match.categoryName} ({DAY_LABEL[v.match.day] || v.match.day} {v.match.time})
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={confirmar}
            disabled={resetting || preview.matchesCount === 0}
            className="bg-[#E0684A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-95 disabled:opacity-50"
          >
            {resetting ? "Reseteando…" : `Resetear (${preview.matchesCount} partido(s))`}
          </button>
        </div>
      )}
    </Card>
  );
}

export default function CalendarioPage() {
  const [matches, setMatches] = useState([]);
  const [unscheduled, setUnscheduled] = useState([]);
  const [conflicts, setConflicts] = useState([]);
  const [violations, setViolations] = useState([]);
  const [ignored, setIgnored] = useState({});
  const [ignoredViolations, setIgnoredViolations] = useState({});
  const [departamentales, setDepartamentales] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [filterDept, setFilterDept] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [filterDisc, setFilterDisc] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [sortMode, setSortMode] = useState("cron");
  const [viewMode, setViewMode] = useState("lista"); // lista | cancha | agenda
  const [selected, setSelected] = useState({});
  const [gridScope, setGridScope] = useState("filtrados"); // filtrados | seleccionados
  const [exporting, setExporting] = useState(false);
  const [printWithSchedule, setPrintWithSchedule] = useState(true);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [sorteandoTodo, setSorteandoTodo] = useState(false);
  const [ultimoDetalle, setUltimoDetalle] = useState(null);
  const [revision, setRevision] = useState(null);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 4200); }

  async function load() {
    const [mRes, depRes, dRes] = await Promise.all([
      fetch("/api/matches?withConflicts=1"), fetch("/api/departamentales"), fetch("/api/disciplinas"),
    ]);
    const mData = await mRes.json();
    const depData = await depRes.json();
    const dData = await dRes.json();
    setMatches(mData.matches || []);
    setUnscheduled(mData.unscheduled || []);
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

  // El color de cada categoría se calcula sobre TODOS los partidos, así no
  // cambia al filtrar.
  const colors = useMemo(() => buildCategoryColors(matches), [matches]);

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;

  const visibleConflicts = conflicts.filter((c) => !ignored[c.pairId]);
  const visibleViolations = violations.filter((v) => !ignoredViolations[v.id]);
  const isRealTeam = (t) => t && !/^[1-9][A-Z]$/.test(t);
  const matchesInDisc = matches.filter((m) => !filterDisc || m.disciplineId === filterDisc);
  const catOptions = [...new Map(matchesInDisc.map((m) => [catKeyOf(m), catLabelOf(m)])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "es"));
  const teamOptions = [...new Set(
    matchesInDisc
      .filter((m) => !filterCat || catKeyOf(m) === filterCat)
      .flatMap((m) => [m.teamA, m.teamB])
      .filter(isRealTeam)
  )].sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

  const byDayTime = (a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || "");
  const sortCmp = {
    cron: byDayTime,
    disciplina: (a, b) => (a.disciplineName || "").localeCompare(b.disciplineName || "", "es") || byDayTime(a, b),
    categoria: (a, b) => catLabelOf(a).localeCompare(catLabelOf(b), "es") || byDayTime(a, b),
  }[sortMode];
  const sorted = matches
    .filter((m) => !filterDept || baseDept(m.teamA) === filterDept || baseDept(m.teamB) === filterDept)
    .filter((m) => !filterDay || m.day === filterDay)
    .filter((m) => !filterDisc || m.disciplineId === filterDisc)
    .filter((m) => !filterCat || catKeyOf(m) === filterCat)
    .filter((m) => !filterTeam || m.teamA === filterTeam || m.teamB === filterTeam)
    .sort(sortCmp);
  const selectedCount = sorted.filter((m) => selected[m.id]).length;
  const gridMatches = gridScope === "seleccionados" ? sorted.filter((m) => selected[m.id]) : sorted;
  const allVisibleSelected = sorted.length > 0 && selectedCount === sorted.length;

  async function exportar() {
    setExporting(true);
    try {
      // Si está filtrado a una sola disciplina/categoría, el archivo sale
      // nombrado así ("por disciplina y actividad"), para bajar uno por
      // categoría sin que se pisen los nombres entre descargas.
      let label = "fixture-jornadas-necochea-2026";
      if (filterCat) {
        const found = catOptions.find(([k]) => k === filterCat);
        if (found) label = found[1];
      } else if (filterDisc) {
        const disc = disciplines.find((d) => d.id === filterDisc);
        if (disc) label = disc.name;
      }
      const slug = label.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      await exportFixtureXlsx(gridMatches, colors, slug || "fixture-jornadas-necochea-2026");
    } catch (e) {
      showToast("No se pudo generar el Excel: " + e.message);
    } finally {
      setExporting(false);
    }
  }

  // Imprime (o "Guardar como PDF" desde el diálogo de impresión del
  // navegador, mismo mecanismo que ya usan los pósters) la tabla impresa
  // oculta de más abajo -- con o sin columnas de horario según se elija.
  // El cambio de estado se aplica antes de abrir el diálogo de impresión
  // (requestAnimationFrame espera a que React ya haya actualizado el DOM).
  function imprimir(withSchedule) {
    setPrintWithSchedule(withSchedule);
    requestAnimationFrame(() => window.print());
  }

  return (
    <div>
    <div className="no-print space-y-5">
      {unscheduled.length > 0 && (
        <Card className="p-5 border-[#E0684A]">
          <h2 className="font-bold text-lg mb-1 flex items-center gap-2 text-[#E0684A]">
            <AlertTriangle className="w-5 h-5" /> Partidos sin horario asignado ({unscheduled.length})
          </h2>
          <p className="text-xs text-[#9FB0D0] mb-3">
            El sorteo no encontró ningún horario libre para estos partidos (suele pasar si falta configurar sedes/ventanas horarias para la disciplina). No aparecen en el Fixture general hasta que se les asigne día, hora y cancha a mano.
          </p>
          <div className="space-y-2">
            {unscheduled.map((m) => (
              <CollapsibleRow key={m.id} summary={<>{m.disciplineName} · {m.categoryName} <span className="text-[#9FB0D0] font-normal">({m.stage})</span></>}>
                <p className="font-mono text-xs text-[#9FB0D0] mb-2">{matchLabel(m)}</p>
                <ReprogramarControl match={m} onSaved={load} label="Asignar horario" />
              </CollapsibleRow>
            ))}
          </div>
        </Card>
      )}

      {visibleViolations.length > 0 && (
        <Card className="p-5 border-[#E0C15A]">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#E0C15A]">
            <AlertTriangle className="w-5 h-5" /> Partidos que violan una restricción horaria ({visibleViolations.length})
          </h2>
          <div className="space-y-2">
            {visibleViolations.map((v) => (
              <CollapsibleRow key={v.id} tone="amber" summary={<>{v.label} tiene una restricción para este horario</>}>
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
              </CollapsibleRow>
            ))}
          </div>
        </Card>
      )}

      {visibleConflicts.length > 0 && (
        <Card className="p-5 border-[#E0684A]">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#E0684A]">
            <AlertTriangle className="w-5 h-5" /> Superposiciones horarias detectadas ({visibleConflicts.length})
          </h2>
          <div className="space-y-2">
            {visibleConflicts.map((c) => {
              const target = isReal(c.m2) ? c.m2 : isReal(c.m1) ? c.m1 : null;
              return (
                <CollapsibleRow key={c.pairId} summary={<>{c.dept} juega en dos lugares a la vez</>}>
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
                </CollapsibleRow>
              );
            })}
          </div>
        </Card>
      )}

      {showReset && (
        <ResetSorteoPanel
          disciplines={disciplines}
          onClose={() => setShowReset(false)}
          onDone={() => { setShowReset(false); load(); }}
          showToast={showToast}
        />
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
          <div className="flex gap-2">
            <button
              onClick={() => setShowReset((v) => !v)}
              className="flex items-center gap-2 bg-[#3A241F] border border-[#5C3A32] text-[#E0684A] text-sm font-semibold px-3 py-2 rounded-lg hover:bg-[#472A22]"
            >
              <RotateCcw className="w-4 h-4" /> Resetear sorteo
            </button>
            <button
              onClick={abrirRevision}
              disabled={revisionLoading}
              className="flex items-center gap-2 bg-[#E0C15A] text-[#132A4C] text-sm font-semibold px-3 py-2 rounded-lg hover:brightness-95 disabled:opacity-50"
            >
              {revisionLoading ? "Cargando…" : "Revisar y sortear todo lo pendiente"}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
            <option value="">Todos los días</option>
            {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
          </select>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={filterDisc} onChange={(e) => { setFilterDisc(e.target.value); setFilterCat(""); setFilterTeam(""); }}>
            <option value="">Todas las disciplinas</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm max-w-[260px]" value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setFilterTeam(""); }}>
            <option value="">Todas las categorías</option>
            {catOptions.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
          </select>
          <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm max-w-[220px]" value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
            <option value="">Todos los equipos</option>
            {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
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
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="inline-flex rounded-lg overflow-hidden border border-[#2A4E85]">
            {[["lista", "Lista"], ["cancha", "Grilla por cancha"], ["agenda", "Grilla agenda"]].map(([k, label]) => (
              <button
                key={k}
                onClick={() => setViewMode(k)}
                className={`text-sm px-3 py-1.5 ${viewMode === k ? "bg-[#2FD3C4] text-[#0C2043] font-semibold" : "bg-[#0C2043] text-[#9FB0D0] hover:bg-[#163A67]"}`}
              >
                {label}
              </button>
            ))}
          </div>
          {viewMode === "lista" && (
            <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={sortMode} onChange={(e) => setSortMode(e.target.value)}>
              <option value="cron">Ordenar por día y hora</option>
              <option value="disciplina">Ordenar por disciplina</option>
              <option value="categoria">Ordenar por categoría</option>
            </select>
          )}
          {viewMode !== "lista" && (
            <select className="bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={gridScope} onChange={(e) => setGridScope(e.target.value)}>
              <option value="filtrados">Mostrar todos los partidos filtrados ({sorted.length})</option>
              <option value="seleccionados">Mostrar solo los seleccionados ({selectedCount})</option>
            </select>
          )}
          <span className="text-xs text-[#7A8FBE]">{sorted.length} partido(s){selectedCount > 0 ? ` · ${selectedCount} seleccionado(s)` : ""}</span>
          {selectedCount > 0 && (
            <button onClick={() => setSelected({})} className="text-xs text-[#9FB0D0] hover:text-[#EDE7D6] underline">Limpiar selección</button>
          )}
          <div className="ml-auto flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-[#7A8FBE]">Imprimir / PDF:</span>
            <button
              onClick={() => imprimir(true)}
              disabled={gridMatches.length === 0}
              className="flex items-center gap-1.5 text-sm bg-[#163A67] border border-[#2A4E85] px-3 py-1.5 rounded-lg hover:bg-[#0C2043] disabled:opacity-50"
              title="Abre el diálogo de impresión con el fixture filtrado, con día/hora/cancha. Desde ahí se puede 'Guardar como PDF'."
            >
              <Printer className="w-4 h-4" /> Con horario
            </button>
            <button
              onClick={() => imprimir(false)}
              disabled={gridMatches.length === 0}
              className="flex items-center gap-1.5 text-sm bg-[#163A67] border border-[#2A4E85] px-3 py-1.5 rounded-lg hover:bg-[#0C2043] disabled:opacity-50"
              title="Igual, pero sin columnas de día/hora/cancha -- para repartir el cruce de partidos sin revelar el horario todavía."
            >
              <Printer className="w-4 h-4" /> Sin horario
            </button>
            <button
              onClick={exportar}
              disabled={exporting || gridMatches.length === 0}
              className="flex items-center gap-1.5 text-sm bg-[#163A67] border border-[#2A4E85] px-3 py-1.5 rounded-lg hover:bg-[#0C2043] disabled:opacity-50"
              title="Genera un .xlsx con colores por categoría (abre en Excel y en Google Sheets). Filtrá por disciplina y categoría arriba para bajar solo esa actividad -- la hoja 'Listado' trae Equipo A/B con columnas Resultado y Ganador en blanco, listas para completar y subir a la página del evento."
            >
              <Download className="w-4 h-4" /> {exporting ? "Generando…" : `Descargar Excel (${gridMatches.length})`}
            </button>
          </div>
        </div>
        {viewMode !== "lista" && <CategoryLegend matches={gridMatches} colors={colors} />}
        {viewMode === "cancha" && <CourtGrid matches={gridMatches} colors={colors} />}
        {viewMode === "agenda" && <AgendaGrid matches={gridMatches} colors={colors} />}
        {viewMode === "lista" && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#9FB0D0] border-b border-[#21426E]">
                <th className="py-2 pr-2 w-6">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => setSelected(e.target.checked ? Object.fromEntries(sorted.map((m) => [m.id, true])) : {})}
                    title="Seleccionar todos los partidos visibles"
                  />
                </th>
                <th className="py-2 pr-3">Día</th><th className="py-2 pr-3">Hora</th><th className="py-2 pr-3">Disciplina</th>
                <th className="py-2 pr-3">Sede</th><th className="py-2 pr-3">Cancha</th>
                <th className="py-2 pr-3">Categoría</th><th className="py-2 pr-3">Etapa</th><th className="py-2 pr-3">Partido</th>
                <th className="py-2 pr-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const inConflict = visibleConflicts.some((c) => c.m1.id === m.id || c.m2.id === m.id);
                return (
                  <tr key={m.id} className={`border-b border-[#12294C] ${inConflict ? "bg-[#3A241F]" : ""}`}>
                    <td className="py-1.5 pr-2">
                      <input type="checkbox" checked={!!selected[m.id]} onChange={(e) => setSelected((prev) => ({ ...prev, [m.id]: e.target.checked }))} />
                    </td>
                    <td className="py-1.5 pr-3 font-mono">{DAY_LABEL[m.day] || m.day}</td>
                    <td className="py-1.5 pr-3 font-mono">{m.time}</td>
                    <td className="py-1.5 pr-3">{m.disciplineName}</td>
                    <td className="py-1.5 pr-3 text-[#9FB0D0]">{m.location || "—"}</td>
                    <td className="py-1.5 pr-3">{m.court}</td>
                    <td className="py-1.5 pr-3">
                      <span className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-middle" style={{ background: (colors[catKeyOf(m)] || {}).bg }} />
                      {m.categoryName}
                    </td>
                    <td className="py-1.5 pr-3">{m.stage}</td>
                    <td className="py-1.5 pr-3">{m.bye ? `${m.teamA || "?"} vs BYE` : matchLabel(m)}</td>
                    <td className="py-1.5 pr-3">
                      {isReal(m) ? (
                        <ReprogramarControl match={m} onSaved={load} />
                      ) : (
                        <span className="text-xs text-[#7A8FBE]">Horario fijo (disciplina individual)</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={10} className="py-6 text-center text-[#7A8FBE]">Todavía no hay partidos sorteados y programados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </Card>
      {toast && <div className="fixed bottom-5 right-5 bg-[#2FD3C4] text-[#0C2043] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">{toast}</div>}
    </div>

      {/* Solo se ve al imprimir (ver .print-only en globals.css) -- la tabla
          interactiva de arriba se oculta con no-print. Respeta los mismos
          filtros/selección que el Excel (gridMatches). */}
      <div className="print-only">
        <h1 className="text-lg font-bold mb-3 text-black">Fixture — Jornadas Deportivas Necochea 2026</h1>
        <table className="w-full text-xs text-black border-collapse">
          <thead>
            <tr className="text-left border-b-2 border-black">
              {printWithSchedule && <th className="py-1 pr-3">Día</th>}
              {printWithSchedule && <th className="py-1 pr-3">Hora</th>}
              <th className="py-1 pr-3">Disciplina</th>
              {printWithSchedule && <th className="py-1 pr-3">Sede</th>}
              {printWithSchedule && <th className="py-1 pr-3">Cancha</th>}
              <th className="py-1 pr-3">Categoría</th>
              <th className="py-1 pr-3">Etapa</th>
              <th className="py-1 pr-3">Partido</th>
            </tr>
          </thead>
          <tbody>
            {gridMatches.map((m) => (
              <tr key={m.id} className="border-b border-gray-400">
                {printWithSchedule && <td className="py-1 pr-3">{DAY_LABEL[m.day] || m.day || "—"}</td>}
                {printWithSchedule && <td className="py-1 pr-3">{m.time || "—"}</td>}
                <td className="py-1 pr-3">{m.disciplineName}</td>
                {printWithSchedule && <td className="py-1 pr-3">{m.location || "—"}</td>}
                {printWithSchedule && <td className="py-1 pr-3">{m.court || "—"}</td>}
                <td className="py-1 pr-3">{m.categoryName}</td>
                <td className="py-1 pr-3">{m.stage}</td>
                <td className="py-1 pr-3">{m.bye ? `${m.teamA || "?"} vs BYE` : matchLabel(m)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
