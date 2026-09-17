/* ------------------------------------------------------------------ */
/*  LÓGICA DE SORTEO — misma que el artifact piloto, sin cambios       */
/*  funcionales, solo movida a un módulo compartido entre API routes.  */
/* ------------------------------------------------------------------ */

export const uid = () => Math.random().toString(36).slice(2, 10);

export function parseHM(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
export function fmtHM(mins) {
  let m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
export function addMinutes(hm, mins) {
  return fmtHM(parseHM(hm) + mins);
}
export function baseDept(label) {
  if (!label) return label;
  return label.replace(/\s+\d+$/, "").trim();
}
export function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(1, p);
}
export function bracketOrder(size) {
  if (size <= 1) return [1];
  const prev = bracketOrder(size / 2);
  const result = [];
  prev.forEach((s) => {
    result.push(s);
    result.push(size + 1 - s);
  });
  return result;
}
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Orden de siembra: primero equipos con antecedente (mejor a peor),
   luego el resto en orden aleatorio */
export function buildSeedOrder(teamLabels, seedList) {
  const seeded = (seedList || []).filter((s) => teamLabels.includes(s));
  const rest = shuffle(teamLabels.filter((t) => !seeded.includes(t)));
  return [...seeded, ...rest];
}

export function buildDrawMatches(orderedTeams) {
  const size = nextPow2(orderedTeams.length);
  const order = bracketOrder(size);
  const slots = order.map((seed) => orderedTeams[seed - 1] || null);
  let matches = [];
  const round1 = [];
  for (let i = 0; i < slots.length; i += 2) {
    round1.push({
      id: uid(),
      round: 1,
      teamA: slots[i],
      teamB: slots[i + 1],
      bye: !slots[i] || !slots[i + 1],
      label: `Llave ${i / 2 + 1}`,
      placeholder: false,
    });
  }
  matches = matches.concat(round1);
  let prev = round1;
  let roundNum = 2;
  while (prev.length > 1) {
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push({
        id: uid(),
        round: roundNum,
        teamA: null,
        teamB: null,
        bye: false,
        label:
          roundNum === Math.log2(size)
            ? "Final"
            : prev.length === 4
            ? `Semifinal ${i / 2 + 1}`
            : `Ronda ${roundNum} - Llave ${i / 2 + 1}`,
        placeholder: true,
        from: [prev[i].id, prev[i + 1] ? prev[i + 1].id : null],
      });
    }
    matches = matches.concat(next);
    prev = next;
    roundNum++;
  }
  return matches;
}

export function roundRobinRounds(teamLabels) {
  let list = teamLabels.slice();
  if (list.length < 2) return [];
  if (list.length % 2 === 1) list.push(null);
  const n = list.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const roundMatches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = list[i];
      const b = list[n - 1 - i];
      if (a && b) roundMatches.push({ teamA: a, teamB: b });
    }
    rounds.push(roundMatches);
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop());
    list = [fixed, ...rest];
  }
  return rounds;
}

export function distributeGroupsSnake(orderedTeams, groupSize) {
  const numGroups = Math.max(1, Math.ceil(orderedTeams.length / groupSize));
  const groups = Array.from({ length: numGroups }, () => []);
  let dir = 1;
  let g = 0;
  orderedTeams.forEach((team) => {
    groups[g].push(team);
    if (dir === 1) {
      if (g === numGroups - 1) dir = -1;
      else g++;
    } else {
      if (g === 0) dir = 1;
      else g--;
    }
  });
  return groups;
}

// Valida que, con esta cantidad de equipos y este tamaño de grupo, ningún
// grupo quede con menos de 2 integrantes (si eso pasara, esa/s departamental/es
// no tendrían contra quién jugar en la fase de grupos).
export function validateGroupConfig(teamCount, groupSize) {
  const numGroups = Math.max(1, Math.ceil(teamCount / groupSize));
  const minGroupSize = Math.floor(teamCount / numGroups);
  if (minGroupSize < 2) {
    return {
      ok: false,
      numGroups,
      minGroupSize,
      message: `Con ${teamCount} equipos y grupos de ${groupSize}, quedarían ${numGroups} grupos y al menos uno tendría solo ${minGroupSize} equipo(s) -- nadie para jugar. Cambiá el tamaño de grupo.`,
    };
  }
  return { ok: true, numGroups, minGroupSize };
}

