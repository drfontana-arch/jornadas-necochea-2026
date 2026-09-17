import { NextResponse } from "next/server";
import { listDisciplines } from "../../../lib/db";
import { runSorteoForCategory } from "../../../lib/sorteoRunner";

export const dynamic = "force-dynamic";

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;

    const disciplines = await listDisciplines();
    const pendientes = [];
    disciplines.forEach((d) => {
      d.categories.forEach((c) => {
        if (!c.drawn) pendientes.push({ id: c.id, name: c.name, disciplineName: d.name });
      });
    });

    let sorteadas = 0;
    let saltadas = 0;
    const detalle = [];

    for (const cat of pendientes) {
      const result = await runSorteoForCategory(cat.id, transitionMinutes);
      if (result.ok) {
        sorteadas++;
        detalle.push({ categoria: `${cat.disciplineName} - ${cat.name}`, ok: true, unresolved: result.unresolved || 0 });
      } else {
        saltadas++;
        detalle.push({ categoria: `${cat.disciplineName} - ${cat.name}`, ok: false, error: result.error });
      }
    }

    return NextResponse.json({ ok: true, sorteadas, saltadas, detalle });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
