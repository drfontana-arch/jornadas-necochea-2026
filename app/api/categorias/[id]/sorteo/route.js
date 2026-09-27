import { NextResponse } from "next/server";
import { runSorteoForCategory } from "../../../../../lib/sorteoRunner";
import { conflictsForCategory } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;
    const result = await runSorteoForCategory(params.id, transitionMinutes);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    // Qué superposiciones quedaron para ESTA categoría después de sortear,
    // para mostrarlas una por una en la pantalla de Sorteo.
    const { conflicts, violations } = await conflictsForCategory(params.id, transitionMinutes);
    return NextResponse.json({ ...result, conflicts, violations });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
