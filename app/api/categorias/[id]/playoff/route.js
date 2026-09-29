import { NextResponse } from "next/server";
import { getCategory, listAllMatches, replaceMatchesForStage, updateCategorySettings, listRestrictions, getIndividualDisciplineBusyMatches, conflictsForCategory } from "../../../../../lib/db";
import { getSupabase } from "../../../../../lib/supabase";
import { buildDrawMatches, scheduleRoundsProgressively, groupLetter, absoluteMinutes, nextPow2, OPPOSITE_HALVES_DISCIPLINES } from "../../../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

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
      categoryId,
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
        qualifiers.push(arr[r] || `${r + 1}${groupLetter(gi)}`);
      });
    }

    // Si los clasificados directos no cierran en una potencia de 2, la
    // semifinal/final quedaría con un BYE -- se completa con los
    // clasificados del puesto siguiente que se hayan elegido a mano en
    // Sorteo (ver "Completar la llave"), en vez de dejar un BYE ahí.
    const neededExtra = Math.max(0, nextPow2(qualifiers.length) - qualifiers.length);
    const extraPicks = (standings.extra || []).filter(Boolean);
    if (neededExtra > 0) {
      if (extraPicks.length < neededExtra) {
        return NextResponse.json(
          { error: `Faltan elegir ${neededExtra - extraPicks.length} equipo(s) más en "Completar la llave" para que la semifinal/final no quede con BYE.` },
          { status: 400 }
        );
      }
      if (extraPicks.length > neededExtra) {
        return NextResponse.json(
          { error: `Hay ${extraPicks.length - neededExtra} equipo(s) de más elegido(s) en "Completar la llave" -- dejá solo ${neededExtra}.` },
          { status: 400 }
        );
      }
      qualifiers.push(...extraPicks);
    }

    // Tenis, Pádel, Tenis de Mesa: dos parejas/singles de la misma
    // departamental no deben poder cruzarse antes de la final.
    const oppositeHalves = OPPOSITE_HALVES_DISCIPLINES.includes(category.discipline_id);
    const rawMatches = buildDrawMatches(qualifiers, { oppositeHalves });
    const roundCounters = {};
    const matches = rawMatches.map((m) => {
      roundCounters[m.round] = (roundCounters[m.round] ?? -1) + 1;
      return { ...m, seq: roundCounters[m.round] };
    });
    const schedulable = matches.filter((m) => !m.bye);
    const allMatches = await listAllMatches(); // incluye los propios partidos de grupos de esta categoría
    const individualBusy = await getIndividualDisciplineBusyMatches();
    const restrictions = await listRestrictions();
    // El playoff no puede empezar antes de que termine la fase de grupos.
    const groupMatchesOfThisCategory = allMatches.filter((m) => m.key === categoryId && m.stage === "Grupos");
    let groupsMaxEnd = 0;
    groupMatchesOfThisCategory.forEach((m) => {
      if (!m.time || !m.day) return;
      const endMin = absoluteMinutes(m.day, m.time) + discipline.duration;
      if (endMin > groupsMaxEnd) groupsMaxEnd = endMin;
    });
    const playoffNotBefore = groupsMaxEnd > 0 ? groupsMaxEnd + transitionMinutes : 0;
    const { assignments, unresolved } = scheduleRoundsProgressively(
      schedulable, discipline, transitionMinutes, allMatches.concat(individualBusy), restrictions, playoffNotBefore
    );
    const withSlots = matches.map((m) => {
      if (m.bye) return { ...m, day: null, time: null, court: null, disciplineId: discipline.id };
      const s = assignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, disciplineId: discipline.id };
    });
    await replaceMatchesForStage(categoryId, "playoff", withSlots);
    const { conflicts, violations } = await conflictsForCategory(categoryId, transitionMinutes);
    return NextResponse.json({ ok: true, unresolved, conflicts, violations });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
