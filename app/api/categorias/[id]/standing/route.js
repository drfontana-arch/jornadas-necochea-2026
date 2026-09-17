import { NextResponse } from "next/server";
import { getCategory, updateCategorySettings, resolveQualifierCode } from "../../../../../lib/db";
import { qualifierCode } from "../../../../../lib/sorteoRunner";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const { groupIndex, rank, label } = await req.json();
    const category = await getCategory(params.id);
    const gs = { ...(category.group_standings || {}) };
    const arr = (gs[groupIndex] || []).slice();
    arr[rank] = label;
    gs[groupIndex] = arr;
    await updateCategorySettings(params.id, { group_standings: gs });

    if (category.modality === "grupos_playoff" && label) {
      // La llave de playoff ya está programada con códigos de clasificado
      // (1A, 2B, ...) desde el sorteo -- acá solo reemplazamos el código
      // por el nombre real del equipo, sin recalcular horarios.
      await resolveQualifierCode(params.id, qualifierCode(rank, groupIndex), label);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