export function groupLetter(i) {
  return String.fromCharCode(65 + i);
}

// Disciplinas al aire libre: las canchas no tienen luz artificial, así que
// ningún partido puede terminar después de las 18:00.
export const OUTDOOR_DISCIPLINES = ["futbol11", "futbolReducido", "hockey", "tenis", "golf", "rugby", "pelotaPaleta"];
// Actividades nocturnas: arrancan a las 21:00 y no tienen corte de fin.
export const NIGHT_START_DISCIPLINES = ["truco", "generala", "poker", "tenisMesa"];
// El resto (bajo techo) corta a las 20:00.
const OUTDOOR_CUTOFF_MIN = 18 * 60;
const INDOOR_CUTOFF_MIN = 20 * 60;

function disciplineCutoffMinutes(disciplineId) {
  if (NIGHT_START_DISCIPLINES.includes(disciplineId)) return null;
  if (OUTDOOR_DISCIPLINES.includes(disciplineId)) return OUTDOOR_CUTOFF_MIN;
  return INDOOR_CUTOFF_MIN;
}

/* Genera un pool de horarios (día, hora, cancha) para una disciplina,
   ciclando por sus sedes/ventanas y avanzando la hora por ronda. Respeta
   el horario límite de fin de partido según sea al aire libre o bajo techo
   (las nocturnas -- truco, generala, póker, ping pong -- no tienen corte). */
export function buildSlotPool(discipline, countNeeded, transitionMinutes) {
  const slots = [];
  if (!discipline.venues || discipline.venues.length === 0) return slots;
  const step = discipline.duration + (transitionMinutes || 0);
  const cutoff = disciplineCutoffMinutes(discipline.id);
  let roundOffset = 0;
  let safety = 0;
  while (slots.length < countNeeded && safety < 300) {
    for (let v = 0; v < discipline.venues.length && slots.length < countNeeded; v++) {
      const venue = discipline.venues[v];
      const t = addMinutes(venue.time, roundOffset * step);
      const endMinutes = parseHM(t) + discipline.duration;
      if (cutoff !== null && endMinutes > cutoff) continue;
      for (let c = 1; c <= discipline.courts && slots.length < countNeeded; c++) {
        slots.push({ day: venue.day, time: t, court: c });
      }
    }
    roundOffset++;
    safety++;
  }
  return slots;
}

/* buffer = minutos mínimos de transición/calentamiento exigidos entre dos
   partidos del mismo equipo, aunque no lleguen a pisarse literalmente */
export function overlaps(m1, dur1, m2, dur2, buffer = 0) {
  if (m1.day !== m2.day) return false;
  const s1 = parseHM(m1.time), e1 = s1 + dur1;
  const s2 = parseHM(m2.time), e2 = s2 + dur2;
  return s1 < e2 + buffer && s2 < e1 + buffer;
}

/* Asigna horario a una lista de partidos intentando, para cada uno, evitar
   que alguna de las dos departamentales quede jugando dos partidos a la
   vez —ya sea contra partidos de OTRAS disciplinas/categorías ya
   sorteados (otherMatches), ya sea entre los propios partidos que se van
   asignando en esta misma tanda. */
/* ¿Este candidato de horario viola alguna restricción cargada para la
   departamental o el equipo/pareja puntual involucrados? */
export function slotBlockedByRestrictions(dept, teamLabel, day, time, duration, restrictions) {
  const relevant = restrictions.filter(
    (r) =>
      (r.scope === "departamental" && r.departamental_name === dept) ||
      (r.scope === "equipo" && r.team_label === teamLabel)
  );
  for (const r of relevant) {
    if (r.day && r.day !== day) continue;
    if (r.unavailable_all_day) return true;
    const start = parseHM(time);
    const end = start + duration;
    if (r.not_before && start < parseHM(r.not_before)) return true;
    if (r.not_after && end > parseHM(r.not_after)) return true;
  }
  return false;
}

