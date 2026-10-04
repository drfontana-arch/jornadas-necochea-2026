"use client";
import { useEffect, useState } from "react";
import { ChevronUp, ChevronDown, X, AlertTriangle } from "lucide-react";
import Card from "../../../components/Card";
import SelectorBar from "../../../components/SelectorBar";
import { baseDept } from "../../../lib/sorteoLogic";

export default function AntecedentesPage() {
  const [disciplines, setDisciplines] = useState([]);
  const [selDiscipline, setSelDiscipline] = useState("");
  const [selCategory, setSelCategory] = useState("");
  const [entries, setEntries] = useState([]);
  const [participants, setParticipants] = useState([]);
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
      const [entRes, partRes, catRes] = await Promise.all([
        fetch(`/api/categorias/${selCategory}/team-entries`),
        fetch(`/api/categorias/${selCategory}/participantes`),
        fetch(`/api/categorias/${selCategory}`),
      ]);
      const entData = await entRes.json();
      const partData = await partRes.json();
      const catData = await catRes.json();
      setEntries(entData.entries || []);
      setParticipants(partData.participants || []);
      setSeedOrder(catData.category?.seed_order || []);
    })();
  }, [selCategory]);

  const discipline = disciplines.find((d) => d.id === selDiscipline);
  const category = discipline?.categories.find((c) => c.id === selCategory);

  function teamLabel(entry) {
    const count = entries.filter((e) => e.dept === entry.dept).length;
    return count > 1 ? `${entry.dept} ${entry.num}` : entry.dept;
  }
  // Igual que en Sorteo: si no hay equipos/parejas cargados pero sí
  // personas inscriptas sueltas (Ajedrez, Tenis Singles, etc.), se ordenan
  // esas personas en vez de mostrar la lista vacía.
  const registeredLabels = entries.length > 0 ? entries.map(teamLabel) : participants.map((p) => `${p.fullName} (${p.departamental})`);

  async function persistSeedOrder(next) {
    setSeedOrder(next);
    await fetch(`/api/categorias/${selCategory}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed_order: next }),
    });
  }

  // ¿Ya hay en la siembra otro equipo/pareja de la MISMA departamental que
  // `label`? Pasa, por ejemplo, en Tenis/Pádel en parejas: si una
  // departamental anotó dos parejas este año ("Quilmes 1" y "Quilmes 2"),
  // el antecedente del año pasado (ej. "Quilmes salió campeón") le
  // corresponde a UNA sola de las dos, no a ambas -- agregar las dos por
  // error le da ventaja de siembra a gente que en realidad no la tiene.
  function seedDeptClash(label, list) {
    const dept = baseDept(label);
    return list.find((l) => l !== label && baseDept(l) === dept);
  }

  function moveSeed(label, dir) {
    const list = seedOrder.filter((l) => registeredLabels.includes(l));
    const full = [...list];
    const idx = full.indexOf(label);
    if (idx === -1) {
      const clash = seedDeptClash(label, full);
      if (clash) {
        const ok = confirm(
          `"${clash}" (misma departamental) ya está en la siembra.\n\n` +
          `Si esta departamental anotó más de un equipo/pareja este año, el antecedente del año pasado le corresponde a UNO solo -- agregar los dos le da una ventaja de siembra que en realidad no tiene.\n\n` +
          `¿Agregar "${label}" igual?`
        );
        if (!ok) return;
      }
      persistSeedOrder([...full, label]);
      return;
    }
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
    let deptDuplicates = 0;
    lines.forEach((line) => {
      const found = registeredLabels.find(
        (l) => l.toLowerCase() === line.toLowerCase()
      );
      if (!found || matched.includes(found)) return;
      if (seedDeptClash(found, matched)) { deptDuplicates++; return; }
      matched.push(found);
    });
    persistSeedOrder(matched);
    showToast(
      `Se reconocieron ${matched.length} de ${lines.length} líneas pegadas.` +
      (deptDuplicates > 0 ? ` ${deptDuplicates} se ignoraron por ser una segunda entrada de una departamental que ya estaba en la lista.` : "")
    );
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
              {seeded.map((label, i) => {
                const clash = seedDeptClash(label, seeded);
                return (
                  <li key={label} className={`flex items-center gap-2 border rounded-lg px-3 py-1.5 text-sm ${clash ? "bg-[#3A241F] border-[#5C3A32]" : "bg-[#0C2043] border-[#21426E]"}`}>
                    <span className="font-mono text-[#2FD3C4] font-semibold w-5">{i + 1}</span>
                    <span className="flex-1">{label}</span>
                    {clash && (
                      <span title={`"${clash}" es de la misma departamental y también está en la siembra -- revisá si de verdad corresponden los dos.`}>
                        <AlertTriangle className="w-4 h-4 text-[#E0684A]" />
                      </span>
                    )}
                    <button onClick={() => moveSeed(label, -1)} className="text-[#9FB0D0]"><ChevronUp className="w-4 h-4" /></button>
                    <button onClick={() => moveSeed(label, 1)} className="text-[#9FB0D0]"><ChevronDown className="w-4 h-4" /></button>
                    <button onClick={() => removeSeed(label)} className="text-[#7A8FBE] hover:text-[#E0684A]"><X className="w-4 h-4" /></button>
                  </li>
                );
              })}
            </ol>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#9FB0D0] mb-2">Sin antecedente</p>
            <ul className="space-y-1.5">
              {unseeded.map((label) => (
                <li key={label} className="flex items-center gap-2 bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-1.5 text-sm">
                  <span className="flex-1">{label}</span>
                  <button onClick={() => moveSeed(label, 0)} className="text-xs text-[#2FD3C4] hover:underline">Agregar a la siembra</button>
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
            <button onClick={parsePaste} className="mt-2 flex items-center gap-1.5 bg-[#2FD3C4] text-[#0C2043] text-sm px-3 py-2 rounded-lg hover:bg-[#1E9C90]">
              Aplicar orden pegado
            </button>
          </div>
        </div>
      </Card>
      {toast && (
        <div className="fixed bottom-5 right-5 bg-[#2FD3C4] text-[#0C2043] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">{toast}</div>
      )}
    </SelectorBar>
  );
}
