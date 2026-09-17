"use client";
import { useEffect, useState } from "react";
import { Shuffle, RefreshCw } from "lucide-react";
import Card from "../../../components/Card";
import SelectorBar from "../../../components/SelectorBar";

const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };
function groupLetter(i) { return String.fromCharCode(65 + i); }

export default function SorteoPage() {
  const [disciplines, setDisciplines] = useState([]);
  const [selDiscipline, setSelDiscipline] = useState("");
  const [selCategory, setSelCategory] = useState("");
  const [category, setCategory] = useState(null);
  const [entries, setEntries] = useState([]);
  const [matches, setMatches] = useState({ groupMatches: [], playoffMatches: [], drawMatches: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

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
    const [catRes, entRes, matchRes] = await Promise.all([
      fetch(`/api/categorias/${selCategory}`),
      fetch(`/api/categorias/${selCategory}/team-entries`),
      fetch(`/api/categorias/${selCategory}/matches`),
    ]);
    setCategory((await catRes.json()).category);
    setEntries((await entRes.json()).entries || []);
    setMatches(await matchRes.json());
  }
  useEffect(() => { loadCategoryData(); }, [selCategory]);

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
    try {
      const res = await fetch(`/api/categorias/${selCategory}/sorteo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "No se pudo sortear."); return; }
      showToast(
        data.unresolved > 0
          ? `Sorteo generado. No se pudieron evitar ${data.unresolved} superposición(es) — revisalas en "Fixture y conflictos".`
          : "Sorteo generado sin superposiciones detectadas."
      );
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
    try {
      const res = await fetch(`/api/categorias/${selCategory}/playoff`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || "No se pudo generar el playoff."); return; }
      showToast(
        data.unresolved > 0
          ? `Llave de playoff generada. No se pudieron evitar ${data.unresolved} superposición(es).`
          : "Llave de playoff generada, sin superposiciones."
      );
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
  const registeredLabels = entries.map(teamLabel);

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
          </div>
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
              <a href={`/poster/${selCategory}`} target="_blank" rel="noreferrer" className="text-sm text-[#2FD3C4] hover:underline">
                Ver póster / imprimir →
              </a>
            )}
          </div>
        </Card>

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

        {category.modality === "grupos_playoff" && category.groups && (
          <Card className="p-5">
            <h3 className="font-bold mb-3">Posiciones finales de grupo</h3>
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              {category.groups.map((g, gi) => (
                <div key={gi} className="border border-[#21426E] rounded-lg p-3">
                  <p className="font-semibold text-sm mb-2">Grupo {groupLetter(gi)}</p>
                  {Array.from({ length: category.advance_per_group }, (_, r) => (
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
            <button onClick={generatePlayoff} disabled={busy} className="flex items-center gap-2 bg-[#0C2043] text-[#2FD3C4] text-sm px-4 py-2.5 rounded-lg hover:brightness-95">
              <RefreshCw className="w-4 h-4" /> Generar llave de playoff
            </button>
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
