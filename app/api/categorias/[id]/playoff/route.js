import { NextResponse } from "next/server";
import { getCategory, listAllMatches, replaceMatchesForStage, updateCategorySettings } from "../../../../../lib/db";
import { getSupabase } from "../../../../../lib/supabase";
import { buildDrawMatches, assignSlotsAvoidingConflicts, groupLetter } from "../../../../../lib/sorteoLogic";

export async function POST(req, { params }) {
  try {
    const categoryId = params.id;
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;

    const category = await getCategory(categoryId);
    if (!category) return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });

    const sb = getSupabase();
    const { data: venuesRaw, error: venuesErr } = await sb
      .from("venues").select("*").eq("discipline_id", category.discipline_id);
    if (venuesErr) throw venuesErr;
    const discipline = {
      id: category.discipline_id,
      duration: category.disciplines.duration_minutes,
      courts: category.disciplines.courts,
      venues: venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5) })),
    };

    const k = category.advance_per_group || 2;
    const standings = category.group_standings || {};
    const groups = category.groups || [];
    const qualifiers = [];
    for (let r = 0; r < k; r++) {
      groups.forEach((g, gi) => {
        const arr = standings[gi] || [];
        qualifiers.push(arr[r] || `${r + 1}° Grupo ${groupLetter(gi)}`);
      });
    }

    const matches = buildDrawMatches(qualifiers);
    const schedulable = matches.filter((m) => !m.placeholder && !m.bye);
    const allMatches = await listAllMatches(); // incluye los propios partidos de grupos de esta categoría
    const { assignments, unresolved } = assignSlotsAvoidingConflicts(schedulable, discipline, transitionMinutes, allMatches);
    const withSlots = matches.map((m) => {
      if (m.placeholder || m.bye) return { ...m, day: null, time: null, court: null, disciplineId: discipline.id };
      const s = assignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, disciplineId: discipline.id };
    });
    await replaceMatchesForStage(categoryId, "playoff", withSlots);
    return NextResponse.json({ ok: true, unresolved });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
