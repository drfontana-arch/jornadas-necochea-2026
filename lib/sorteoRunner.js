import { getCategory, listTeamEntries, listAllMatches, replaceMatchesForStage, updateCategorySettings, listRestrictions, getIndividualDisciplineBusyMatches, listParticipantsForCategory, INDIVIDUAL_DISCIPLINES } from "./db";
import { getSupabase } from "./supabase";
import {
  buildSeedOrder, buildDrawMatches, roundRobinRounds, distributeGroupsSnake,
  groupLetter, assignSlotsAvoidingConflicts, uid, validateGroupConfig,
} from "./sorteoLogic";

// Disciplinas donde no hay "equipo A vs equipo B" sino mesas/grupos que
// juegan todos juntos al mismo tiempo (ej. Póker: mesas de 8 a 9
// personas). El sorteo acá se limita a armar esas mesas -- después la
// disciplina tiene su propia dinámica interna.
export const TABLE_DISCIPLINES = ["poker"];
const TABLE_MIN_SIZE = 8;
const TABLE_MAX_SIZE = 9;

function buildTables(names) {
  const n = names.length;
  if (n <= TABLE_MAX_SIZE) return [names];
  let numTables = Math.ceil(n / TABLE_MAX_SIZE);
  while (Math.floor(n / numTables) < TABLE_MIN_SIZE && numTables > 1) numTables--;
  const tables = Array.from({ length: numTables }, () => []);
  names.forEach((name, i) => tables[i % numTables].push(name));
  return tables;
}

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

/* Arma un contexto reutilizable para sortear MUCHAS categorías en un solo
   lote (sorteo global), evitando volver a pedir a la base los partidos ya
   sorteados, las restricciones y las disciplinas individuales en cada
   vuelta -- eso era lo que hacía que sortear ~100 categorías se pasara
   del tiempo permitido por el servidor. */
export async function buildSorteoBatchContext() {
  const [matches, individualBusy, restrictions] = await Promise.all([
    listAllMatches(),
    getIndividualDisciplineBusyMatches(),
    listRestrictions(),
  ]);
  return { matches, individualBusy, restrictions, venuesByDiscipline: {} };
}

/* Corre el sorteo de UNA categoria. No tira excepcion por casos esperables
   (categoria inexistente, menos de 2 equipos) -- devuelve { ok:false, error }
   para que un llamador en lote (sorteo global) pueda seguir con las demas.
   Si se le pasa `context` (ver buildSorteoBatchContext), reusa esos datos
   en vez de volver a pedirlos, y le suma los partidos recién sorteados
   para que la próxima categoría del lote ya los tenga en cuenta. */
export async function runSorteoForCategory(categoryId, transitionMinutes = 10, context = null) {
  const category = await getCategory(categoryId);
  if (!category) return { ok: false, error: "Categoria no encontrada." };
  if (INDIVIDUAL_DISCIPLINES.includes(category.discipline_id)) {
    return { ok: false, error: "Esta es una disciplina individual/cronometrada -- no se sortea (no hay equipo A vs equipo B)." };
  }

  const sb = getSupabase();
  const discipline = {
    id: category.discipline_id,
    duration: category.disciplines.duration_minutes,
    courts: category.disciplines.courts,
    venues: [],
  };

  if (context) {
    if (!context.venuesByDiscipline[category.discipline_id]) {
      const { data, error } = await sb.from("venues").select("*").eq("discipline_id", category.discipline_id);
      if (error) throw error;
      context.venuesByDiscipline[category.discipline_id] = data;
    }
    discipline.venues = context.venuesByDiscipline[category.discipline_id].map((v) => ({ day: v.day, time: v.time.slice(0, 5) }));
  } else {
    const { data: venuesRaw, error: venuesErr } = await sb.from("venues").select("*").eq("discipline_id", category.discipline_id);
    if (venuesErr) throw venuesErr;
    discipline.venues = venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5) }));
  }

  if (TABLE_DISCIPLINES.includes(category.discipline_id)) {
    // No hay "equipo A vs B": se arman mesas de 8 a 9 personas y listo --
    // la dinámica del juego en sí queda afuera del sorteo.
    const participants = await listParticipantsForCategory(categoryId);
    if (participants.length < 2) {
      return { ok: false, error: "Hace falta al menos 2 personas inscriptas." };
    }
    const names = participants.map((p) => `${p.fullName} (${p.departamental})`);
    const tables = buildTables(names);
    const venue = discipline.venues[0] || null;
    const tableMatches = tables.map((table, i) => ({
      id: uid(),
      disciplineId: discipline.id,
      teamA: `Mesa ${i + 1}: ${table.join(", ")}`,
      teamB: null,
      day: venue ? venue.day : null,
      time: venue ? venue.time : null,
      court: i + 1,
      stage: "grupos",
      groupLabel: `Mesa ${i + 1}`,
      round: 1,
    }));
    await replaceMatchesForStage(categoryId, "grupos", tableMatches);
    await replaceMatchesForStage(categoryId, "llave", []);
    await replaceMatchesForStage(categoryId, "playoff", []);
    await updateCategorySettings(categoryId, { drawn: true, groups: tables, group_standings: {} });
    if (context) {
      context.matches.push(...tableMatches.filter((m) => m.day).map((m) => ({ ...m, key: categoryId, duration: discipline.duration })));
    }
    return { ok: true, unresolved: 0, modality: "mesas", groupsCount: tables.length };
  }

  const entries = await listTeamEntries(categoryId);
  const teams = computeLabels(entries);
  if (teams.length < 2) {
    return { ok: false, error: "Hace falta al menos 2 equipos/participantes inscriptos." };
  }

  const order = buildSeedOrder(teams, category.seed_order || []);
  const allMatches = context ? context.matches : await listAllMatches();
  const individualBusy = context ? context.individualBusy : await getIndividualDisciplineBusyMatches();
  const restrictions = context ? context.restrictions : await listRestrictions();
  const baseOtherMatches = allMatches.filter((m) => m.key !== categoryId).concat(individualBusy);

  function recordNewMatches(newOnes) {
    if (!context) return;
    context.matches.push(
      ...newOnes.filter((m) => m.day).map((m) => ({ ...m, key: categoryId, duration: discipline.duration }))
    );
  }

  if (category.modality === "draw") {
    const matches = withSeq(buildDrawMatches(order));
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
    recordNewMatches(withSlots);
    return { ok: true, unresolved, modality: "draw" };
  }

  const groupSize = category.group_size || 4;
  const validation = validateGroupConfig(order.length, groupSize);
  if (!validation.ok) {
    return { ok: false, error: validation.message };
  }
  const groups = distributeGroupsSnake(order, groupSize);
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
  recordNewMatches(flatMatches);

  let playoffUnresolved = 0;
  if (category.modality === "grupos_playoff") {
    const k = category.advance_per_group || 2;
    const qualifiers = [];
    for (let r = 0; r < k; r++) {
      groups.forEach((g, gi) => qualifiers.push(qualifierCode(r, gi)));
    }
    const playoffMatches = withSeq(buildDrawMatches(qualifiers));
    const schedulablePlayoff = playoffMatches.filter((m) => !m.bye);
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
    recordNewMatches(playoffWithSlots);
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
