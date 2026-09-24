import { NextResponse } from "next/server";
import { fetchImportReferenceData, applyCsvImportReplaceTotal } from "../../../lib/db";
import { resolveImportRows } from "../../../lib/csvImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { action, csv } = body;
    if (!csv || typeof csv !== "string") {
      return NextResponse.json({ error: "Falta el contenido del CSV." }, { status: 400 });
    }
    if (action !== "preview" && action !== "apply") {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    // Se resuelve siempre en el momento (no se confía en nada calculado
    // antes en el navegador), tanto para la vista previa como para aplicar
    // -- así la disciplina/categoría que se haya configurado justo antes
    // de confirmar ya se tiene en cuenta.
    const referenceData = await fetchImportReferenceData();
    const resolved = resolveImportRows(csv, referenceData);
    if (resolved.fatalError) {
      return NextResponse.json({ error: resolved.fatalError }, { status: 400 });
    }

    if (action === "preview") {
      const { valid, ...summary } = resolved;
      summary.validRowsCount = valid.length;
      return NextResponse.json(summary);
    }

    const result = await applyCsvImportReplaceTotal(resolved, referenceData);
    return NextResponse.json({
      ok: true,
      ...result,
      omitidas: resolved.skipped.reduce((s, g) => s + g.count, 0),
      errores: resolved.errors.length,
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
