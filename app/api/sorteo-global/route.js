import { NextResponse } from "next/server";
import { listDisciplines, INDIVIDUAL_DISCIPLINES } from "../../../lib/db";
import { getSupabase } from "../../../lib/supabase";
import { runSorteoForCategory } from "../../../lib/sorteoRunner";
import { validateGroupConfig } from "../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const disciplines = await listDisciplines();
    const sb = getSupabase();
    const { data: entries, error } = await sb.from("team_entries").select("category_id");
    if (error) throw error;
    const countByCategory = {};
    (entries || []).forEach((e) => { countByCategory[e.category_id] = (countByCategory[e.category_id] || 0) + 1; });

    const pendientes = [];
    disciplines.forEach((d) => {
      if (INDIVIDUAL_DISCIPLINES.includes(d.id)) return;
      d.categories.forEach((c) => {
        if (c.drawn) return;
        const teamCount = countByCategory[c.id] || 0;
        let validation = { ok: true };
        if (c.modality !== "draw" && teamCount >= 2) {
          validation = validateGroupConfig(teamCount, c.group_size || 4);
        }
        pendientes.push({
          id: c.id,
          name: c.name,
          disciplineId: d.id,
          disciplineName: d.name,
          modality: c.modality,
          groupSize: c.group_size,
          advancePerGroup: c.advance_per_group,
          teamCount,
          ok: teamCount >= 2 && validation.ok,
          reason: teamCount < 2 ? "Menos de 2 equipos inscriptos." : (!validation.ok ? validation.message : null),
        });
      });
    });
    return NextResponse.json({ pendientes });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;

    const disciplines = await listDisciplines();
    const pendientes = [];
    disciplines.forEach((d) => {
      if (INDIVIDUAL_DISCIPLINES.includes(d.id)) return;
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
