import { NextResponse } from "next/server";
import {
  getCategory, listTeamEntries, listAllMatches, replaceMatchesForStage, updateCategorySettings,
} from "../../../../../lib/db";
import { getSupabase } from "../../../../../lib/supabase";
import { listRestrictions } from "../../../../../lib/db";
import {
  buildSeedOrder, buildDrawMatches, roundRobinRounds, distributeGroupsSnake,
  groupLetter, assignSlotsAvoidingConflicts, uid,
} from "../../../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

function computeLabels(entries) {
  const counts = {};
  entries.forEach((e) => { counts[e.dept] = (counts[e.dept] || 0) + 1; });
  return entries.map((e) => (counts[e.dept] > 1 ? `${e.dept} ${e.num}` : e.dept));
}

export async function POST(req, { params }) {
  try {
    const categoryId = params.id;
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;

    const category = await getCategory(categoryId);
    if (!category) return NextResponse.json({ error: "Categoría no encontrada." }, { status: 404 });

    const sb = getSupabase();
    const discipline = {
      id: category.discipline_id,
      duration: category.disciplines.duration_minutes,
      courts: category.disciplines.courts,
      venues: [],
    };
    const { data: venuesRaw, error: venuesErr } = await sb
      .from("venues")
      .select("*")
      .eq("discipline_id", category.discipline_id);
    if (venuesErr) throw venuesErr;
    discipline.venues = venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5) }));

    const entries = await listTeamEntries(categoryId);
    const teams = computeLabels(entries);
    if (teams.length < 2) {
      return NextResponse.json({ error: "Hace falta al menos 2 equipos/participantes inscriptos." }, { status: 400 });
    }

    const order = buildSeedOrder(teams, category.seed_order || []);
    const allMatches = await listAllMatches();
    const otherMatches = allMatches.filter((m) => m.key !== categoryId);
    const restrictions = await listRestrictions();

    if (category.modality === "draw") {
      const matches = buildDrawMatches(order);
      const schedulable = matches.filter((m) => !m.placeholder && !m.bye);
      const { assignments, unresolved } = assignSlotsAvoidingConflicts(schedulable, discipline, transitionMinutes, otherMatches, restrictions);
      const withSlots = matches.map((m) => {
        if (m.placeholder || m.bye) return { ...m, day: null, time: null, court: null, disciplineId: discipline.id };
        const s = assignments[m.id];
        return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, disciplineId: discipline.id };
      });
      await replaceMatchesForStage(categoryId, "llave", withSlots);
      await replaceMatchesForStage(categoryId, "grupos", []);
      await replaceMatchesForStage(categoryId, "playoff", []);
      await updateCategorySettings(categoryId, { drawn: true, groups: null, group_standings: {} });
      return NextResponse.json({ ok: true, unresolved, modality: "draw" });
    }

    // grupos / grupos_playoff
    const groups = distributeGroupsSnake(order, category.group_size || 4);
    let flatMatches = [];
    groups.forEach((g, gi) => {
      const rounds = roundRobinRounds(g);
      rounds.forEach((round, ri) => {
        round.forEach((m) => {
          flatMatches.push({
            id: uid(), group: gi, groupLabel: `Grupo ${groupLetter(gi)}`, round: ri + 1,
            teamA: m.teamA, teamB: m.teamB, disciplineId: discipline.id,
          });
        });
      });
    });
    flatMatches.sort((a, b) => a.round - b.round);
    const { assignments, unresolved } = assignSlotsAvoidingConflicts(flatMatches, discipline, transitionMinutes, otherMatches, restrictions);
    flatMatches = flatMatches.map((m) => {
      const s = assignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null };
    });
    await replaceMatchesForStage(categoryId, "grupos", flatMatches);
    await replaceMatchesForStage(categoryId, "playoff", []);
    await replaceMatchesForStage(categoryId, "llave", []);
    await updateCategorySettings(categoryId, {
      drawn: true,
      groups: groups,
      group_standings: {},
    });
    return NextResponse.json({ ok: true, unresolved, modality: category.modality, groupsCount: groups.length });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
