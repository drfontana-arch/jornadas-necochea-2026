import { getCategory, listTeamEntries, listAllMatches, listMatchesForCategory, replaceMatchesForStage, updateCategorySettings, listRestrictions, getIndividualDisciplineBusyMatches, listParticipantsForCategory, categoryHasResults, INDIVIDUAL_DISCIPLINES } from "./db";
import { getSupabase } from "./supabase";
import {
  buildSeedOrder, buildDrawMatches, roundRobinRounds, distributeGroupsSnake,
  groupLetter, assignSlotsAvoidingConflicts, scheduleRoundsProgressively, uid, validateGroupConfig, absoluteMinutes, nextPow2, extraQualifierLabel, shuffle,
} from "./sorteoLogic";

// Disciplinas donde no hay "equipo A vs equipo B" sino mesas/grupos que
// juegan todos juntos al mismo tiempo (ej. Póker: mesas de 8 a 9
// personas). El sorteo acá se limita a armar esas mesas -- después la
// disciplina tiene su propia dinámica interna.
export const TABLE_DISCIPLINES = ["poker"];
const TABLE_MIN_SIZE = 8;
const TABLE_MAX_SIZE = 9;

// Para la fase de grupos de una categoría con un día reservado para
// semifinal/final (category.playoff_only_day): devuelve una copia de la
// disciplina SIN las sedes de ese día, para que el sorteo de zona no
// pueda usarlo. El playoff, en cambio, sigue usando la disciplina
// original (sin filtrar) -- ese día es justamente para él.
function reservedPlayoffDayDiscipline(discipline, reservedDay) {
  if (!reservedDay) return discipline;
  return { ...discipline, venues: discipline.venues.filter((v) => v.day !== reservedDay) };
}

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

