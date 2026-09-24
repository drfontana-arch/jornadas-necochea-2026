"use client";
import { useState } from "react";
import { UploadCloud, AlertTriangle, FileWarning, CheckCircle2 } from "lucide-react";
import Card from "../../../components/Card";

export default function BaseDatosPage() {
  const [fileName, setFileName] = useState("");
  const [csvText, setCsvText] = useState("");
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(null);
    setResult(null);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsvText(String(reader.result || ""));
    reader.readAsText(file, "utf-8");
  }

  async function analizar() {
    if (!csvText) { setError("Elegí primero el archivo CSV."); return; }
    setError(null);
    setResult(null);
    setLoadingPreview(true);
    setPreview(null);
    try {
      const res = await fetch("/api/importar-base", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "preview", csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo analizar el CSV."); return; }
      setPreview(data);
    } finally {
      setLoadingPreview(false);
    }
  }

  async function confirmar() {
    if (!preview) return;
    const ok = confirm(
      `Vas a hacer un REEMPLAZO TOTAL: se borran TODAS las personas, equipos e inscripciones actuales del sistema ` +
        `y se cargan de cero las ${preview.validRowsCount} inscripciones válidas de este CSV (${preview.participantesUnicos} personas, ${preview.categoriasAfectadas} categorías).\n\n` +
        `Las departamentales existentes, las disciplinas/sedes y los partidos ya sorteados NO se tocan.\n\n` +
        `Esta acción no se puede deshacer. ¿Confirmás?`
    );
    if (!ok) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/importar-base", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "apply", csv: csvText }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "No se pudo aplicar la carga."); return; }
      setResult(data);
      setPreview(null);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-bold text-lg mb-1">Cargar base de datos (CSV de inscriptos)</h2>
        <p className="text-xs text-[#9FB0D0] mb-4">
          Sube el CSV con columnas <code className="text-[#2FD3C4]">participante_id, nombre, apellido, departamental, disciplina, categoria, equipo, equipo_nro</code>.
          Es un <strong>reemplazo total</strong>: borra todas las personas, equipos e inscripciones actuales y carga de cero lo que dice el archivo.
          Las departamentales que falten se crean solas; una disciplina o categoría que el sistema todavía no tenga configurada NO se crea sola
          -- esas filas quedan afuera y se listan para que las configures primero en "Disciplinas y sedes". No toca sedes/canchas, la configuración
          de sorteo de cada categoría, ni los partidos ya sorteados.
        </p>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="flex items-center gap-2 bg-[#163A67] border border-[#2A4E85] text-sm px-3 py-2 rounded-lg cursor-pointer hover:bg-[#0C2043]">
            <UploadCloud className="w-4 h-4" />
            {fileName || "Elegir archivo CSV"}
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          </label>
          <button
            onClick={analizar}
            disabled={!csvText || loadingPreview}
            className="bg-[#2FD3C4] text-[#0C2043] text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-95 disabled:opacity-50"
          >
            {loadingPreview ? "Analizando…" : "Analizar CSV"}
          </button>
        </div>

        {error && (
          <p className="text-sm text-[#E0684A] flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </p>
        )}

        {result && (
          <div className="border border-[#2A4E85] bg-[#0C2043] rounded-lg p-4 mb-3">
            <p className="text-sm font-semibold text-[#4FAE72] flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4" /> Carga aplicada
            </p>
            <ul className="text-sm text-[#EDE7D6] space-y-0.5">
              <li>{result.departamentalesCreadas} departamental(es) nueva(s)</li>
              <li>{result.participantesCreados} persona(s) cargada(s)</li>
              <li>{result.equiposCreados} equipo(s)/pareja(s) armado(s)</li>
              <li>{result.inscripcionesCreadas} inscripción(es) cargada(s)</li>
              {result.omitidas > 0 && <li className="text-[#E0C15A]">{result.omitidas} fila(s) omitida(s) (disciplina/categoría no configurada, o duplicadas)</li>}
              {result.errores > 0 && <li className="text-[#E0684A]">{result.errores} fila(s) con error de formato</li>}
            </ul>
            <p className="text-xs text-[#9FB0D0] mt-2">
              Si algún equipo cambió de nombre o de número respecto de lo que ya tenías sorteado, resetea el sorteo de esa categoría (en "Fixture y
              conflictos") antes de volver a sortear.
            </p>
          </div>
        )}

        {preview && (
          <div className="space-y-3">
            <div className="border border-[#2A4E85] bg-[#0C2043] rounded-lg p-4">
              <p className="text-sm">
                <strong>{preview.validRowsCount}</strong> de <strong>{preview.totalRows}</strong> fila(s) del CSV se pueden cargar:{" "}
                <strong>{preview.participantesUnicos}</strong> persona(s) en <strong>{preview.categoriasAfectadas}</strong> categoría(s).
              </p>
              {preview.departamentalesToCreate.length > 0 && (
                <p className="text-sm mt-2">
                  Se van a crear estas <strong>{preview.departamentalesToCreate.length}</strong> departamental(es) nueva(s):{" "}
                  <span className="text-[#9FB0D0]">{preview.departamentalesToCreate.join(", ")}</span>
                </p>
              )}
            </div>

            {preview.skipped.length > 0 && (
              <div className="border border-[#5C4A22] bg-[#2E2712] rounded-lg p-3">
                <p className="text-sm font-semibold text-[#E0C15A] mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> {preview.skipped.reduce((s, g) => s + g.count, 0)} fila(s) no se van a cargar
                </p>
                <ul className="space-y-1.5 text-xs">
                  {preview.skipped.map((g) => (
                    <li key={g.reason}>
                      <strong>{g.reason}</strong> — {g.count} inscripción(es)
                      {g.sample.length > 0 && <span className="text-[#9FB0D0]"> (ej: {g.sample.join(", ")}{g.count > g.sample.length ? "…" : ""})</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {preview.errors.length > 0 && (
              <div className="border border-[#5C3A32] bg-[#3A241F] rounded-lg p-3">
                <p className="text-sm font-semibold text-[#E0684A] mb-2 flex items-center gap-1.5">
                  <FileWarning className="w-4 h-4" /> {preview.errors.length} fila(s) con error de formato
                </p>
                <ul className="space-y-1 text-xs font-mono max-h-[160px] overflow-y-auto">
                  {preview.errors.slice(0, 50).map((er, i) => (
                    <li key={i}>Línea {er.line}: {er.reason}</li>
                  ))}
                  {preview.errors.length > 50 && <li>…y {preview.errors.length - 50} más.</li>}
                </ul>
              </div>
            )}

            <button
              onClick={confirmar}
              disabled={applying || preview.validRowsCount === 0}
              className="bg-[#E0684A] text-white text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-95 disabled:opacity-50"
            >
              {applying ? "Cargando…" : `Confirmar carga (reemplazo total) — ${preview.validRowsCount} inscripción(es)`}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
