"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, Medal } from "lucide-react";
import Card from "../../../components/Card";
import SelectorBar from "../../../components/SelectorBar";

const COPA_ORO_PLATA_DISCIPLINES = ["futbolReducido", "basquet", "voley", "hockey"];
const COPA_ORO_PLATA_MIN_EQUIPOS = 12;

export default function InscripcionesPage() {
  const [disciplines, setDisciplines] = useState([]);
  const [departamentales, setDepartamentales] = useState([]);
  const [selDiscipline, setSelDiscipline] = useState("");
  const [selCategory, setSelCategory] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSplit, setShowSplit] = useState(false);
  const [oroPicks, setOroPicks] = useState({});
  const [toast, setToast] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 3600); }

  async function loadAll() {
    const [dRes, depRes] = await Promise.all([fetch("/api/disciplinas"), fetch("/api/departamentales")]);
    const dData = await dRes.json();
    const depData = await depRes.json();
    setDisciplines(dData.disciplines || []);
    setDepartamentales(depData.departamentales || []);
    return dData.disciplines || [];
  }

  useEffect(() => {
    (async () => {
      const disc = await loadAll();
      if (disc[0]) {
        setSelDiscipline(disc[0].id);
        setSelCategory(disc[0].categories[0]?.id || "");
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selCategory) return;
    setShowSplit(false);
    setOroPicks({});
    fetch(`/api/categorias/${selCategory}/team-entries`).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }, [selCategory]);

  const discipline = disciplines.find((d) => d.id === selDiscipline);
  const category = discipline?.categories.find((c) => c.id === selCategory);

  const distinctDepts = new Set(entries.map((e) => e.departamentalId)).size;
  const elegibleParaCopas =
    discipline && COPA_ORO_PLATA_DISCIPLINES.includes(discipline.id) &&
    !category?.copa &&
    distinctDepts >= COPA_ORO_PLATA_MIN_EQUIPOS;

  async function confirmarDivision() {
    const oroIds = Object.keys(oroPicks).filter((id) => oroPicks[id]);
    if (oroIds.length === 0) {
      showToast("Elegí al menos una departamental para la Copa de Oro.");
      return;
    }
    const res = await fetch(`/api/categorias/${selCategory}/dividir-copas`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oroDepartamentalIds: oroIds }),
    });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || "No se pudo dividir la categoría."); return; }
    showToast("Categoría dividida en Copa de Oro y Copa de Plata.");
    await loadAll();
    setSelCategory(data.oro.id);
    setShowSplit(false);
  }

  async function toggleDept(departamentalId) {
    const res = await fetch(`/api/categorias/${selCategory}/team-entries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", departamentalId }),
    });
    const d = await res.json();
    setEntries(d.entries || []);
  }
  async function addExtra(departamentalId) {
    const res = await fetch(`/api/categorias/${selCategory}/team-entries`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "addExtra", departamentalId }),
    });
    const d = await res.json();
    setEntries(d.entries || []);
  }
  async function removeEntry(entryId) {
    const res = await fetch(`/api/categorias/${selCategory}/team-entries?entryId=${entryId}`, { method: "DELETE" });
    const d = await res.json();
    setEntries(d.entries || []);
  }

  function teamLabel(entry) {
    const count = entries.filter((e) => e.dept === entry.dept).length;
    return count > 1 ? `${entry.dept} ${entry.num}` : entry.dept;
  }

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;
  if (!discipline || !category) return <p className="text-[#9FB0D0] text-sm">No hay disciplinas cargadas.</p>;

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
      {category?.copa && (
        <Card className="p-4 mb-5 border-[#2FD3C4] flex items-center gap-2">
          <Medal className="w-4 h-4 text-[#2FD3C4]" />
          <p className="text-sm">
            Esta es la <strong>Copa {category.copa === "oro" ? "de Oro" : "de Plata"}</strong>, surgida de dividir una categoría
            que llegó a {COPA_ORO_PLATA_MIN_EQUIPOS} equipos o más (Art. de Copa Oro/Plata del reglamento).
          </p>
        </Card>
      )}

      {elegibleParaCopas && !showSplit && (
        <Card className="p-4 mb-5 border-[#E0C15A] flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm flex items-center gap-2">
            <Medal className="w-4 h-4 text-[#E0C15A]" />
            Esta categoría llegó a {distinctDepts} equipos — según el reglamento corresponde dividirla en Copa de Oro y Copa de Plata.
          </p>
          <button onClick={() => setShowSplit(true)} className="text-xs bg-[#E0C15A] text-[#132A4C] font-semibold px-3 py-2 rounded-lg">
            Definir la división
          </button>
        </Card>
      )}

      {elegibleParaCopas && showSplit && (
        <Card className="p-5 mb-5 border-[#E0C15A]">
          <h3 className="font-bold mb-2">Definir Copa de Oro / Copa de Plata</h3>
          <p className="text-xs text-[#7A8FBE] mb-3">
            Tildá las departamentales que van a la Copa de Oro (según historial y desempeño, a criterio de la Comisión).
            El resto queda en la Copa de Plata.
          </p>
          <div className="grid sm:grid-cols-2 gap-1.5 mb-4 max-h-[320px] overflow-y-auto pr-1">
            {[...new Set(entries.map((e) => e.departamentalId))].map((depId) => {
              const dep = departamentales.find((d) => d.id === depId);
              return (
                <label key={depId} className="flex items-center gap-2 text-sm bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!oroPicks[depId]}
                    onChange={(e) => setOroPicks((prev) => ({ ...prev, [depId]: e.target.checked }))}
                  />
                  {dep?.name || depId}
                </label>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button onClick={confirmarDivision} className="bg-[#E0C15A] text-[#132A4C] text-sm font-semibold px-4 py-2 rounded-lg">
              Confirmar división
            </button>
            <button onClick={() => setShowSplit(false)} className="bg-[#163A67] border border-[#2A4E85] text-sm px-4 py-2 rounded-lg">
              Cancelar
            </button>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-5">
          <h3 className="font-bold mb-3">Departamentales</h3>
          <p className="text-xs text-[#7A8FBE] mb-3">
            Tildá quiénes participan en {category.name} ({discipline.name}).
            {category.max_teams > 1 && ` Esta categoría admite hasta ${category.max_teams} equipos por departamental.`}
          </p>
          <div className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
            {departamentales.map((dep) => {
              const depEntries = entries.filter((e) => e.departamentalId === dep.id);
              const checked = depEntries.length > 0;
              return (
                <div key={dep.id} className={`border rounded-lg px-3 py-2 text-sm ${checked ? "border-[#2FD3C4] bg-[#2A2410]" : "border-[#21426E]"}`}>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 flex-1 cursor-pointer">
                      <input type="checkbox" checked={checked} onChange={() => toggleDept(dep.id)} />
                      {dep.name}
                    </label>
                    {checked && category.max_teams > 1 && depEntries.length < category.max_teams && (
                      <button onClick={() => addExtra(dep.id)} className="text-xs text-[#2FD3C4] hover:underline">+1 equipo</button>
                    )}
                  </div>
                  {checked && depEntries.length > 1 && (
                    <p className="text-xs text-[#7A8FBE] mt-1 ml-6">{depEntries.length} equipos inscriptos</p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-bold mb-3">Inscriptos ({entries.length})</h3>
          {entries.length === 0 ? (
            <p className="text-sm text-[#7A8FBE]">Todavía no hay nadie inscripto en esta categoría.</p>
          ) : (
            <ul className="space-y-1.5">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-2 bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-1.5 text-sm">
                  <span className="flex-1">{teamLabel(e)}</span>
                  <button onClick={() => removeEntry(e.id)} className="text-[#7A8FBE] hover:text-[#E0684A]"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {toast && <div className="fixed bottom-5 right-5 bg-[#2FD3C4] text-[#0C2043] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">{toast}</div>}
    </SelectorBar>
  );
}
