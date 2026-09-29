import { NextResponse } from "next/server";
import { resolveQualifierCode } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

// Reemplaza un comodín de playoff ("Mejor 2do puesto", ver
// extraQualifierLabel en lib/sorteoLogic.js) por el nombre real del
// equipo elegido en "Completar la llave" (Sorteo), sin tocar el
// día/hora/cancha ya asignados -- mismo mecanismo que resolveQualifierCode
// ya usa para los códigos "1A"/"2B" al cargar posiciones de grupo.
export async function POST(req, { params }) {
  try {
    const { placeholder, label } = await req.json();
    if (!placeholder || !label) {
      return NextResponse.json({ error: "Falta el comodín o el equipo elegido." }, { status: 400 });
    }
    await resolveQualifierCode(params.id, placeholder, label);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
