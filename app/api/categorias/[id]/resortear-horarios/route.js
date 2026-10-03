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
    // Diagnóstico agresivo: un intento anterior mostró "{message:\"\"}" y
    // después "[object Object]" -- el objeto lanzado no tiene message/
    // code/details/hint con contenido. Acá se vuelca TODO lo que se pueda
    // leer de forma segura (tipo, constructor, cada propiedad propia),
    // cada cosa en su propio try/catch, para encontrar qué es realmente.
    console.error("Error en resortear-horarios:", e);
    const parts = [];
    try { parts.push("typeof=" + typeof e); } catch {}
    try { parts.push("toString=" + Object.prototype.toString.call(e)); } catch {}
    try { if (e && e.constructor && e.constructor.name) parts.push("constructor=" + e.constructor.name); } catch {}
    try { if (e && e.name) parts.push("name=" + String(e.name)); } catch {}
    try { if (e && e.message !== undefined) parts.push("message=" + JSON.stringify(String(e.message))); } catch {}
    try { if (e && e.code !== undefined) parts.push("code=" + String(e.code)); } catch {}
    try { if (e && e.details !== undefined) parts.push("details=" + String(e.details)); } catch {}
    try { if (e && e.hint !== undefined) parts.push("hint=" + String(e.hint)); } catch {}
    try { if (e && e.status !== undefined) parts.push("status=" + String(e.status)); } catch {}
    try {
      const keys = Object.keys(e || {});
      parts.push("keys=[" + keys.join(",") + "]");
      for (const k of keys) {
        try {
          const v = e[k];
          const t = typeof v;
          if (t === "string" || t === "number" || t === "boolean") parts.push(`${k}=${v}`);
          else parts.push(`${k}:${t}`);
        } catch (inner) { parts.push(`${k}=<no se pudo leer>`); }
      }
    } catch {}
    try { parts.push("String(e)=" + String(e)); } catch {}
    try { if (e && e.stack) parts.push("stack=" + String(e.stack).slice(0, 300)); } catch {}
    return NextResponse.json({ error: parts.join(" || ") || "Error totalmente vacío." }, { status: 500 });
  }
}