// Etiqueta de una persona cuando la categoría se sortea persona contra
// persona (ver más abajo). baseDept() en sorteoLogic.js sabe extraer la
// departamental de este mismo formato -- si se cambia acá, hay que
// cambiarlo ahí también.
function personLabel(p) {
  return `${p.fullName} (${p.departamental})`;
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
    categoryId,
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
    discipline.venues = context.venuesByDiscipline[category.discipline_id].map((v) => ({ day: v.day, time: v.time.slice(0, 5), location: v.location }));
  } else {
    const { data: venuesRaw, error: venuesErr } = await sb.from("venues").select("*").eq("discipline_id", category.discipline_id);
    if (venuesErr) throw venuesErr;
    discipline.venues = venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5), location: v.location }));
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
  let teams = computeLabels(entries);
  if (teams.length === 0) {
    // Nadie anotado en equipo/pareja -- puede ser una categoría de UNA
    // persona contra otra (ej. Ajedrez, Tenis Singles, Tenis de Mesa
    // Singles), no equipo contra equipo. Se arma la llave/grupos
    // directamente con las personas inscriptas; el resto del motor de
    // sorteo (llaves, grupos, horarios) no distingue si el "equipo" es en
    // realidad una persona, porque solo trabaja con la etiqueta de texto.
    const participants = await listParticipantsForCategory(categoryId);
    if (participants.length >= 2) teams = participants.map(personLabel);
  }
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
    const { assignments, unresolved } = scheduleRoundsProgressively(schedulable, discipline, transitionMinutes, baseOtherMatches, restrictions);
    const withSlots = matches.map((m) => {
      if (m.bye) return { ...m, day: null, time: null, court: null, disciplineId: discipline.id };
      const s = assignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, location: s ? s.location : null, disciplineId: discipline.id };
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
  // Si la categoría tiene un día reservado para semifinal/final (ver
  // "playoff_only_day"), la fase de grupos no puede usar ese día en
  // absoluto -- se sortea con una copia de la disciplina sin esa sede,
  // así los partidos de zona quedan obligados a repartirse entre los
  // demás días.
  const groupDiscipline = reservedPlayoffDayDiscipline(discipline, category.playoff_only_day);
  const { assignments: groupAssignments, unresolved: groupUnresolved } = scheduleRoundsProgressively(
    flatMatches, groupDiscipline, transitionMinutes, baseOtherMatches, restrictions
  );
  flatMatches = flatMatches.map((m) => {
    const s = groupAssignments[m.id];
    return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, location: s ? s.location : null };
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
    // Si los clasificados directos no cierran en una potencia de 2 (ej. 3
    // grupos con 1 clasificado cada uno = 3), la semifinal/final quedaría
    // con un BYE. En vez de eso, se completa con "comodines" tipo "Mejor
    // 2do puesto" -- placeholders iguales en espíritu a "1A"/"2B", que se
    // reemplazan por el nombre real apenas se elige quién es, en Sorteo
    // ("Completar la llave").
    const neededExtra = Math.max(0, nextPow2(qualifiers.length) - qualifiers.length);
    for (let i = 0; i < neededExtra; i++) {
      qualifiers.push(extraQualifierLabel(k, i, neededExtra));
    }
    const playoffMatches = withSeq(buildDrawMatches(qualifiers));
    const schedulablePlayoff = playoffMatches.filter((m) => !m.bye);
    const otherPlusGroups = baseOtherMatches.concat(
      flatMatches.filter((m) => m.day).map((m) => ({ ...m, duration: discipline.duration }))
    );
    // El playoff no puede empezar antes de que termine la fase de grupos:
    // partimos del horario más tardío que ya usó algún partido de grupos.
    let groupsMaxEnd = 0;
    flatMatches.forEach((m) => {
      if (!m.time || !m.day) return;
      const endMin = absoluteMinutes(m.day, m.time) + discipline.duration;
      if (endMin > groupsMaxEnd) groupsMaxEnd = endMin;
    });
    const playoffNotBefore = groupsMaxEnd > 0 ? groupsMaxEnd + transitionMinutes : 0;
    const { assignments: playoffAssignments, unresolved: pUnresolved } = scheduleRoundsProgressively(
      schedulablePlayoff, discipline, transitionMinutes, otherPlusGroups, restrictions, playoffNotBefore
    );
    playoffUnresolved = pUnresolved;
    const playoffWithSlots = playoffMatches.map((m) => {
      if (m.bye) return { ...m, day: null, time: null, court: null, disciplineId: discipline.id };
      const s = playoffAssignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, location: s ? s.location : null, disciplineId: discipline.id };
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

/* "Resortear horarios": para una categoría YA sorteada (grupos/llave ya
   armados), vuelve a decidir SOLO día/hora/cancha/sede -- sin mover a
   nadie de grupo ni tocar la llave de playoff ya armada. No toca qué
   equipos quedaron en qué grupo/posición de llave directa -- eso es lo
   que "los grupos y llaves ya armados" pide mantener. Se bloquea si la
   categoría ya tiene resultados cargados.
   `reshuffleOrder` (default true) decide, SOLO para categorías con fase
   de grupos, si además se rebaraja al azar el orden interno de cada
   grupo (quién juega primero contra quién) o si se deja el calendario de
   enfrentamientos exactamente como estaba -- para cuando ese orden
   también quedó acordado con los delegados y no se puede tocar, solo el
   horario. */
export async function rescheduleCategory(categoryId, transitionMinutes = 10, context = null, { reshuffleOrder = true } = {}) {
  const category = await getCategory(categoryId);
  if (!category) return { ok: false, error: "Categoria no encontrada." };
  if (INDIVIDUAL_DISCIPLINES.includes(category.discipline_id)) {
    return { ok: false, error: "Esta es una disciplina individual/cronometrada -- no tiene horarios de partido para resortear." };
  }
  if (TABLE_DISCIPLINES.includes(category.discipline_id)) {
    return { ok: false, error: "Esta disciplina arma sus mesas en una sola tanda -- no tiene horarios para resortear." };
  }
  if (!category.drawn) {
    return { ok: false, error: "Esta categoría todavía no fue sorteada -- primero hay que sortearla." };
  }
  if (await categoryHasResults(categoryId)) {
    return { ok: false, error: "Esta categoría ya tiene resultados cargados -- no se puede resortear el horario sin perderlos. Si hace falta, reseteala primero desde Fixture y conflictos." };
  }

  const sb = getSupabase();
  const discipline = {
    id: category.discipline_id,
    categoryId,
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
    discipline.venues = context.venuesByDiscipline[category.discipline_id].map((v) => ({ day: v.day, time: v.time.slice(0, 5), location: v.location }));
  } else {
    const { data: venuesRaw, error: venuesErr } = await sb.from("venues").select("*").eq("discipline_id", category.discipline_id);
    if (venuesErr) throw venuesErr;
    discipline.venues = venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5), location: v.location }));
  }

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
    const existing = await listMatchesForCategory(categoryId, "llave");
    const schedulable = existing.filter((m) => !m.bye);
    const { assignments, unresolved } = scheduleRoundsProgressively(schedulable, discipline, transitionMinutes, baseOtherMatches, restrictions);
    const withSlots = existing.map((m) => {
      if (m.bye) return { ...m, day: null, time: null, court: null };
      const s = assignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, location: s ? s.location : null };
    });
    await replaceMatchesForStage(categoryId, "llave", withSlots);
    recordNewMatches(withSlots);
    return { ok: true, unresolved, modality: "draw" };
  }

  // "grupos" / "grupos_playoff": por default rebaraja el orden DENTRO de
  // cada grupo ya armado (mismos equipos, mismos grupos -- solo cambia
  // quién es "primero" y por lo tanto el orden de enfrentamientos del
  // round robin). Con reshuffleOrder=false, en cambio, se reutilizan los
  // partidos de grupo YA EXISTENTES tal cual (mismo enfrentamiento en el
  // mismo orden) y solo se les recalcula el horario.
  const groups = reshuffleOrder ? (category.groups || []).map((g) => shuffle(g)) : category.groups || [];
  let flatMatches;
  if (reshuffleOrder) {
    flatMatches = [];
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
  } else {
    flatMatches = await listMatchesForCategory(categoryId, "grupos");
  }
  const groupDiscipline = reservedPlayoffDayDiscipline(discipline, category.playoff_only_day);
  const { assignments: groupAssignments, unresolved: groupUnresolved } = scheduleRoundsProgressively(
    flatMatches, groupDiscipline, transitionMinutes, baseOtherMatches, restrictions
  );
  flatMatches = flatMatches.map((m) => {
    const s = groupAssignments[m.id];
    return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, location: s ? s.location : null };
  });
  await replaceMatchesForStage(categoryId, "grupos", flatMatches);
  recordNewMatches(flatMatches);

  let playoffUnresolved = 0;
  if (category.modality === "grupos_playoff") {
    const existingPlayoff = await listMatchesForCategory(categoryId, "playoff");
    const schedulablePlayoff = existingPlayoff.filter((m) => !m.bye);
    const otherPlusGroups = baseOtherMatches.concat(
      flatMatches.filter((m) => m.day).map((m) => ({ ...m, duration: discipline.duration }))
    );
    let groupsMaxEnd = 0;
    flatMatches.forEach((m) => {
      if (!m.time || !m.day) return;
      const endMin = absoluteMinutes(m.day, m.time) + discipline.duration;
      if (endMin > groupsMaxEnd) groupsMaxEnd = endMin;
    });
    const playoffNotBefore = groupsMaxEnd > 0 ? groupsMaxEnd + transitionMinutes : 0;
    const { assignments: playoffAssignments, unresolved: pUnresolved } = scheduleRoundsProgressively(
      schedulablePlayoff, discipline, transitionMinutes, otherPlusGroups, restrictions, playoffNotBefore
    );
    playoffUnresolved = pUnresolved;
    const playoffWithSlots = existingPlayoff.map((m) => {
      if (m.bye) return { ...m, day: null, time: null, court: null };
      const s = playoffAssignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null, location: s ? s.location : null };
    });
    await replaceMatchesForStage(categoryId, "playoff", playoffWithSlots);
    recordNewMatches(playoffWithSlots);
  }

  await updateCategorySettings(categoryId, { groups });
  return {
    ok: true,
    unresolved: groupUnresolved + playoffUnresolved,
    modality: category.modality,
    groupsCount: groups.length,
  };
}
