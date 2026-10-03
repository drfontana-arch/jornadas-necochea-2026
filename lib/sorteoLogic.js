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
// ¿Esta etiqueta es de una PERSONA individual (Ajedrez, Tenis Singles,
// Tenis de Mesa Singles: "Juan Pérez (Necochea)") en vez de un equipo/
// pareja ("Necochea" o "Necochea 2")? Un equipo nunca lleva paréntesis.
export function isPersonEntrant(label) {
  return !!label && /\(([^)]+)\)\s*$/.test(label);
}

export function baseDept(label) {
  if (!label) return label;
  // Etiqueta de una PERSONA individual (categorías tipo Ajedrez o Tenis
  // Singles, sorteadas persona contra persona: "Juan Pérez (Necochea)") --
  // la departamental es lo que está entre paréntesis, no el nombre.
  const persona = label.match(/\(([^)]+)\)\s*$/);
  if (persona) return persona[1].trim();
  return label.replace(/\s+\d+$/, "").trim();
}

// Orden cronológico REAL de las jornadas -- viernes, sábado, domingo.
// Todo lo que compare "cuándo es antes" tiene que pasar por acá, nunca
// comparar solo la hora del reloj sin el día, porque "09:00" del domingo
// no es "antes" que "20:00" del viernes.
export const DAY_ORDER = { "2026-10-09": 0, "2026-10-10": 1, "2026-10-11": 2 };
export function absoluteMinutes(day, time) {
  const dayIdx = DAY_ORDER[day] ?? 0;
  return dayIdx * 1440 + parseHM(time);
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

// Arma una mitad completa (tamaño `half`, siempre par) a partir de sus
// entradas reales ya decididas -- los BYE (pase directo a la ronda
// siguiente) son para los cabezas de serie, en el orden de la siembra
// (rank = número de seed que bracketOrder les asignó, más chico = mejor
// sembrado): si hace falta 1 solo BYE en esta mitad, es para el mejor
// sembrado de acá; si hacen falta 3, para el 1°, 2° y 3° mejor
// sembrados; y si hay más BYE que lugares cubiertos por la siembra, los
// que sobran quedan para el resto (que ya está en orden aleatorio, al no
// tener antecedente cargado). El resto -- los peor sembrados -- se
// cruzan entre sí en partidos reales. La posición final de cada llave
// dentro de la mitad respeta el orden original del cuadro (idx), para no
// revolver la estructura de siembra más de lo necesario. Nunca quedan
// dos BYE enfrentados entre sí (una llave "BYE vs BYE" no tiene a quién
// pasar a la ronda siguiente), salvo el caso extremo e inevitable de que
// haya más huecos que llaves en la mitad.
function layoutHalf(realEntries, half) {
  const m = realEntries.length;
  const k = half - m;
  const totalPairs = half / 2;
  const result = new Array(half).fill(null);
  if (k <= 0) {
    const sorted = realEntries.slice().sort((a, b) => a.idx - b.idx);
    let ri = 0;
    for (let i = 0; i < half; i++) result[i] = sorted[ri] ? sorted[ri++].label : null;
    return result;
  }
  const byePairCount = Math.min(k, totalPairs);
  const byRank = realEntries.slice().sort((a, b) => a.rank - b.rank);
  const byeSorted = byRank.slice(0, byePairCount).sort((a, b) => a.idx - b.idx);
  const matchSorted = byRank.slice(byePairCount).sort((a, b) => a.idx - b.idx);
  let bi = 0, mi = 0;
  for (let p = 0; p < byePairCount; p++) {
    result[p * 2] = byeSorted[bi] ? byeSorted[bi++].label : null;
    result[p * 2 + 1] = null;
  }
  for (let p = byePairCount; p < totalPairs; p++) {
    result[p * 2] = matchSorted[mi] ? matchSorted[mi++].label : null;
    result[p * 2 + 1] = matchSorted[mi] ? matchSorted[mi++].label : null;
  }
  return result;
}

// Separa entradas de la MISMA departamental (dos equipos, dos parejas o
// dos personas en una categoría individual) en mitades OPUESTAS de la
// llave, para que lo más pronto que se puedan cruzar sea la final -- en
// vez de solo evitar el cruce directo de la ronda 1. Aplica a todas las
// disciplinas. También "si es posible": con 3+ entradas de la misma
// departamental en un espacio para 2 por mitad, hace lo mejor que puede
// (deja el resto lo más separado posible) en vez de romper algo.
//
// Toca lo MÍNIMO indispensable respecto de la siembra original: una
// departamental que ya respeta el máximo permitido en su mitad actual
// (por ejemplo, cualquiera con un solo equipo/pareja -- siempre "cumple"
// por definición) queda exactamente donde bracketOrder la puso. Esto es
// importante porque bracketOrder siempre ubica al cabeza de serie #1 en
// la posición 0 y al cabeza de serie #2 al principio de la mitad derecha
// -- si se los llegara a mover sin necesidad, se pierde la garantía de
// que los dos mejores sembrados encabecen cada lado del cuadro.
// `order` (opcional) es el array de bracketOrder: order[i] = número de
// seed que ocupa la posición i (más chico = mejor sembrado). Hace falta
// para que, cuando una llave queda con BYE, el pase directo sea para el
// mejor sembrado y no para quien simplemente cayó en una posición más
// temprana del array -- bracketOrder entrelaza sembrados fuertes y
// débiles a propósito, así que la posición sola no sirve como medida de
// fuerza. Sin `order` (compatibilidad), se usa la posición como rank.
export function avoidSameDeptSameHalf(slots, order) {
  const size = slots.length;
  const half = Math.floor(size / 2);
  if (half === 0) return slots.slice();
  const rankOf = order ? (idx) => order[idx] : (idx) => idx + 1;

  const byDept = new Map();
  slots.forEach((label, idx) => {
    if (!label) return;
    const d = baseDept(label);
    if (!byDept.has(d)) byDept.set(d, []);
    byDept.get(d).push({ label, idx, rank: rankOf(idx) });
  });

  // Cuántos equipos REALES (no huecos) había originalmente en la mitad
  // izquierda -- es la meta a la que tiene que sumar el reparto por
  // departamental, no `half` (que cuenta también los huecos).
  const leftRealTarget = slots.slice(0, half).filter(Boolean).length;

  // Paso 1: para cada departamental, cuántos van a la izquierda. Si la
  // cantidad ORIGINAL ya respeta el máximo permitido (ceil(n/2)), se deja
  // tal cual -- cero disrupción. Si no, se achica al valor permitido más
  // cercano (floor o ceil de n/2).
  const depts = [...byDept.entries()].map(([dept, members]) => {
    const n = members.length;
    const floor = Math.floor(n / 2), ceil = Math.ceil(n / 2);
    const original = members.filter((m) => m.idx < half).length;
    let nLeft = original;
    if (nLeft > ceil) nLeft = ceil;
    if (nLeft < floor) nLeft = floor;
    return { dept, members, n, floor, ceil, nLeft, original };
  });

  // Desempate cuando varias departamentales están igual de "cerca" del
  // ajuste que hace falta: preferir tocar a la que tiene el integrante
  // MENOS importante en juego de ese lado (rank más alto = peor
  // sembrado), para no tocar nunca a un cabeza de serie si hay una
  // alternativa más débil disponible.
  function weakestRankOnSide(d, side) {
    const members = d.members.filter((m) => (m.idx < half) === (side === "left"));
    if (members.length === 0) return -1;
    return Math.max(...members.map((m) => m.rank));
  }

  // Paso 2: el total de la izquierda tiene que dar EXACTO leftRealTarget.
  // Solo las departamentales con cantidad impar tienen margen (floor o
  // ceil, un comodín de +-1) -- se usan esos márgenes, priorizando las
  // que ya estaban más cerca del valor que hace falta.
  let totalLeft = depts.reduce((s, d) => s + d.nLeft, 0);
  const oddDepts = depts.filter((d) => d.floor !== d.ceil);
  if (totalLeft < leftRealTarget) {
    let need = leftRealTarget - totalLeft;
    const candidates = oddDepts
      .filter((d) => d.nLeft === d.floor)
      .sort((a, b) => {
        const score = (b.original - b.floor) - (a.original - a.floor);
        if (score !== 0) return score;
        return weakestRankOnSide(b, "right") - weakestRankOnSide(a, "right");
      });
    for (const d of candidates) {
      if (need <= 0) break;
      d.nLeft = d.ceil;
      need--;
    }
  } else if (totalLeft > leftRealTarget) {
    let need = totalLeft - leftRealTarget;
    const candidates = oddDepts
      .filter((d) => d.nLeft === d.ceil)
      .sort((a, b) => {
        const score = (b.ceil - b.original) - (a.ceil - a.original);
        if (score !== 0) return score;
        return weakestRankOnSide(b, "left") - weakestRankOnSide(a, "left");
      });
    for (const d of candidates) {
      if (need <= 0) break;
      d.nLeft = d.floor;
      need--;
    }
  }

  // Paso 3: elegir QUIÉNES de cada departamental van a la izquierda --
  // preferir a los que YA estaban ahí (de los más fuertes a los más
  // débiles, para recortar primero a los peor sembrados si hace falta
  // achicar), y recién si hace falta completar, promover de la derecha
  // empezando por los más débiles de esa mitad.
  const left = [];
  const right = [];
  for (const d of depts) {
    const originalLeft = d.members.filter((m) => m.idx < half).sort((a, b) => a.rank - b.rank);
    const originalRight = d.members.filter((m) => m.idx >= half).sort((a, b) => b.rank - a.rank);
    const preferLeft = [...originalLeft, ...originalRight];
    preferLeft.forEach((m, i) => (i < d.nLeft ? left : right).push(m));
  }

  return [...layoutHalf(left, half), ...layoutHalf(right, half)];
}

export function buildDrawMatches(orderedTeams) {
  const size = nextPow2(orderedTeams.length);
  const order = bracketOrder(size);
  const slots = avoidSameDeptSameHalf(order.map((seed) => orderedTeams[seed - 1] || null), order);
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

// Reparte en grupos con la técnica "snake" (zigzag: A,B,C...,C,B,A,A,B,C...)
// para que las cabezas de serie queden espaciadas. Cuando la cantidad de
// equipos no es múltiplo del tamaño de grupo, algunos grupos quedan con
// un integrante menos (ej. zonas de 3 y de 4) -- para que el cabeza de
// serie (siempre orderedTeams[0], el primero de la siembra) tenga ventaja
// deportiva, los grupos GRANDES se reparten primero (Grupo A, B, C...), así
// el zigzag lo ubica ahí en vez de en una zona chica.
export function distributeGroupsSnake(orderedTeams, groupSize) {
  const total = orderedTeams.length;
  const numGroups = Math.max(1, Math.ceil(total / groupSize));
  const base = Math.floor(total / numGroups);
  const extra = total - base * numGroups; // cuántos grupos llevan uno más (base+1)
  const capacity = Array.from({ length: numGroups }, (_, i) => (i < extra ? base + 1 : base));
  const groups = Array.from({ length: numGroups }, () => []);

  let dir = 1;
  let g = 0;
  function advance() {
    if (dir === 1) {
      if (g === numGroups - 1) dir = -1;
      else g++;
    } else {
      if (g === 0) dir = 1;
      else g--;
    }
  }

  orderedTeams.forEach((team) => {
    let guard = 0;
    while (groups[g].length >= capacity[g] && guard <= numGroups) {
      advance();
      guard++;
    }
    groups[g].push(team);
    advance();
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

const ORDINAL_ES = { 1: "1er", 2: "2do", 3: "3er", 4: "4to", 5: "5to", 6: "6to", 7: "7mo", 8: "8vo", 9: "9no", 10: "10mo" };
function ordinalEs(n) {
  return ORDINAL_ES[n] || `${n}º`;
}

// Etiqueta "comodín" para un clasificado a playoff que todavía no se sabe
// quién es (ej. "Mejor 2do puesto"), cuando los clasificados directos no
// cierran en una llave completa (ver "Completar la llave" en Sorteo) --
// queda como placeholder en la llave, igual que "1A"/"2B", hasta que se
// elige y se reemplaza por el nombre real. rankIndex es 0-based (1er
// puesto = 0); slotIndex/totalSlots numeran cuando hace falta más de un
// comodín del mismo puesto (ej. 5 grupos con 1 clasificado = 3 comodines).
export function extraQualifierLabel(rankIndex, slotIndex, totalSlots) {
  const ordinal = ordinalEs(rankIndex + 1);
  return totalSlots > 1 ? `Mejor ${ordinal} puesto #${slotIndex + 1}` : `Mejor ${ordinal} puesto`;
}

// Disciplinas al aire libre: las canchas no tienen luz artificial, así que
// ningún partido puede terminar después de las 18:00.
export const OUTDOOR_DISCIPLINES = ["futbol11", "futbolReducido", "tenis", "golf", "rugby", "pelotaPaleta"];
// Actividades nocturnas: arrancan a las 21:00 y no tienen corte de fin.
export const NIGHT_START_DISCIPLINES = ["truco", "generala", "poker", "tenisMesa"];

// Disciplinas de naipes donde "cancha" no es la palabra correcta -- se
// juega en una mesa. Afecta solo al TEXTO que se muestra (Disciplinas y
// sedes, pósters, llaves); el dato en sí sigue siendo el mismo número de
// "court" en todos lados.
export const TABLE_WORD_DISCIPLINES = ["truco", "generala"];
export function courtWord(disciplineId, { plural = false, capitalize = true } = {}) {
  const base = TABLE_WORD_DISCIPLINES.includes(disciplineId) ? "mesa" : "cancha";
  const word = plural ? base + "s" : base;
  return capitalize ? word[0].toUpperCase() + word.slice(1) : word;
}

// Disciplinas donde una misma departamental puede tener VARIAS parejas/
// equipos totalmente independientes entre sí (distinta gente cada uno) --
// al sortear, no tiene sentido evitar que "Azul 1" y "Azul 2" jueguen al
// mismo tiempo, como sí se evita en deportes de equipo (ahí "Necochea 1"
// y "Necochea 2" sí podrían compartir cuerpo técnico/jugadores). Sin esta
// excepción, el sorteo relegaba partidos sueltos a horarios muy
// posteriores con una sola mesa ocupada, en vez de llenar todas las
// mesas disponibles en cada horario.
export const NO_DEPT_CLASH_DISCIPLINES = ["truco", "generala"];
// El resto (bajo techo) corta a las 20:00.
const OUTDOOR_CUTOFF_MIN = 18 * 60;
const INDOOR_CUTOFF_MIN = 20 * 60;

// Disciplinas individuales/cronometradas: no tienen "equipo A vs equipo B",
// así que no se sortean ni generan partidos en la tabla matches (ver
// getIndividualDisciplineBusyMatches en lib/db.js). Se declara acá -- en
// vez de en lib/db.js, que usa la clave de Supabase -- porque este archivo
// es lógica pura y también la necesita el cliente (por ejemplo, para no
// ofrecerlas como alcance al resetear un sorteo).
export const INDIVIDUAL_DISCIPLINES = ["natacion", "maraton", "patinCarrera", "travesia4x4", "pesca", "tiro", "golf"];

function disciplineCutoffMinutes(disciplineId) {
  if (NIGHT_START_DISCIPLINES.includes(disciplineId)) return null;
  if (OUTDOOR_DISCIPLINES.includes(disciplineId)) return OUTDOOR_CUTOFF_MIN;
  return INDOOR_CUTOFF_MIN;
}

/* Genera un pool de horarios (día, hora, cancha) para una disciplina,
   ciclando por sus sedes/ventanas y avanzando la hora por ronda. Respeta
   el horario límite de fin de partido según sea al aire libre o bajo techo
   (las nocturnas -- truco, generala, póker, ping pong -- no tienen corte). */
export function buildSlotPool(discipline, countNeeded, transitionMinutes, notBeforeAbsolute = 0) {
  const slots = [];
  if (!discipline.venues || discipline.venues.length === 0) return slots;
  const step = discipline.duration + (transitionMinutes || 0);
  const cutoff = disciplineCutoffMinutes(discipline.id);

  // Para cada sede/ventana de la disciplina generamos su propia sucesión
  // de horarios (esa ventana, +step, +2·step, ...) hasta que el corte de
  // la disciplina lo impida o se pase de medianoche. Después juntamos
  // TODAS esas franjas de TODAS las ventanas/días y las ordenamos por
  // línea de tiempo real -- así se llena un día entero antes de pasar al
  // siguiente, en vez de repartir parejo entre todos desde el arranque.
  const candidates = [];
  discipline.venues.forEach((venue) => {
    let offset = 0;
    let safety = 0;
    while (safety < 60) {
      const startOfDay = parseHM(venue.time) + offset * step;
      if (startOfDay >= 24 * 60) break;
      const endOfDay = startOfDay + discipline.duration;
      if (cutoff !== null && endOfDay > cutoff) break;
      const t = fmtHM(startOfDay);
      candidates.push({ day: venue.day, time: t, abs: absoluteMinutes(venue.day, t), location: venue.location || null });
      offset++;
      safety++;
    }
  });
  candidates.sort((a, b) => a.abs - b.abs);

  for (const c of candidates) {
    if (slots.length >= countNeeded) break;
    if (c.abs < notBeforeAbsolute) continue;
    for (let court = 1; court <= discipline.courts && slots.length < countNeeded; court++) {
      slots.push({ day: c.day, time: c.time, court, location: c.location });
    }
  }
  return slots;
}

/* buffer = minutos mínimos de transición/calentamiento exigidos entre dos
   partidos del mismo equipo, aunque no lleguen a pisarse literalmente.
   Usa tiempo ABSOLUTO (día + hora, ver absoluteMinutes) en vez de
   comparar "mismo día" y la hora sola -- una actividad nocturna (truco,
   generala, póker, tenis de mesa) puede arrancar un día y terminar
   pasada la medianoche del siguiente, y antes esos dos partidos NUNCA se
   consideraban superpuestos solo por tener distinto "day", aunque sus
   horarios reales se pisaran. */
export function overlaps(m1, dur1, m2, dur2, buffer = 0) {
  const s1 = absoluteMinutes(m1.day, m1.time), e1 = s1 + dur1;
  const s2 = absoluteMinutes(m2.day, m2.time), e2 = s2 + dur2;
  return s1 < e2 + buffer && s2 < e1 + buffer;
}

/* Asigna horario a una lista de partidos intentando, para cada uno, evitar
   que alguna de las dos departamentales quede jugando dos partidos a la
   vez —ya sea contra partidos de OTRAS disciplinas/categorías ya
   sorteados (otherMatches), ya sea entre los propios partidos que se van
   asignando en esta misma tanda. */
/* ¿Este candidato de horario viola alguna restricción cargada para la
   departamental o el equipo/pareja puntual involucrados? */
export function parseTeamRestriction(value) {
  if (!value) return { label: null, categoryId: null };
  const i = value.lastIndexOf("::");
  if (i === -1) return { label: value, categoryId: null };
  return { label: value.slice(0, i), categoryId: value.slice(i + 2) || null };
}
export function slotBlockedByRestrictions(dept, teamLabel, day, time, duration, restrictions, categoryId = null) {
  const relevant = restrictions.filter((r) => {
    if (r.scope === "departamental") return r.departamental_name === dept;
    if (r.scope !== "equipo") return false;
    // Una restricción de equipo puede llevar la categoría ("Nombre::idCategoria"):
    // en ese caso vale SOLO para ese equipo en esa categoría. Las viejas, sin
    // categoría, valen para ese nombre en cualquier categoría.
    const p = parseTeamRestriction(r.team_label);
    return p.label === teamLabel && (!p.categoryId || p.categoryId === categoryId);
  });
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

export function assignSlotsAvoidingConflicts(matchesNeedingSlots, discipline, transitionMinutes, otherMatches, restrictions = [], notBeforeAbsolute = 0) {
  const poolSize = matchesNeedingSlots.length * 4 + discipline.venues.length * discipline.courts * 2 + 6;
  const pool = buildSlotPool(discipline, poolSize, transitionMinutes, notBeforeAbsolute);
  const usedSlotKeys = new Set();
  const pickedByDept = {};
  let unresolved = 0;
  const assignments = {};
  const skipDeptClash = NO_DEPT_CLASH_DISCIPLINES.includes(discipline.id);

  // Partidos de OTRAS categorías de esta MISMA disciplina que ya ocuparon
  // una cancha -- una cancha física no puede tener dos partidos a la vez,
  // sin importar si comparten departamental/persona o no.
  const sameDisciplineOther = otherMatches.filter((m) => m.disciplineId === discipline.id && m.day && m.time && m.court);
  function courtTaken(day, time, court) {
    return sameDisciplineOther.some((m) => m.day === day && m.time === time && m.court === court);
  }

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
      if (courtTaken(s.day, s.time, s.court)) continue;
      if (!skipDeptClash && depts.some((d) => deptBusy(d, s.day, s.time))) continue;
      if (depts.some((d, i) => slotBlockedByRestrictions(d, teamLabels[i], s.day, s.time, discipline.duration, restrictions, discipline.categoryId))) continue;
      chosen = s;
      break;
    }
    if (!chosen) {
      chosen = pool.find((s) => !usedSlotKeys.has(`${s.day}::${s.time}::${s.court}`) && !courtTaken(s.day, s.time, s.court)) || null;
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
// Programa los partidos RONDA POR RONDA: la ronda 2 nunca puede empezar
// antes de que termine (con transición) la ronda 1, la ronda 3 antes que
// la 2, etc. -- sin esto, si sobran canchas, el sistema mete semifinal y
// final al mismo horario que la primera ronda porque "entran" igual.
//
// Además reparte las rondas entre TODOS los días que tiene configurados
// la disciplina (si hay más de uno), en vez de amontonarlas en el primer
// día que tenga lugar libre -- antes, con muchas canchas/horas libres,
// todo el torneo de una categoría podía terminar jugándose el mismo día
// seguido, dejando el resto de los días vacíos para esa disciplina y sin
// descansos parejos entre partido y partido para los mismos equipos.
export function scheduleRoundsProgressively(matchesNeedingSlots, discipline, transitionMinutes, baseOtherMatches, restrictions = [], initialNotBefore = 0) {
  const byRound = {};
  matchesNeedingSlots.forEach((m) => { (byRound[m.round] = byRound[m.round] || []).push(m); });
  const roundNumbers = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  // Días (únicos, en orden) en los que esta disciplina tiene alguna sede
  // configurada -- se usan para repartir las rondas entre todos ellos de
  // forma pareja (tantas rondas por día como den a cada uno). No aplica a
  // las actividades NOCTURNAS (truco, generala, póker, tenis de mesa):
  // para esas, el "día siguiente" cargado en Disciplinas y sedes es la
  // continuación de la MISMA noche (madrugada), no un día aparte para
  // repartir rondas -- tienen que llenar todas las mesas seguido y recién
  // pasar a la madrugada cuando de verdad no entra más esa noche.
  const availableDays = NIGHT_START_DISCIPLINES.includes(discipline.id)
    ? []
    : [...new Set((discipline.venues || []).map((v) => v.day))].sort();

  let notBefore = initialNotBefore;
  let unresolved = 0;
  const assignments = {};
  const runningOther = baseOtherMatches.slice();

  roundNumbers.forEach((r, ri) => {
    const roundMatches = byRound[r];
    if (availableDays.length > 1) {
      const dayIdx = Math.min(availableDays.length - 1, Math.floor((ri * availableDays.length) / roundNumbers.length));
      const dayStartAbs = absoluteMinutes(availableDays[dayIdx], "00:00");
      if (dayStartAbs > notBefore) notBefore = dayStartAbs;
    }
    const { assignments: roundAssignments, unresolved: roundUnresolved } =
      assignSlotsAvoidingConflicts(roundMatches, discipline, transitionMinutes, runningOther, restrictions, notBefore);
    unresolved += roundUnresolved;
    Object.assign(assignments, roundAssignments);

    let maxEnd = notBefore;
    roundMatches.forEach((m) => {
      const s = roundAssignments[m.id];
      if (!s) return;
      const endMin = absoluteMinutes(s.day, s.time) + discipline.duration;
      if (endMin > maxEnd) maxEnd = endMin;
      runningOther.push({ day: s.day, time: s.time, court: s.court, teamA: m.teamA, teamB: m.teamB, duration: discipline.duration, disciplineId: discipline.id });
    });
    notBefore = maxEnd + (transitionMinutes || 0);
  });

  return { assignments, unresolved };
}

export function computeRestrictionViolations(allMatches, restrictions) {
  const violations = [];
  allMatches.forEach((m) => {
    const teamLabels = [m.teamA, m.teamB].filter(Boolean);
    teamLabels.forEach((label) => {
      const dept = baseDept(label);
      if (slotBlockedByRestrictions(dept, label, m.day, m.time, m.duration, restrictions, m.key)) {
        violations.push({ id: `${m.id}::${label}`, dept, label, match: m });
      }
    });
  });
  return violations;
}

// Disciplinas que nunca deben marcarse como conflicto de horario contra
// otra cosa, aunque una misma persona esté anotada en ambas al mismo
// tiempo: la superposición con Travesía 4x4 o Pesca no se considera un
// problema real de agenda (a pedido de Enzo).
export const CONFLICT_EXCLUDED_DISCIPLINES = ["travesia4x4", "pesca"];

// Disciplinas individuales donde puede haber MUCHA gente de la misma
// departamental anotada en cosas totalmente distintas (golf, tiro,
// maratón, natación, patín) -- comparar por toda la departamental daba
// falsos positivos (alguien jugando al básquet no tiene nada que ver con
// que otro de su misma departamental esté corriendo la maratón a la
// misma hora). Para estas, la superposición se chequea SOLO si de verdad
// comparten una persona concreta -- nunca por el solo hecho de ser de la
// misma departamental.
export const PERSON_ONLY_CONFLICT_DISCIPLINES = INDIVIDUAL_DISCIPLINES.filter(
  (d) => !CONFLICT_EXCLUDED_DISCIPLINES.includes(d)
);

export function computeConflicts(allMatches, transitionMinutes, rosterByMatchId) {
  const conflicts = [];
  for (let i = 0; i < allMatches.length; i++) {
    for (let j = i + 1; j < allMatches.length; j++) {
      const m1 = allMatches[i], m2 = allMatches[j];
      if (m1.id === m2.id) continue;
      if (CONFLICT_EXCLUDED_DISCIPLINES.includes(m1.disciplineId) || CONFLICT_EXCLUDED_DISCIPLINES.includes(m2.disciplineId)) continue;
      if (!overlaps(m1, m1.duration, m2, m2.duration, transitionMinutes)) continue;

      const roster1 = rosterByMatchId && rosterByMatchId[m1.id];
      const roster2 = rosterByMatchId && rosterByMatchId[m2.id];
      if (roster1 && roster2) {
        // Tenemos los inscriptos reales de ambos partidos: solo es
        // conflicto si de verdad comparten alguna persona.
        if (roster1.size === 0 || roster2.size === 0) continue;
        const personaCompartida = [...roster1].find((p) => roster2.has(p));
        if (personaCompartida) {
          const pairId = [m1.id, m2.id].sort().join("::") + "::persona::" + personaCompartida;
          const dept = baseDept(m1.teamA) === baseDept(m2.teamA) || baseDept(m1.teamA) === baseDept(m2.teamB) ? baseDept(m1.teamA) : baseDept(m1.teamB);
          conflicts.push({ pairId, dept, m1, m2 });
        }
        continue;
      }

      // Sin datos de persona para alguno de los dos: si cualquiera de las
      // dos es una disciplina "solo por persona", no hay forma confiable
      // de saber si de verdad se pisan -- mejor no marcar un conflicto
      // que puede ser falso, en vez de usar la departamental como antes.
      if (PERSON_ONLY_CONFLICT_DISCIPLINES.includes(m1.disciplineId) || PERSON_ONLY_CONFLICT_DISCIPLINES.includes(m2.disciplineId)) continue;

      // Sin datos de personas para alguno de los dos (y ninguna es de las
      // anteriores): usamos la departamental como antes, a modo de resguardo.
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
