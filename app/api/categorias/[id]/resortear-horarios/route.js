import { NextResponse } from "next/server";
import { rescheduleCategory } from "../../../../../lib/sorteoRunner";
import { conflictsForCategory } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;
    const reshuffleOrder = body.reshuffleOrder ?? true;
    const result = await rescheduleCategory(params.id, transitionMinutes, null, { reshuffleOrder });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const { conflicts, violations } = await conflictsForCategory(params.id, transitionMinutes);
    return NextResponse.json({ ...result, conflicts, violations });
  } catch (e) {
    // e.message a veces viene vacío con errores de Postgres/Supabase. El
    // intento anterior usaba JSON.stringify sobre el objeto entero, que
    // puede tener referencias circulares (típico en errores de fetch/
    // Supabase) y tirar SU PROPIA excepción -- eso hacía que esta misma
    // función de error fallara sin que el catch de afuera la viera, y
    // Next.js devolvía su mensaje genérico de producción en su lugar. Acá
    // cada intento de lectura va envuelto en su propio try/catch, sin usar
    // JSON.stringify sobre algo desconocido.
    const parts = [];
    try { if (e && e.message) parts.push(String(e.message)); } catch {}
    try { if (e && e.code) parts.push("code=" + String(e.code)); } catch {}
    try { if (e && e.details) parts.push("details=" + String(e.details)); } catch {}
    try { if (e && e.hint) parts.push("hint=" + String(e.hint)); } catch {}
    let detail = parts.join(" | ");
    if (!detail) {
      try { detail = String(e); } catch { detail = ""; }
    }
    return NextResponse.json({ error: detail || "Error desconocido (sin mensaje)." }, { status: 500 });
  }
}
