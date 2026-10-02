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
    // e.message a veces viene vacío con errores de Postgres/Supabase -- se
    // suman code/details/hint (si existen) y, como último recurso, el
    // objeto entero serializado, para que el mensaje nunca llegue vacío.
    const detail = [e?.message, e?.code, e?.details, e?.hint].filter(Boolean).join(" | ") || JSON.stringify(e, Object.getOwnPropertyNames(e || {}));
    return NextResponse.json({ error: detail || "Error desconocido (sin mensaje)." }, { status: 500 });
  }
}