export function assignSlotsAvoidingConflicts(matchesNeedingSlots, discipline, transitionMinutes, otherMatches, restrictions = []) {
  const poolSize = matchesNeedingSlots.length * 4 + discipline.venues.length * discipline.courts * 2 + 6;
  const pool = buildSlotPool(discipline, poolSize, transitionMinutes);
  const usedSlotKeys = new Set();
  const pickedByDept = {};
  let unresolved = 0;
  const assignments = {};

  function deptBusy(dept, day, time) {
    for (const m of otherMatches) {
      const depts = [baseDept(m.teamA), baseDept(m.teamB)].filter(Boolean);
      if (!depts.includes(dept)) continue;
      if (overlaps({ day, time }, discipline.duration, m, m.duration, transitionMinutes)) return true;
    }
    const mine = pickedByDept[dept] || [];
    for (const p of mine) {
      if (overlaps({ day, time }, discipline.duration, p, discipline.duration, transitionMinutes)) return true;
    }
    return false;
  }

  matchesNeedingSlots.forEach((m) => {
    const teamLabels = [m.teamA, m.teamB].filter(Boolean);
    const depts = teamLabels.map(baseDept).filter(Boolean);
    let chosen = null;
    for (const s of pool) {
      const key = `${s.day}::${s.time}::${s.court}`;
      if (usedSlotKeys.has(key)) continue;
      if (depts.some((d) => deptBusy(d, s.day, s.time))) continue;
      if (depts.some((d, i) => slotBlockedByRestrictions(d, teamLabels[i], s.day, s.time, discipline.duration, restrictions))) continue;
      chosen = s;
      break;
    }
    if (!chosen) {
      chosen = pool.find((s) => !usedSlotKeys.has(`${s.day}::${s.time}::${s.court}`)) || null;
      if (chosen) unresolved++;
    }
    if (chosen) {
      usedSlotKeys.add(`${chosen.day}::${chosen.time}::${chosen.court}`);
      depts.forEach((d) => {
        pickedByDept[d] = [...(pickedByDept[d] || []), { day: chosen.day, time: chosen.time }];
      });
    }
    assignments[m.id] = chosen;
  });

  return { assignments, unresolved };
}

/* Partidos ya programados que violan una restricción cargada (por si se
   cargó la restricción DESPUÉS de sortear, o el partido se reprogramó a mano). */
export function computeRestrictionViolations(allMatches, restrictions) {
  const violations = [];
  allMatches.forEach((m) => {
    const teamLabels = [m.teamA, m.teamB].filter(Boolean);
    teamLabels.forEach((label) => {
      const dept = baseDept(label);
      if (slotBlockedByRestrictions(dept, label, m.day, m.time, m.duration, restrictions)) {
        violations.push({ id: `${m.id}::${label}`, dept, label, match: m });
      }
    });
  });
  return violations;
}

export function computeConflicts(allMatches, transitionMinutes) {
  const conflicts = [];
  for (let i = 0; i < allMatches.length; i++) {
    for (let j = i + 1; j < allMatches.length; j++) {
      const m1 = allMatches[i], m2 = allMatches[j];
      if (m1.id === m2.id) continue;
      if (!overlaps(m1, m1.duration, m2, m2.duration, transitionMinutes)) continue;
      const depts1 = [baseDept(m1.teamA), baseDept(m1.teamB)].filter(Boolean);
      const depts2 = [baseDept(m2.teamA), baseDept(m2.teamB)].filter(Boolean);
      const shared = depts1.filter((d) => depts2.includes(d));
      shared.forEach((dept) => {
        const pairId = [m1.id, m2.id].sort().join("::") + "::" + dept;
        conflicts.push({ pairId, dept, m1, m2 });
      });
    }
  }
  return conflicts;
}
