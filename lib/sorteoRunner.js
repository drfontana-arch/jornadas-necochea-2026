import { getCategory, listTeamEntries, listAllMatches, replaceMatchesForStage, updateCategorySettings, listRestrictions, getIndividualDisciplineBusyMatches } from "./db";
import { getSupabase } from "./supabase";
import {
  buildSeedOrder, buildDrawMatches, roundRobinRounds, distributeGroupsSnake,
  groupLetter, assignSlotsAvoidingConflicts, uid,
} from "./sorteoLogic";

function computeLabels(entries) {
  const counts = {};
  entries.forEach((e) => { counts[e.dept] = (counts[e.dept] || 0) + 1; });
  return entries.map((e) => (counts[e.dept] > 1 ? `${e.dept} ${e.num}` : e.dept));
}

// Código de clasificado: "1A" = 1er puesto del Grupo A, "2B" = 2do puesto del
// Grupo B, etc. Se usa como nombre de equipo "provisorio" en la llave de
// playoff hasta que se cargue la posición final real de cada grupo.
export function qualifierCode(rank, groupIndex) {
  return `${rank + 1}${groupLetter(groupIndex)}`;
}

function withSeq(rawMatches) {
  const roundCounters = {};
  return rawMatches.map((m) => {
    roundCounters[m.round] = (roundCounters[m.round] ?? -1) + 1;
    return { ...m, seq: roundCounters[m.round] };
  });
}

/* Corre el sorteo de UNA categoria. No tira excepcion por casos esperables
   (categoria inexistente, menos de 2 equipos) -- devuelve { ok:false, error }
   para que un llamador en lote (sorteo global) pueda seguir con las demas. */
export async function runSorteoForCategory(categoryId, transitionMinutes = 10) {
  const category = await getCategory(categoryId);
  if (!category) return { ok: false, error: "Categoria no encontrada." };

  const sb = getSupabase();
  const discipline = {
    id: category.discipline_id,
    duration: category.disciplines.duration_minutes,
    courts: category.disciplines.courts,
    venues: [],
  };
  const { data: venuesRaw, error: venuesErr } = await sb.from("venues").select("*").eq("discipline_id", category.discipline_id);
  if (venuesErr) throw venuesErr;
  discipline.venues = venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5) }));

  const entries = await listTeamEntries(categoryId);
  const teams = computeLabels(entries);
  if (teams.length < 2) {
    return { ok: false, error: "Hace falta al menos 2 equipos/participantes inscriptos." };
  }

  const order = buildSeedOrder(teams, category.seed_order || []);
  const allMatches = await listAllMatches();
  const individualBusy = await getIndividualDisciplineBusyMatches();
  const baseOtherMatches = allMatches.filter((m) => m.key !== categoryId).concat(individualBusy);
  const restrictions = await listRestrictions();

  if (category.modality === "draw") {
    const matches = withSeq(buildDrawMatches(order));
    // Se programan TODAS las rondas, incluidas las que todavía no tienen
    // equipos confirmados ("a definir") -- así se conoce el horario de
    // cada instancia desde el momento del sorteo, no recién cuando se
    // sepa quién avanza. Solo los BYE (pasan directo, no juegan) quedan
    // sin horario porque no hay partido que jugar.
    const schedulable = matches.filter((m) => !m.bye);
    const { assignments, unresolved } = assignSlotsAvoidingConflicts(schedulable, discipline, transitionMinutes, baseOtherMatches, restrictions);
    const withSlots = matches.map((m) => {
      if (m.bye) return { ...m, day: null, time: null, court: null, disciplineId: discipline.id };
      const s = assignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, disciplineId: discipline.id };
    });
    await replaceMatchesForStage(categoryId, "llave", withSlots);
    await replaceMatchesForStage(categoryId, "grupos", []);
    await replaceMatchesForStage(categoryId, "playoff", []);
    await updateCategorySettings(categoryId, { drawn: true, groups: null, group_standings: {} });
    return { ok: true, unresolved, modality: "draw" };
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
  const { assignments: groupAssignments, unresolved: groupUnresolved } = assignSlotsAvoidingConflicts(
    flatMatches, discipline, transitionMinutes, baseOtherMatches, restrictions
  );
  flatMatches = flatMatches.map((m) => {
    const s = groupAssignments[m.id];
    return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null };
  });
  await replaceMatchesForStage(categoryId, "grupos", flatMatches);
  await replaceMatchesForStage(categoryId, "llave", []);

  let playoffUnresolved = 0;
  if (category.modality === "grupos_playoff") {
    // Arma la llave de playoff YA MISMO, con códigos de clasificado (1A, 2B,
    // etc.) en vez de esperar a que termine la fase de grupos -- así todo
    // el mundo sabe desde el sorteo cuándo juega cada instancia posterior,
    // en caso de clasificar. Cuando se cargue la posición final real de
    // cada grupo, esos códigos se reemplazan por el nombre del equipo real
    // sin tocar el horario ya asignado (ver resolveQualifierCode en db.js).
    const k = category.advance_per_group || 2;
    const qualifiers = [];
    for (let r = 0; r < k; r++) {
      groups.forEach((g, gi) => qualifiers.push(qualifierCode(r, gi)));
    }
    const playoffMatches = withSeq(buildDrawMatches(qualifiers));
    const schedulablePlayoff = playoffMatches.filter((m) => !m.bye);
    // El playoff no puede pisar los horarios que ya ocupó la fase de grupos
    // de esta misma categoría, así que la sumamos a los "otros partidos".
    const otherPlusGroups = baseOtherMatches.concat(
      flatMatches.filter((m) => m.day).map((m) => ({ ...m, duration: discipline.duration }))
    );
    const { assignments: playoffAssignments, unresolved: pUnresolved } = assignSlotsAvoidingConflicts(
      schedulablePlayoff, discipline, transitionMinutes, otherPlusGroups, restrictions
    );
    playoffUnresolved = pUnresolved;
    const playoffWithSlots = playoffMatches.map((m) => {
      if (m.bye) return { ...m, day: null, time: null, court: null, disciplineId: discipline.id };
      const s = playoffAssignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, disciplineId: discipline.id };
    });
    await replaceMatchesForStage(categoryId, "playoff", playoffWithSlots);
  } else {
    await replaceMatchesForStage(categoryId, "playoff", []);
  }

  await updateCategorySettings(categoryId, { drawn: true, groups, group_standings: {} });
  return {
    ok: true,
    unresolved: groupUnresolved + playoffUnresolved,
    modality: category.modality,
    groupsCount: groups.length,
  };
}
