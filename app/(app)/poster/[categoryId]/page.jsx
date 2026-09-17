"use client";
import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import BracketSVG from "../../../../components/BracketSVG";

const DAY_LABEL = { "2026-10-09": "Viernes 09/10", "2026-10-10": "Sábado 10/10", "2026-10-11": "Domingo 11/10" };
const NAVY = "#1B3D6D";

function groupLetter(i) { return String.fromCharCode(65 + i); }

export default function PosterPage({ params }) {
  const categoryId = params.categoryId;
  const [category, setCategory] = useState(null);
  const [matches, setMatches] = useState({ groupMatches: [], playoffMatches: [], drawMatches: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [catRes, mRes] = await Promise.all([
        fetch(`/api/categorias/${categoryId}`),
        fetch(`/api/categorias/${categoryId}/matches`),
      ]);
      setCategory((await catRes.json()).category);
      setMatches(await mRes.json());
      setLoading(false);
    })();
  }, [categoryId]);

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;
  if (!category) return <p className="text-[#9FB0D0] text-sm">Categoría no encontrada.</p>;

  const title = `${category.disciplines.name} — ${category.name}`;

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

      <div id="poster" className="bg-white text-[#0F274A] rounded-lg p-10 mx-auto" style={{ maxWidth: 1400 }}>
        <div className="text-center mb-8 pb-6" style={{ borderBottom: `3px solid ${NAVY}` }}>
          <p className="text-xs tracking-[0.3em] uppercase font-semibold" style={{ color: NAVY }}>
            Colegio de Magistrados y Funcionarios · Provincia de Buenos Aires
          </p>
          <h1 className="text-3xl font-bold mt-2" style={{ color: "#0F274A", fontFamily: "Georgia, serif" }}>
            Jornadas Deportivas Interdepartamentales — Necochea 2026
          </h1>
          <h2 className="text-xl font-semibold mt-3" style={{ color: NAVY }}>{title}</h2>
        </div>

        {matches.groupMatches.length > 0 && (
          <div className="mb-10">
            <h3 className="text-lg font-bold mb-4" style={{ color: NAVY }}>Fase de grupos</h3>
            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {(category.groups || []).map((g, gi) => (
                <div key={gi} className="border rounded-lg overflow-hidden" style={{ borderColor: NAVY }}>
                  <div className="px-4 py-2 font-bold text-white" style={{ backgroundColor: NAVY }}>Grupo {groupLetter(gi)}</div>
                  <ul className="text-sm">
                    {g.map((t) => <li key={t} className="px-4 py-1.5 border-t" style={{ borderColor: "#DDE3EC" }}>{t}</li>)}
                  </ul>
                </div>
              ))}
            </div>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr style={{ backgroundColor: "#EEF2F8" }}>
                  <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Grupo</th>
                  <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Partido</th>
                  <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Día</th>
                  <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Hora</th>
                  <th className="text-left p-2 border" style={{ borderColor: "#DDE3EC" }}>Cancha</th>
                </tr>
              </thead>
              <tbody>
                {matches.groupMatches
                  .slice()
                  .sort((a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || ""))
                  .map((m) => (
                    <tr key={m.id}>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.groupLabel}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.teamA} vs {m.teamB}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{DAY_LABEL[m.day] || m.day || "—"}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.time || "—"}</td>
                      <td className="p-2 border" style={{ borderColor: "#DDE3EC" }}>{m.court || "—"}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}

        {matches.playoffMatches.length > 0 && (
          <div className="mb-10">
            <h3 className="text-lg font-bold mb-4" style={{ color: NAVY }}>Playoff</h3>
            <BracketSVG matches={matches.playoffMatches} title="" />
          </div>
        )}

        {matches.drawMatches.length > 0 && (
          <div>
            <BracketSVG matches={matches.drawMatches} title={category.modality === "draw" ? "Llave" : ""} />
          </div>
        )}

        {matches.groupMatches.length === 0 && matches.playoffMatches.length === 0 && matches.drawMatches.length === 0 && (
          <p className="text-center text-[#5A6B85] py-10">Esta categoría todavía no tiene sorteo cargado.</p>
        )}
      </div>
      <style jsx global>{`
        @media print {
          @page { size: A1 landscape; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}
