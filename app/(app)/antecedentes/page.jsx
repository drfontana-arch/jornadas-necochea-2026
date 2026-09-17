"use client";
import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, X } from "lucide-react";
import Card from "../../../components/Card";
import SelectorBar from "../../../components/SelectorBar";

export default function AntecedentesPage() {
  const [disciplines, setDisciplines] = useState([]);
  const [selDiscipline, setSelDiscipline] = useState("");
  const [selCategory, setSelCategory] = useState("");
  const [entries, setEntries] = useState([]);
  const [seedOrder, setSeedOrder] = useState([]);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(null), 2600); }

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

  useEffect(() => {
    if (!selCategory) return;
    (async () => {
      const [entRes, catRes] = await Promise.all([
        fetch(`/api/categorias/${selCategory}/team-entries`),
        fetch(`/api/categorias/${selCategory}`),
      ]);
      const entData = await entRes.json();
      const catData = await catRes.json();
      setEntries(entData.entries || []);
      setSeedOrder(catData.category?.seed_order || []);
    })();
  }, [selCategory]);

  const discipline = disciplines.find((d) => d.id === selDiscipline);
  const category = discipline?.categories.find((c) => c.id === selCategory);

  function teamLabel(entry) {
    const count = entries.filter((e) => e.dept === entry.dept).length;
    return count > 1 ? `${entry.dept} ${entry.num}` : entry.dept;
  }
  const registeredLabels = entries.map(teamLabel);

  async function persistSeedOrder(next) {
    setSeedOrder(next);
    await fetch(`/api/categorias/${selCategory}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed_order: next }),
    });
  }

  function moveSeed(label, dir) {
    const list = seedOrder.filter((l) => registeredLabels.includes(l));
    const others = registeredLabels.filter((l) => !list.includes(l));
    const full = [...list];
    const idx = full.indexOf(label);
    if (idx === -1) { persistSeedOrder([...full, label]); return; }
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= full.length) return;
    [full[idx], full[newIdx]] = [full[newIdx], full[idx]];
    persistSeedOrder(full);
  }
  function removeSeed(label) {
    persistSeedOrder(seedOrder.filter((l) => l !== label));
  }
  function parsePaste() {
    const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const matched = [];
    lines.forEach((line) => {
      const found = registeredLabels.find(
        (l) => l.toLowerCase() === line.toLowerCase()
      );
      if (found && !matched.includes(found)) matched.push(found);
    });
    persistSeedOrder(matched);
    showToast(`Se reconocieron ${matched.length} de ${lines.length} líneas pegadas.`);
  }

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;
  if (!discipline || !category) return <p className="text-[#9FB0D0] text-sm">No hay disciplinas cargadas.</p>;

  const seeded = seedOrder.filter((l) => registeredLabels.includes(l));
  const unseeded = registeredLabels.filter((l) => !seeded.includes(l));

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
      <Card className="p-5">
        <p className="text-sm text-[#9FB0D0] mb-4">
          Ordená los equipos con antecedente (mejor a peor). Sirve para "sembrar" el sorteo y que no se crucen
          en la primera ronda. Los que no tengan antecedente quedan en orden aleatorio al sortear.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-2">Orden de siembra actual</p>
            {seeded.length === 0 && <p className="text-sm text-[#7A8FBE] mb-2">Sin antecedentes cargados aún.</p>}
            <ol className="space-y-1.5 mb-4">
              {seeded.map((label, i) => (
                <li key={label} className="flex items-center gap-2 bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-1.5 text-sm">
                  <span className="font-mono text-[#C9A227] font-semibold w-5">{i + 1}</span>
                  <span className="flex-1">{label}</span>
                  <button onClick={() => moveSeed(label, -1)} className="text-[#9FB0D0]"><ChevronUp className="w-4 h-4" /></button>
                  <button onClick={() => moveSeed(label, 1)} className="text-[#9FB0D0]"><ChevronDown className="w-4 h-4" /></button>
                  <button onClick={() => removeSeed(label)} className="text-[#7A8FBE] hover:text-[#E0684A]"><X className="w-4 h-4" /></button>
                </li>
              ))}
            </ol>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-2">Sin antecedente</p>
            <ul className="space-y-1.5">
              {unseeded.map((label) => (
                <li key={label} className="flex items-center gap-2 bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-1.5 text-sm">
                  <span className="flex-1">{label}</span>
                  <button onClick={() => moveSeed(label, 0)} className="text-xs text-[#C9A227] hover:underline">Agregar a la siembra</button>
                </li>
              ))}
              {unseeded.length === 0 && <li className="text-sm text-[#7A8FBE]">—</li>}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-2">
              Pegar orden (uno por línea, mejor a peor)
            </p>
            <textarea
              className="w-full bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-2 text-sm h-40"
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"Necochea\nMar del Plata\nLa Plata"}
            />
            <button onClick={parsePaste} className="mt-2 flex items-center gap-1.5 bg-[#C9A227] text-[#0C2043] text-sm px-3 py-2 rounded-lg hover:bg-[#A9841C]">
              Aplicar orden pegado
            </button>
          </div>
        </div>
      </Card>
      {toast && (
        <div className="fixed bottom-5 right-5 bg-[#C9A227] text-[#0C2043] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">{toast}</div>
      )}
    </SelectorBar>
  );
}
