"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Card from "../../../components/Card";
import SelectorBar from "../../../components/SelectorBar";

export default function InscripcionesPage() {
  const [disciplines, setDisciplines] = useState([]);
  const [departamentales, setDepartamentales] = useState([]);
  const [selDiscipline, setSelDiscipline] = useState("");
  const [selCategory, setSelCategory] = useState("");
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [dRes, depRes] = await Promise.all([fetch("/api/disciplinas"), fetch("/api/departamentales")]);
      const dData = await dRes.json();
      const depData = await depRes.json();
      setDisciplines(dData.disciplines || []);
      setDepartamentales(depData.departamentales || []);
      if (dData.disciplines?.[0]) {
        setSelDiscipline(dData.disciplines[0].id);
        setSelCategory(dData.disciplines[0].categories[0]?.id || "");
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selCategory) return;
    fetch(`/api/categorias/${selCategory}/team-entries`).then((r) => r.json()).then((d) => setEntries(d.entries || []));
  }, [selCategory]);

  const discipline = disciplines.find((d) => d.id === selDiscipline);
  const category = discipline?.categories.find((c) => c.id === selCategory);

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
    </SelectorBar>
  );
}
