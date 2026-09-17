"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";

const DAYS = ["2026-10-09", "2026-10-10", "2026-10-11"];
const DAY_LABEL = { "2026-10-09": "Viernes 9 de octubre", "2026-10-10": "Sábado 10 de octubre", "2026-10-11": "Domingo 11 de octubre" };
const NAVY = "#1B3D6D";

export default function PosterDiaPage({ params }) {
  const day = params.day;
  const [matches, setMatches] = useState([]);
  const [disciplines, setDisciplines] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [mRes, dRes] = await Promise.all([fetch("/api/matches"), fetch("/api/disciplinas")]);
      const mData = await mRes.json();
      const dData = await dRes.json();
      setMatches((mData.matches || []).filter((m) => m.day === day));
      setDisciplines(dData.disciplines || []);
      setLoading(false);
    })();
  }, [day]);

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;

  // sede aproximada: primera venue de esa disciplina para ese día
  function sedeFor(disciplineId) {
    const d = disciplines.find((x) => x.id === disciplineId);
    if (!d) return "";
    const v = d.venues.find((v) => v.day === day);
    return v?.location || "";
  }

  const sorted = matches.slice().sort((a, b) => (a.time || "").localeCompare(b.time || "") || (a.disciplineName || "").localeCompare(b.disciplineName || ""));
  const porDisciplina = {};
  sorted.forEach((m) => {
    if (!porDisciplina[m.disciplineName]) porDisciplina[m.disciplineName] = [];
    porDisciplina[m.disciplineName].push(m);
  });

  return (
    <div>
      <div className="no-print flex justify-end mb-4">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#2FD3C4] text-[#0C2043] text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer className="w-4 h-4" /> Imprimir / exportar PDF
        </button>
      </div>

      <div className="bg-white text-[#0F274A] rounded-lg p-10 mx-auto" style={{ maxWidth: 1200 }}>
        <div className="text-center mb-8 pb-6" style={{ borderBottom: `3px solid ${NAVY}` }}>
          <p className="text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: NAVY }}>
            Colegio de Magistrados y Funcionarios · Provincia de Buenos Aires
          </p>
          <h1 className="text-3xl font-bold mt-2" style={{ color: "#0F274A", fontFamily: "Georgia, serif" }}>
            Jornadas Deportivas Interdepartamentales — Necochea 2026
          </h1>
          <h2 className="text-xl font-semibold mt-3" style={{ color: NAVY }}>Cronograma — {DAY_LABEL[day] || day}</h2>
        </div>

        {Object.keys(porDisciplina).length === 0 ? (
          <p className="text-center text-[#5A6B85] py-10">Todavía no hay partidos programados para este día.</p>
        ) : (
          Object.entries(porDisciplina).map(([discName, ms]) => (
            <div key={discName} className="mb-8">
              <h3 className="text-base font-bold mb-2 px-3 py-1.5 text-white" style={{ backgroundColor: NAVY }}>
                {discName}{sedeFor(ms[0].disciplineId) ? ` — ${sedeFor(ms[0].disciplineId)}` : ""}
              </h3>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ backgroundColor: "#EEF2F8" }}>
                    <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Hora</th>
                    <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Categoría</th>
                    <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Etapa</th>
                    <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Partido</th>
                    <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Cancha</th>
                  </tr>
                </thead>
                <tbody>
                  {ms.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2 border font-mono" style={{ borderColor: "#DDE3EC" }}>{m.time}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.categoryName}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.stage}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.teamA || "?"} vs {m.bye ? "BYE" : m.teamB || "?"}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.court}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A1 portrait; margin: 12mm; }
        }
      `}</style>
    </div>
  );
}
