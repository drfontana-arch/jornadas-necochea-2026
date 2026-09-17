"use client";
import { useEffect, useRef, useState } from "react";
import { Printer, Download } from "lucide-react";
import PosterSVG from "../../../../components/PosterSVG";

export default function PosterPage({ params }) {
  const categoryId = params.categoryId;
  const [category, setCategory] = useState(null);
  const [matches, setMatches] = useState({ groupMatches: [], playoffMatches: [], drawMatches: [] });
  const [loading, setLoading] = useState(true);
  const svgRef = useRef(null);

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

  function descargarSVG() {
    if (!svgRef.current) return;
    const svgEl = svgRef.current;
    const clone = svgEl.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const viewBox = clone.getAttribute("viewBox");
    if (viewBox) {
      const parts = viewBox.split(/\s+/).map(Number);
      if (parts.length === 4) {
        clone.setAttribute("width", String(parts[2]));
        clone.setAttribute("height", String(parts[3]));
      }
    }
    clone.removeAttribute("style");
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(clone);
    if (!source.startsWith("<?xml")) {
      source = '<?xml version="1.0" standalone="no"?>\r\n' + source;
    }
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = (category ? `${category.disciplines.name}-${category.name}` : "poster")
      .toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-");
    a.download = `${safeName}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;
  if (!category) return <p className="text-[#9FB0D0] text-sm">Categoría no encontrada.</p>;

  return (
    <div>
      <div className="no-print flex justify-end gap-3 mb-4">
        <button
          onClick={descargarSVG}
          className="flex items-center gap-2 bg-[#163A67] border border-[#2A4E85] text-[#EDE7D6] text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Download className="w-4 h-4" /> Descargar SVG (para imprenta)
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#2FD3C4] text-[#0C2043] text-sm font-semibold px-4 py-2 rounded-lg"
        >
          <Printer className="w-4 h-4" /> Imprimir / exportar PDF
        </button>
      </div>

      <div id="poster" className="bg-white rounded-lg p-6 mx-auto print:max-w-none print:p-0 print:m-0 print:w-full" style={{ maxWidth: 1450 }}>
        <PosterSVG category={category} matches={matches} forwardedRef={svgRef} />
      </div>

      <style jsx global>{`
        @media print {
          @page { size: A1 landscape; margin: 10mm; }
          #poster { max-width: none !important; }
        }
      `}</style>
    </div>
  );
}
