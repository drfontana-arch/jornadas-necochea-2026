import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Shuffle, Users, CalendarDays, ListChecks, AlertTriangle, Trophy,
  Plus, Minus, Trash2, ChevronUp, ChevronDown, Check, X, RefreshCw,
  Settings2, ClipboardList, Info, ClipboardCheck, CheckCircle2, XCircle,
  BarChart3, Siren, UserCheck
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  UTILIDADES                                                         */
/* ------------------------------------------------------------------ */

const uid = () => Math.random().toString(36).slice(2, 10);

const DAYS = ["Vie 09/10", "Sáb 10/10", "Dom 11/10"];

function parseHM(t) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}
function fmtHM(mins) {
  let m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}
function addMinutes(hm, mins) {
  return fmtHM(parseHM(hm) + mins);
}
function dayIndex(day) {
  const i = DAYS.indexOf(day);
  return i === -1 ? 99 : i;
}
function baseDept(label) {
  if (!label) return label;
  return label.replace(/\s+\d+$/, "").trim();
}
function nextPow2(n) {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(1, p);
}
function bracketOrder(size) {
  if (size <= 1) return [1];
  const prev = bracketOrder(size / 2);
  const result = [];
  prev.forEach((s) => {
    result.push(s);
    result.push(size + 1 - s);
  });
  return result;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* Orden de siembra: primero equipos con antecedente (mejor a peor), luego
   el resto en orden aleatorio */
function buildSeedOrder(teamLabels, seedList) {
  const seeded = seedList.filter((s) => teamLabels.includes(s));
  const rest = shuffle(teamLabels.filter((t) => !seeded.includes(t)));
  return [...seeded, ...rest];
}

function buildDrawMatches(orderedTeams) {
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

function roundRobinRounds(teamLabels) {
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

function distributeGroupsSnake(orderedTeams, groupSize) {
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

function groupLetter(i) {
  return String.fromCharCode(65 + i);
}

/* Genera un pool de horarios (día, hora, cancha) para una disciplina,
   ciclando por sus sedes/ventanas y avanzando la hora por ronda. */
function buildSlotPool(discipline, countNeeded, transitionMinutes) {
  const slots = [];
  if (!discipline.venues || discipline.venues.length === 0) return slots;
  const step = discipline.duration + (transitionMinutes || 0);
  let roundOffset = 0;
  let safety = 0;
  while (slots.length < countNeeded && safety < 300) {
    for (let v = 0; v < discipline.venues.length && slots.length < countNeeded; v++) {
      const venue = discipline.venues[v];
      const t = addMinutes(venue.time, roundOffset * step);
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
function overlaps(m1, dur1, m2, dur2, buffer = 0) {
  if (m1.day !== m2.day) return false;
  const s1 = parseHM(m1.time), e1 = s1 + dur1;
  const s2 = parseHM(m2.time), e2 = s2 + dur2;
  return s1 < e2 + buffer && s2 < e1 + buffer;
}

/* Asigna horario a una lista de partidos intentando, para cada uno, evitar que
   alguna de las dos departamentales quede jugando dos partidos a la vez —ya sea
   contra partidos de OTRAS disciplinas/categorías ya sorteados (otherMatches),
   ya sea entre los propios partidos que se van asignando en esta misma tanda.
   Si para algún partido no se encuentra un horario libre de superposición
   dentro del pool generado, se le asigna igualmente el primer horario libre
   (para no dejarlo sin programar) y se contabiliza como "no resuelto", para
   que quien sortea sepa que ese caso quedó pendiente de revisión manual. */
function assignSlotsAvoidingConflicts(matchesNeedingSlots, discipline, transitionMinutes, otherMatches) {
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
    const depts = [baseDept(m.teamA), baseDept(m.teamB)].filter(Boolean);
    let chosen = null;
    for (const s of pool) {
      const key = `${s.day}::${s.time}::${s.court}`;
      if (usedSlotKeys.has(key)) continue;
      if (depts.some((d) => deptBusy(d, s.day, s.time))) continue;
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

/* ------------------------------------------------------------------ */
/*  DATOS POR DEFECTO                                                   */
/* ------------------------------------------------------------------ */

const DEFAULT_DEPARTAMENTALES = [
  "Avellaneda-Lanús", "Azul", "Bahía Blanca", "Dolores", "Junín", "La Matanza", "La Plata",
  "Lomas de Zamora", "Mar del Plata", "Mercedes", "Moreno-Gral. Rodríguez",
  "Morón", "Necochea", "Pergamino", "Quilmes", "San Isidro", "San Martín",
  "San Nicolás", "Trenque Lauquen", "Zárate-Campana", "Nacional (invitado)",
].map((name) => ({ id: uid(), name }));

function cat(name, maxTeams = 1) {
  return { id: uid(), name, maxTeams };
}

const DEFAULT_DISCIPLINES = [
  {
    id: "futbol11", name: "Fútbol 11", courts: 2, duration: 80,
    venues: [{ day: "Vie 09/10", time: "10:00" }, { day: "Sáb 10/10", time: "10:00" }],
    categories: [cat("Libre"), cat("Veteranos")],
  },
  {
    id: "futbolReducido", name: "Fútbol Reducido", courts: 5, duration: 50,
    venues: [
      { day: "Vie 09/10", time: "09:00" }, { day: "Sáb 10/10", time: "09:00" },
      { day: "Dom 11/10", time: "09:00" }, { day: "Dom 11/10", time: "10:00" },
    ],
    categories: [
      cat("Femenino Libre"), cat("Femenino Ladies"), cat("Veteranos (+34)"),
      cat("Senior (+42)"), cat("Master (+50)"), cat("Supermaster (+60)"),
    ],
  },
  {
    id: "basquet", name: "Básquet", courts: 1, duration: 75,
    venues: [{ day: "Vie 09/10", time: "11:00" }, { day: "Sáb 10/10", time: "09:00" }, { day: "Dom 11/10", time: "09:00" }],
    categories: [cat("Masculino Libre"), cat("Masculino Veteranos"), cat("Femenino")],
  },
  {
    id: "voley", name: "Vóley", courts: 3, duration: 90,
    venues: [{ day: "Vie 09/10", time: "13:00" }, { day: "Sáb 10/10", time: "09:00" }, { day: "Dom 11/10", time: "11:00" }],
    categories: [cat("Femenino"), cat("Masculino")],
  },
  {
    id: "padel", name: "Pádel", courts: 6, duration: 60,
    venues: [{ day: "Vie 09/10", time: "12:00" }, { day: "Sáb 10/10", time: "09:00" }, { day: "Dom 11/10", time: "09:00" }],
    categories: [
      cat("Caballeros Juveniles", 2), cat("Caballeros Senior", 2), cat("Caballeros Master", 2),
      cat("Damas Juveniles", 2), cat("Damas Ladies", 2), cat("Damas Master", 2),
      cat("Mixto Juveniles", 2), cat("Mixto Senior/Ladies", 2), cat("Mixto Master", 2),
    ],
  },
  {
    id: "tenis", name: "Tenis", courts: 5, duration: 75,
    venues: [{ day: "Vie 09/10", time: "12:00" }, { day: "Sáb 10/10", time: "09:00" }, { day: "Dom 11/10", time: "09:00" }],
    categories: [
      cat("Single Caballeros Juveniles", 2), cat("Single Caballeros Senior", 2), cat("Single Caballeros Master", 2),
      cat("Single Damas Juveniles", 2), cat("Single Damas Ladies", 2), cat("Single Damas Master", 2),
      cat("Doble Masc. Juveniles", 2), cat("Doble Masc. Senior", 2), cat("Doble Masc. Master", 2),
      cat("Doble Fem. Juveniles", 2), cat("Doble Fem. Ladies", 2), cat("Doble Fem. Master", 2),
      cat("Doble Mixto Juveniles", 2), cat("Doble Mixto Senior/Ladies", 2), cat("Doble Mixto Master", 2),
    ],
  },
  {
    id: "tenisMesa", name: "Tenis de Mesa", courts: 8, duration: 30,
    venues: [{ day: "Vie 09/10", time: "20:00" }],
    categories: [
      cat("Individual Femenino", 2), cat("Individual Masculino", 2),
      cat("Dobles Femenino", 2), cat("Dobles Masculino", 2), cat("Dobles Mixto", 2),
    ],
  },
  {
    id: "truco", name: "Truco", courts: 20, duration: 40,
    venues: [{ day: "Vie 09/10", time: "21:00" }],
    categories: [cat("Parejas", 6)],
  },
  {
    id: "generala", name: "Generala", courts: 15, duration: 30,
    venues: [{ day: "Vie 09/10", time: "21:00" }],
    categories: [cat("Parejas", 6)],
  },
  {
    id: "ajedrez", name: "Ajedrez", courts: 8, duration: 60,
    venues: [{ day: "Sáb 10/10", time: "13:00" }],
    categories: [cat("Único", 2)],
  },
  {
    id: "canasta", name: "Canasta", courts: 6, duration: 90,
    venues: [{ day: "Sáb 10/10", time: "13:00" }],
    categories: [cat("Parejas", 2)],
  },
  {
    id: "burako", name: "Burako", courts: 6, duration: 90,
    venues: [{ day: "Vie 09/10", time: "15:00" }],
    categories: [cat("Parejas", 2)],
  },
  {
    id: "hockey", name: "Hockey (Seven)", courts: 1, duration: 40,
    venues: [{ day: "Sáb 10/10", time: "09:00" }, { day: "Dom 11/10", time: "09:00" }],
    categories: [cat("Femenino")],
  },
  {
    id: "rugby", name: "Rugby", courts: 1, duration: 60,
    venues: [{ day: "Sáb 10/10", time: "09:00" }],
    categories: [cat("Único")],
  },
  {
    id: "golf", name: "Golf", courts: 1, duration: 240,
    venues: [{ day: "Vie 09/10", time: "09:00" }, { day: "Sáb 10/10", time: "09:00" }],
    categories: [cat("Categoría A", 2), cat("Categoría B", 2), cat("Damas", 2)],
  },
  {
    id: "maraton", name: "Maratón", courts: 1, duration: 90,
    venues: [{ day: "Dom 11/10", time: "08:30" }],
    categories: [
      cat("Caballeros Juveniles"), cat("Caballeros Senior"), cat("Caballeros Máster"),
      cat("Damas Juveniles"), cat("Damas Ladies"), cat("Damas Máster"), cat("Integración", 15),
    ],
  },
  {
    id: "natacion", name: "Natación", courts: 1, duration: 120,
    venues: [{ day: "Sáb 10/10", time: "18:00" }],
    categories: [
      cat("Caballeros Juveniles"), cat("Caballeros Senior"), cat("Caballeros Máster"), cat("Caballeros Supermáster"),
      cat("Damas Juveniles"), cat("Damas Ladies"), cat("Damas Máster"), cat("Damas Supermáster"),
      cat("Posta Libre 4x25"), cat("Posta Medley"),
    ],
  },
  {
    id: "patinCarrera", name: "Patín Carrera", courts: 1, duration: 60,
    venues: [{ day: "Dom 11/10", time: "10:00" }],
    categories: [cat("Femenino"), cat("Masculino")],
  },
  {
    id: "pelotaPaleta", name: "Pelota a Paleta", courts: 1, duration: 60,
    venues: [{ day: "Vie 09/10", time: "09:00" }],
    categories: [cat("Único", 2)],
  },
  {
    id: "pesca", name: "Pesca", courts: 1, duration: 180,
    venues: [{ day: "Sáb 10/10", time: "09:00" }],
    categories: [cat("Único", 4)],
  },
  {
    id: "poker", name: "Póker", courts: 1, duration: 180,
    venues: [{ day: "Vie 09/10", time: "21:00" }],
    categories: [cat("Único", 3)],
  },
  {
    id: "tiro", name: "Tiro", courts: 1, duration: 60,
    venues: [{ day: "Sáb 10/10", time: "10:00" }, { day: "Dom 11/10", time: "10:00" }],
    categories: [
      cat("Pistola menor Masc.", 3), cat("Pistola menor Fem.", 3),
      cat("Pistola grueso Masc.", 3), cat("Pistola grueso Fem.", 3),
      cat("Revólver menor Masc.", 3), cat("Revólver menor Fem.", 3),
      cat("Revólver grueso Masc.", 3), cat("Revólver grueso Fem.", 3),
      cat("Armas largas Masc.", 3), cat("Armas largas Fem.", 3),
    ],
  },
  {
    id: "travesia4x4", name: "Travesía 4x4", courts: 1, duration: 180,
    venues: [{ day: "Dom 11/10", time: "09:00" }],
    categories: [cat("Único", 3)],
  },
];

const STORAGE_KEY = "jornadas-fixture-state-v1";

/* ------------------------------------------------------------------ */
/*  COMPONENTE PRINCIPAL                                                */
/* ------------------------------------------------------------------ */

export default function FixtureManager() {
  const ACCESS_KEY = "jornadas-access-passphrase";
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [passphraseExists, setPassphraseExists] = useState(false);
  const [passInput, setPassInput] = useState("");
  const [passInput2, setPassInput2] = useState("");
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(ACCESS_KEY, true);
        setPassphraseExists(!!(res && res.value));
      } catch (e) {
        setPassphraseExists(false);
      }
      setAuthChecked(true);
    })();
  }, []);

  function submitNewPassphrase() {
    const p1 = passInput.trim();
    const p2 = passInput2.trim();
    if (!p1 || p1.length < 4) {
      setAuthError("La contraseña debe tener al menos 4 caracteres.");
      return;
    }
    if (p1 !== p2) {
      setAuthError("Las contraseñas no coinciden.");
      return;
    }
    (async () => {
      try {
        await window.storage.set(ACCESS_KEY, p1, true);
        setPassphraseExists(true);
        setAuthed(true);
        setAuthError("");
      } catch (e) {
        console.error("Error guardando contraseña compartida:", e);
        setAuthError(
          "No se pudo guardar la contraseña compartida (" +
            (e && e.message ? e.message : "error desconocido") +
            "). Puede que el almacenamiento compartido todavía no esté disponible en esta vista previa: probá publicar el artifact primero, o entrá sin contraseña por ahora."
        );
      }
    })();
  }

  function submitLogin() {
    (async () => {
      try {
        const res = await window.storage.get(ACCESS_KEY, true);
        if (res && res.value === passInput.trim()) {
          setAuthed(true);
          setAuthError("");
        } else {
          setAuthError("Contraseña incorrecta.");
        }
      } catch (e) {
        setAuthError("No se pudo verificar la contraseña.");
      }
    })();
  }

  function resetAccess() {
    if (!confirm("Esto borra la contraseña compartida de acceso para todos. ¿Continuar?")) return;
    (async () => {
      try {
        await window.storage.delete(ACCESS_KEY, true);
      } catch (e) {
        /* si la clave ya no existe, seguimos igual */
      }
      setPassphraseExists(false);
      setPassInput("");
      setPassInput2("");
      setAuthError("");
    })();
  }

  function changePassphrase() {
    const current = prompt("Ingresá la contraseña actual de acceso para confirmar el cambio:");
    if (current === null) return;
    (async () => {
      try {
        const res = await window.storage.get(ACCESS_KEY, true);
        if (!res || res.value !== current.trim()) {
          alert("La contraseña actual no coincide.");
          return;
        }
        const nueva = prompt("Nueva contraseña de acceso (mínimo 4 caracteres):");
        if (!nueva || nueva.trim().length < 4) return;
        await window.storage.set(ACCESS_KEY, nueva.trim(), true);
        alert("Contraseña de acceso actualizada para todos los que usen este link.");
      } catch (e) {
        alert("No se pudo cambiar la contraseña.");
      }
    })();
  }

  const [departamentales, setDepartamentales] = useState(DEFAULT_DEPARTAMENTALES);
  const [disciplines, setDisciplines] = useState(DEFAULT_DISCIPLINES);
  // categoryState keyed by `${disciplineId}::${categoryId}`
  const [categoryState, setCategoryState] = useState({});
  const [tab, setTab] = useState("inscripciones");
  const [selDiscipline, setSelDiscipline] = useState(DEFAULT_DISCIPLINES[0].id);
  const [selCategory, setSelCategory] = useState(DEFAULT_DISCIPLINES[0].categories[0].id);
  const [ignoredConflicts, setIgnoredConflicts] = useState({});
  const [transitionMinutes, setTransitionMinutes] = useState(10);
  const [loaded, setLoaded] = useState(false);
  const [toast, setToast] = useState(null);
  const saveTimer = useRef(null);

  /* ---------- auditor de desarrollo de las jornadas ---------- */
  // matchResults keyed por match.id -> { jugado, resultado, ganador, horaInicioReal, horaFinReal, novedades }
  const [matchResults, setMatchResults] = useState({});
  // attendance keyed por `${day}::${deptName}` -> boolean (asistencia general de la delegación ese día)
  const [attendance, setAttendance] = useState({});
  // incidents: [{ id, day, hora, disciplineId, categoryName, involucrados, tipo, descripcion, estado, responsable, resolucion }]
  const [incidents, setIncidents] = useState([]);

  /* ---------- carga / guardado ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get(STORAGE_KEY, true);
        if (res && res.value) {
          const parsed = JSON.parse(res.value);
          if (parsed.departamentales) setDepartamentales(parsed.departamentales);
          if (parsed.disciplines) setDisciplines(parsed.disciplines);
          if (parsed.categoryState) setCategoryState(parsed.categoryState);
          if (parsed.ignoredConflicts) setIgnoredConflicts(parsed.ignoredConflicts);
          if (typeof parsed.transitionMinutes === "number") setTransitionMinutes(parsed.transitionMinutes);
          if (parsed.matchResults) setMatchResults(parsed.matchResults);
          if (parsed.attendance) setAttendance(parsed.attendance);
          if (parsed.incidents) setIncidents(parsed.incidents);
        }
      } catch (e) {
        /* no hay estado guardado todavía */
      }
      setLoaded(true);
    })();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const payload = JSON.stringify({
        departamentales, disciplines, categoryState, ignoredConflicts, transitionMinutes,
        matchResults, attendance, incidents,
      });
      try {
        await window.storage.set(STORAGE_KEY, payload, true);
      } catch (e) {
        console.error("No se pudo guardar en almacenamiento compartido, guardando localmente:", e);
        try {
          await window.storage.set(STORAGE_KEY, payload, false);
          showToast("No se pudo guardar de forma compartida todavía: se guardó solo en este dispositivo por ahora.");
        } catch (e2) {
          console.error("No se pudo guardar el estado", e2);
        }
      }
    }, 500);
    return () => clearTimeout(saveTimer.current);
  }, [departamentales, disciplines, categoryState, ignoredConflicts, transitionMinutes, matchResults, attendance, incidents, loaded]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  }

  const discipline = disciplines.find((d) => d.id === selDiscipline);
  const category = discipline && discipline.categories.find((c) => c.id === selCategory);
  const csKey = discipline && category ? `${discipline.id}::${category.id}` : null;
  const cs = (csKey && categoryState[csKey]) || {
    registrations: [],
    seedOrder: [],
    modality: "grupos",
    groupSize: 4,
    advancePerGroup: 2,
    groups: null,
    groupMatches: null,
    groupStandings: {},
    playoffMatches: null,
    drawMatches: null,
    drawn: false,
  };

  function updateCS(key, patch) {
    setCategoryState((prev) => ({
      ...prev,
      [key]: { ...(prev[key] || cs), ...patch },
    }));
  }

  /* ---------- matches globales (para calendario y conflictos) ---------- */
  function collectAllMatches() {
    const all = [];
    Object.entries(categoryState).forEach(([key, state]) => {
      const [dId, cId] = key.split("::");
      const disc = disciplines.find((d) => d.id === dId);
      if (!disc) return;
      const catObj = disc.categories.find((c) => c.id === cId);
      const catName = catObj ? catObj.name : "?";
      const push = (m, stage) => {
        if (!m.day || !m.time) return;
        all.push({
          ...m,
          key,
          disciplineId: dId,
          disciplineName: disc.name,
          categoryName: catName,
          stage,
          duration: disc.duration,
        });
      };
      (state.groupMatches || []).forEach((m) => push(m, "Grupos"));
      (state.playoffMatches || []).forEach((m) => push(m, "Playoff"));
      (state.drawMatches || []).forEach((m) => push(m, "Llave"));
    });
    return all;
  }

  function computeConflicts(allMatches) {
    const conflicts = [];
    for (let i = 0; i < allMatches.length; i++) {
      for (let j = i + 1; j < allMatches.length; j++) {
        const m1 = allMatches[i], m2 = allMatches[j];
        if (m1.key === m2.key && m1.id === m2.id) continue;
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

  const allMatches = collectAllMatches();
  const conflicts = computeConflicts(allMatches).filter((c) => !ignoredConflicts[c.pairId]);

  /* ---------- inscripciones ---------- */
  function toggleDept(deptName) {
    if (!csKey) return;
    const has = cs.registrations.some((r) => r.dept === deptName);
    if (has) {
      updateCS(csKey, {
        registrations: cs.registrations.filter((r) => r.dept !== deptName),
        drawn: false,
      });
    } else {
      updateCS(csKey, {
        registrations: [...cs.registrations, { id: uid(), dept: deptName, num: 1 }],
        drawn: false,
      });
    }
  }
  function addExtraTeam(deptName) {
    const count = cs.registrations.filter((r) => r.dept === deptName).length;
    if (count >= (category.maxTeams || 1)) return;
    updateCS(csKey, {
      registrations: [...cs.registrations, { id: uid(), dept: deptName, num: count + 1 }],
      drawn: false,
    });
  }
  function removeTeamEntry(regId) {
    updateCS(csKey, {
      registrations: cs.registrations.filter((r) => r.id !== regId),
      drawn: false,
    });
  }
  function teamLabel(reg) {
    const count = cs.registrations.filter((r) => r.dept === reg.dept).length;
    return count > 1 ? `${reg.dept} ${reg.num}` : reg.dept;
  }
  const registeredLabels = cs.registrations.map(teamLabel);

  /* ---------- antecedentes ---------- */
  function moveSeed(label, dir) {
    const list = cs.seedOrder.filter((l) => registeredLabels.includes(l));
    const others = registeredLabels.filter((l) => !list.includes(l));
    const full = [...list];
    const idx = full.indexOf(label);
    if (idx === -1) {
      full.push(label);
      updateCS(csKey, { seedOrder: full });
      return;
    }
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= full.length) return;
    [full[idx], full[newIdx]] = [full[newIdx], full[idx]];
    updateCS(csKey, { seedOrder: full });
  }
  function removeSeed(label) {
    updateCS(csKey, { seedOrder: cs.seedOrder.filter((l) => l !== label) });
  }
  const [pasteText, setPasteText] = useState("");
  function parsePaste() {
    const lines = pasteText.split("\n").map((l) => l.trim()).filter(Boolean);
    const matched = [];
    lines.forEach((line) => {
      const found = registeredLabels.find(
        (l) => l.toLowerCase() === line.toLowerCase() || baseDept(l).toLowerCase() === line.toLowerCase()
      );
      if (found && !matched.includes(found)) matched.push(found);
    });
    updateCS(csKey, { seedOrder: matched });
    showToast(`Se reconocieron ${matched.length} de ${lines.length} líneas pegadas.`);
  }

  /* ---------- sorteo ---------- */
  function runDraw() {
    if (!discipline || !category) return;
    const teams = registeredLabels;
    if (teams.length < 2) {
      showToast("Hace falta al menos 2 equipos/participantes inscriptos.");
      return;
    }
    const order = buildSeedOrder(teams, cs.seedOrder);

    if (cs.modality === "draw") {
      const matches = buildDrawMatches(order);
      const schedulable = matches.filter((m) => !m.placeholder && !m.bye);
      const otherMatches = collectAllMatches().filter((m) => m.key !== csKey);
      const { assignments, unresolved } = assignSlotsAvoidingConflicts(schedulable, discipline, transitionMinutes, otherMatches);
      const withSlots = matches.map((m) => {
        if (m.placeholder || m.bye) return { ...m, day: null, time: null, court: null };
        const s = assignments[m.id];
        return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null };
      });
      updateCS(csKey, { drawMatches: withSlots, groups: null, groupMatches: null, playoffMatches: null, drawn: true });
      showToast(
        unresolved > 0
          ? `Sorteo por llave generado. No se pudieron evitar ${unresolved} superposición(es) horaria(s) con otras disciplinas — revisalas en "Fixture y conflictos".`
          : "Sorteo por llave generado sin superposiciones horarias detectadas con otras disciplinas."
      );
      return;
    }

    // grupos / grupos_playoff
    const groups = distributeGroupsSnake(order, cs.groupSize || 4);
    let flatMatches = [];
    groups.forEach((g, gi) => {
      const rounds = roundRobinRounds(g);
      rounds.forEach((round, ri) => {
        round.forEach((m) => {
          flatMatches.push({
            id: uid(),
            group: gi,
            groupLabel: `Grupo ${groupLetter(gi)}`,
            round: ri + 1,
            teamA: m.teamA,
            teamB: m.teamB,
          });
        });
      });
    });
    // ordenar por ronda para que el pool de horarios respete el orden de fecha
    flatMatches.sort((a, b) => a.round - b.round);
    const otherMatchesGrupos = collectAllMatches().filter((m) => m.key !== csKey);
    const { assignments: groupAssignments, unresolved: groupUnresolved } = assignSlotsAvoidingConflicts(
      flatMatches, discipline, transitionMinutes, otherMatchesGrupos
    );
    flatMatches = flatMatches.map((m) => {
      const s = groupAssignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null };
    });

    updateCS(csKey, {
      groups,
      groupMatches: flatMatches,
      groupStandings: {},
      playoffMatches: cs.modality === "grupos_playoff" ? [] : null,
      drawMatches: null,
      drawn: true,
    });
    showToast(
      `Sorteo de grupos generado (${groups.length} grupo/s).` +
        (groupUnresolved > 0
          ? ` No se pudieron evitar ${groupUnresolved} superposición(es) horaria(s) con otras disciplinas — revisalas en "Fixture y conflictos".`
          : " Sin superposiciones horarias detectadas con otras disciplinas.")
    );
  }

  function setStanding(groupIndex, rank, label) {
    const gs = { ...(cs.groupStandings || {}) };
    const arr = (gs[groupIndex] || []).slice();
    arr[rank] = label;
    gs[groupIndex] = arr;
    updateCS(csKey, { groupStandings: gs });
  }

  function generatePlayoff() {
    const k = cs.advancePerGroup || 2;
    const qualifiers = [];
    for (let r = 0; r < k; r++) {
      (cs.groups || []).forEach((g, gi) => {
        const standing = (cs.groupStandings[gi] || [])[r];
        qualifiers.push(standing || `${r + 1}° Grupo ${groupLetter(gi)}`);
      });
    }
    const matches = buildDrawMatches(qualifiers);
    const schedulable = matches.filter((m) => !m.placeholder && !m.bye);
    // acá NO filtramos csKey: los partidos de grupos de esta misma categoría ya
    // ocupan horarios reales y hay que respetarlos también para el playoff.
    const otherMatchesPlayoff = collectAllMatches();
    const { assignments: playoffAssignments, unresolved: playoffUnresolved } = assignSlotsAvoidingConflicts(
      schedulable, discipline, transitionMinutes, otherMatchesPlayoff
    );
    const withSlots = matches.map((m) => {
      if (m.placeholder || m.bye) return { ...m, day: null, time: null, court: null };
      const s = playoffAssignments[m.id];
      return { ...m, day: s ? s.day : null, time: s ? s.time : null, court: s ? s.court : null };
    });
    updateCS(csKey, { playoffMatches: withSlots });
    showToast(
      playoffUnresolved > 0
        ? `Llave de playoff generada. No se pudieron evitar ${playoffUnresolved} superposición(es) horaria(s) — revisalas en "Fixture y conflictos".`
        : "Llave de playoff generada a partir de las posiciones cargadas, sin superposiciones horarias detectadas."
    );
  }

  /* ---------- reprogramación de un partido ---------- */
  function rescheduleMatch(matchKey, matchId, stage, day, time, court) {
    setCategoryState((prev) => {
      const state = { ...(prev[matchKey] || {}) };
      const field = stage === "Grupos" ? "groupMatches" : stage === "Playoff" ? "playoffMatches" : "drawMatches";
      const list = (state[field] || []).map((m) => (m.id === matchId ? { ...m, day, time, court } : m));
      return { ...prev, [matchKey]: { ...state, [field]: list } };
    });
  }

  /* ---------- autoresolver una superposición detectada, moviendo m2 ---------- */
  function autoResolveConflict(conflict) {
    const m2 = conflict.m2;
    const disc = disciplines.find((d) => d.id === m2.disciplineId);
    if (!disc) {
      showToast("No se encontró la disciplina de ese partido para reprogramarlo.");
      return;
    }
    const otherMatches = allMatches.filter((m) => m.id !== m2.id);
    const poolSize = disc.venues.length * disc.courts * 6 + 12;
    const pool = buildSlotPool(disc, poolSize, transitionMinutes);
    const depts = [baseDept(m2.teamA), baseDept(m2.teamB)].filter(Boolean);
    const usedInDisc = new Set(
      otherMatches.filter((m) => m.disciplineId === m2.disciplineId).map((m) => `${m.day}::${m.time}::${m.court}`)
    );
    const found = pool.find((s) => {
      const key = `${s.day}::${s.time}::${s.court}`;
      if (usedInDisc.has(key)) return false;
      return !depts.some((d) =>
        otherMatches.some((m) => {
          const mDepts = [baseDept(m.teamA), baseDept(m.teamB)].filter(Boolean);
          return mDepts.includes(d) && overlaps({ day: s.day, time: s.time }, disc.duration, m, m.duration, transitionMinutes);
        })
      );
    });
    if (!found) {
      showToast("No encontré un horario libre sin superposición dentro de las sedes/horarios ya definidos para esa disciplina. Puede hacer falta sumar una sede/franja horaria extra.");
      return;
    }
    rescheduleMatch(m2.key, m2.id, m2.stage, found.day, found.time, found.court);
    showToast(`Partido reprogramado automáticamente a ${found.day} ${found.time} (cancha ${found.court}) para evitar la superposición.`);
  }

  /* ---------- auditor: resultados por partido ---------- */
  function setMatchResult(matchId, patch) {
    setMatchResults((prev) => ({
      ...prev,
      [matchId]: { jugado: false, resultado: "", ganador: "", horaInicioReal: "", horaFinReal: "", novedades: "", ...(prev[matchId] || {}), ...patch },
    }));
  }

  /* ---------- auditor: asistencia por día y departamental ---------- */
  function toggleAttendance(day, deptName) {
    const key = `${day}::${deptName}`;
    setAttendance((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  /* ---------- auditor: incidencias ---------- */
  function addIncident(data) {
    setIncidents((prev) => [
      { id: uid(), estado: "Abierta", ...data },
      ...prev,
    ]);
    showToast("Incidencia registrada.");
  }
  function updateIncident(id, patch) {
    setIncidents((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function removeIncident(id) {
    if (!confirm("¿Eliminar esta incidencia del registro?")) return;
    setIncidents((prev) => prev.filter((i) => i.id !== id));
  }

  /* ---------- gestión de departamentales ---------- */
  function addDept() {
    const name = prompt("Nombre de la Departamental / Institución:");
    if (name && name.trim()) setDepartamentales((prev) => [...prev, { id: uid(), name: name.trim() }]);
  }
  function renameDept(id) {
    const dept = departamentales.find((d) => d.id === id);
    const name = prompt("Nuevo nombre:", dept.name);
    if (name && name.trim()) {
      const oldName = dept.name;
      setDepartamentales((prev) => prev.map((d) => (d.id === id ? { ...d, name: name.trim() } : d)));
      // actualizar referencias existentes
      setCategoryState((prev) => {
        const copy = { ...prev };
        Object.keys(copy).forEach((k) => {
          copy[k] = {
            ...copy[k],
            registrations: (copy[k].registrations || []).map((r) =>
              r.dept === oldName ? { ...r, dept: name.trim() } : r
            ),
          };
        });
        return copy;
      });
    }
  }
  function removeDept(id) {
    if (!confirm("¿Eliminar esta departamental? No se borrarán sus inscripciones ya cargadas.")) return;
    setDepartamentales((prev) => prev.filter((d) => d.id !== id));
  }

  /* ---------- gestión de disciplinas ---------- */
  function updateDiscipline(id, patch) {
    setDisciplines((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  }
  function addVenue(discId) {
    setDisciplines((prev) =>
      prev.map((d) =>
        d.id === discId ? { ...d, venues: [...d.venues, { day: DAYS[0], time: "09:00" }] } : d
      )
    );
  }
  function updateVenue(discId, idx, patch) {
    setDisciplines((prev) =>
      prev.map((d) => {
        if (d.id !== discId) return d;
        const venues = d.venues.map((v, i) => (i === idx ? { ...v, ...patch } : v));
        return { ...d, venues };
      })
    );
  }
  function removeVenue(discId, idx) {
    setDisciplines((prev) =>
      prev.map((d) => (d.id === discId ? { ...d, venues: d.venues.filter((_, i) => i !== idx) } : d))
    );
  }
  function addCategory(discId) {
    const name = prompt("Nombre de la nueva categoría:");
    if (!name || !name.trim()) return;
    setDisciplines((prev) =>
      prev.map((d) => (d.id === discId ? { ...d, categories: [...d.categories, cat(name.trim())] } : d))
    );
  }
  function removeCategory(discId, catId) {
    if (!confirm("¿Eliminar esta categoría? Se perderá su sorteo si ya se realizó.")) return;
    setDisciplines((prev) =>
      prev.map((d) =>
        d.id === discId ? { ...d, categories: d.categories.filter((c) => c.id !== catId) } : d
      )
    );
  }

  /* ---------- auditor: estadísticas agregadas ---------- */
  const totalCategoriasDefinidas = disciplines.reduce((acc, d) => acc + d.categories.length, 0);
  const categoriasConSorteo = Object.values(categoryState).filter((c) => c.drawn).length;
  const totalEquiposInscriptos = Object.values(categoryState).reduce(
    (acc, c) => acc + ((c.registrations && c.registrations.length) || 0), 0
  );
  const partidosJugados = allMatches.filter((m) => matchResults[m.id] && matchResults[m.id].jugado).length;
  const partidosPendientes = allMatches.length - partidosJugados;
  const incidenciasAbiertas = incidents.filter((i) => i.estado !== "Resuelta").length;
  const asistenciaPorDia = DAYS.map((day) => {
    const presentes = departamentales.filter((d) => attendance[`${day}::${d.name}`]).length;
    return { day, presentes, total: departamentales.length };
  });

  /* ------------------------------------------------------------------ */
  /*  RENDER                                                             */
  /* ------------------------------------------------------------------ */

  const TABS = [
    { id: "departamentales", label: "Departamentales", icon: Users },
    { id: "disciplinas", label: "Disciplinas y sedes", icon: Settings2 },
    { id: "inscripciones", label: "Inscripciones", icon: ClipboardList },
    { id: "antecedentes", label: "Antecedentes", icon: ListChecks },
    { id: "sorteo", label: "Sorteo", icon: Shuffle },
    { id: "calendario", label: "Fixture y conflictos", icon: CalendarDays },
    { id: "auditor", label: "Auditor de jornadas", icon: ClipboardCheck },
  ];

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101C33] text-[#C9A227] text-sm">
        Cargando…
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#101C33] px-4">
        <div className="bg-[#16233F] rounded-xl border border-[#24334F] shadow-sm p-8 max-w-sm w-full">
          <p className="text-xs tracking-[0.25em] uppercase text-[#93A0BB] font-semibold mb-1">
            Colegio de Magistrados y Funcionarios
          </p>
          <h1 className="text-lg font-bold text-[#C9A227] mb-4">
            Sorteo Fixtures Jornadas Necochea — Acceso restringido
          </h1>
          {passphraseExists ? (
            <>
              <p className="text-sm text-[#93A0BB] mb-3">Ingresá la contraseña de acceso para esta herramienta.</p>
              <input
                type="password"
                className="w-full border border-[#2B3B5C] rounded-lg px-3 py-2 text-sm mb-2"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitLogin()}
                placeholder="Contraseña"
                autoFocus
              />
              {authError && <p className="text-xs text-[#E0684A] mb-2">{authError}</p>}
              <button onClick={submitLogin} className="w-full bg-[#C9A227] text-[#132A4C] text-sm font-medium py-2 rounded-lg hover:bg-[#A9841C]">
                Entrar
              </button>
              <button onClick={resetAccess} className="w-full text-center text-xs text-[#7484A3] hover:text-[#E0684A] underline underline-offset-2 mt-3">
                ¿Problemas para entrar? Restablecer acceso
              </button>
            </>
          ) : (
            <>
              <p className="text-sm text-[#93A0BB] mb-3">
                Todavía no se configuró una contraseña para este link. Definila ahora: quedará compartida para todos los que lo abran.
              </p>
              <input
                type="password"
                className="w-full border border-[#2B3B5C] rounded-lg px-3 py-2 text-sm mb-2"
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder="Nueva contraseña"
              />
              <input
                type="password"
                className="w-full border border-[#2B3B5C] rounded-lg px-3 py-2 text-sm mb-2"
                value={passInput2}
                onChange={(e) => setPassInput2(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitNewPassphrase()}
                placeholder="Repetir contraseña"
              />
              {authError && <p className="text-xs text-[#E0684A] mb-2">{authError}</p>}
              <button onClick={submitNewPassphrase} className="w-full bg-[#132A4C] text-[#C9A227] text-sm font-semibold py-2 rounded-lg hover:brightness-95">
                Guardar y entrar
              </button>
              <button onClick={() => setAuthed(true)} className="w-full text-center text-xs text-[#7484A3] hover:text-[#C9A227] underline underline-offset-2 mt-3">
                Entrar sin configurar contraseña por ahora
              </button>
            </>
          )}
          <p className="text-[11px] text-[#7484A3] mt-4 leading-snug">
            Esto es un filtro básico para evitar accesos casuales, no una autenticación segura: alguien con conocimientos técnicos podría igualmente sortearla.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#101C33] text-[#EDE7D6]" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* header */}
      <div className="bg-[#C9A227] text-[#101C33] border-b-4 border-[#132A4C]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-[#132A4C] font-semibold">
              Colegio de Magistrados y Funcionarios · Pcia. de Buenos Aires
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
              Sorteo Fixtures Jornadas Necochea
            </h1>
            <p className="text-[11px] text-[#4A5D82] mt-1">
              Datos compartidos: todo lo que se carga o modifica acá es visible y editable por cualquiera que entre con este mismo link.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={changePassphrase}
              className="text-xs text-[#4A5D82] hover:text-[#132A4C] underline underline-offset-2 hidden sm:block"
            >
              Cambiar contraseña
            </button>
            <button
              onClick={() => setAuthed(false)}
              className="text-xs text-[#4A5D82] hover:text-[#132A4C] underline underline-offset-2"
            >
              Salir
            </button>
            <Trophy className="w-10 h-10 text-[#132A4C] hidden md:block" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-1 pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  active ? "bg-[#101C33] text-[#C9A227]" : "text-[#4A5D82] hover:bg-[#A9841C]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.id === "calendario" && conflicts.length > 0 && (
                  <span className="ml-1 bg-[#E0684A] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                    {conflicts.length}
                  </span>
                )}
                {t.id === "auditor" && incidenciasAbiertas > 0 && (
                  <span className="ml-1 bg-[#E0684A] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                    {incidenciasAbiertas}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {tab === "departamentales" && (
          <DepartamentalesTab
            departamentales={departamentales}
            addDept={addDept}
            renameDept={renameDept}
            removeDept={removeDept}
          />
        )}

        {tab === "disciplinas" && (
          <DisciplinasTab
            disciplines={disciplines}
            updateDiscipline={updateDiscipline}
            addVenue={addVenue}
            updateVenue={updateVenue}
            removeVenue={removeVenue}
            addCategory={addCategory}
            removeCategory={removeCategory}
            transitionMinutes={transitionMinutes}
            setTransitionMinutes={setTransitionMinutes}
          />
        )}

        {tab === "inscripciones" && (
          <SelectorBar
            disciplines={disciplines}
            selDiscipline={selDiscipline}
            setSelDiscipline={(id) => {
              setSelDiscipline(id);
              const d = disciplines.find((x) => x.id === id);
              setSelCategory(d.categories[0].id);
            }}
            selCategory={selCategory}
            setSelCategory={setSelCategory}
          >
            <InscripcionesTab
              departamentales={departamentales}
              category={category}
              cs={cs}
              toggleDept={toggleDept}
              addExtraTeam={addExtraTeam}
              removeTeamEntry={removeTeamEntry}
              teamLabel={teamLabel}
            />
          </SelectorBar>
        )}

        {tab === "antecedentes" && (
          <SelectorBar
            disciplines={disciplines}
            selDiscipline={selDiscipline}
            setSelDiscipline={(id) => {
              setSelDiscipline(id);
              const d = disciplines.find((x) => x.id === id);
              setSelCategory(d.categories[0].id);
            }}
            selCategory={selCategory}
            setSelCategory={setSelCategory}
          >
            <AntecedentesTab
              registeredLabels={registeredLabels}
              cs={cs}
              moveSeed={moveSeed}
              removeSeed={removeSeed}
              pasteText={pasteText}
              setPasteText={setPasteText}
              parsePaste={parsePaste}
            />
          </SelectorBar>
        )}

        {tab === "sorteo" && (
          <SelectorBar
            disciplines={disciplines}
            selDiscipline={selDiscipline}
            setSelDiscipline={(id) => {
              setSelDiscipline(id);
              const d = disciplines.find((x) => x.id === id);
              setSelCategory(d.categories[0].id);
            }}
            selCategory={selCategory}
            setSelCategory={setSelCategory}
          >
            <SorteoTab
              discipline={discipline}
              category={category}
              cs={cs}
              csKey={csKey}
              updateCS={updateCS}
              registeredLabels={registeredLabels}
              runDraw={runDraw}
              setStanding={setStanding}
              generatePlayoff={generatePlayoff}
              conflicts={conflicts}
              transitionMinutes={transitionMinutes}
            />
          </SelectorBar>
        )}

        {tab === "calendario" && (
          <CalendarioTab
            allMatches={allMatches}
            conflicts={conflicts}
            ignoredConflicts={ignoredConflicts}
            setIgnoredConflicts={setIgnoredConflicts}
            rescheduleMatch={rescheduleMatch}
            autoResolveConflict={autoResolveConflict}
            departamentales={departamentales}
          />
        )}

        {tab === "auditor" && (
          <AuditorTab
            allMatches={allMatches}
            matchResults={matchResults}
            setMatchResult={setMatchResult}
            disciplines={disciplines}
            departamentales={departamentales}
            attendance={attendance}
            toggleAttendance={toggleAttendance}
            incidents={incidents}
            addIncident={addIncident}
            updateIncident={updateIncident}
            removeIncident={removeIncident}
            conflicts={conflicts}
            stats={{
              totalCategoriasDefinidas,
              categoriasConSorteo,
              totalEquiposInscriptos,
              partidosProgramados: allMatches.length,
              partidosJugados,
              partidosPendientes,
              incidenciasAbiertas,
              asistenciaPorDia,
            }}
          />
        )}
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 bg-[#C9A227] text-[#132A4C] px-4 py-3 rounded-lg shadow-lg text-sm max-w-sm">
          {toast}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SUBCOMPONENTES                                                      */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`bg-[#16233F] rounded-xl border border-[#24334F] shadow-sm ${className}`}>{children}</div>
  );
}

function SelectorBar({ disciplines, selDiscipline, setSelDiscipline, selCategory, setSelCategory, children }) {
  const discipline = disciplines.find((d) => d.id === selDiscipline);
  return (
    <div>
      <Card className="p-4 mb-5 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-1">
            Disciplina
          </label>
          <select
            className="border border-[#2B3B5C] rounded-lg px-3 py-2 text-sm min-w-[220px]"
            value={selDiscipline}
            onChange={(e) => setSelDiscipline(e.target.value)}
          >
            {disciplines.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-1">
            Categoría
          </label>
          <select
            className="border border-[#2B3B5C] rounded-lg px-3 py-2 text-sm min-w-[220px]"
            value={selCategory}
            onChange={(e) => setSelCategory(e.target.value)}
          >
            {discipline && discipline.categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="text-xs text-[#93A0BB] flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          {discipline ? `${discipline.courts} cancha(s)/mesa(s) · ${discipline.duration} min por partido` : ""}
        </div>
      </Card>
      {children}
    </div>
  );
}

function DepartamentalesTab({ departamentales, addDept, renameDept, removeDept }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">Departamentales / Instituciones participantes</h2>
        <button onClick={addDept} className="flex items-center gap-1.5 bg-[#C9A227] text-[#132A4C] text-sm px-3 py-2 rounded-lg hover:bg-[#A9841C]">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
      <p className="text-sm text-[#93A0BB] mb-4">
        Lista precargada con los Departamentos Judiciales de la Provincia + el invitado del Poder Judicial Nacional. Editala según quiénes participen realmente en esta edición.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {departamentales.map((d) => (
          <div key={d.id} className="flex items-center justify-between border border-[#24334F] rounded-lg px-3 py-2 text-sm">
            <span>{d.name}</span>
            <div className="flex gap-1">
              <button onClick={() => renameDept(d.id)} className="text-[#93A0BB] hover:text-[#C9A227] px-1">✎</button>
              <button onClick={() => removeDept(d.id)} className="text-[#93A0BB] hover:text-[#E0684A] px-1"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function DisciplinasTab({ disciplines, updateDiscipline, addVenue, updateVenue, removeVenue, addCategory, removeCategory, transitionMinutes, setTransitionMinutes }) {
  return (
    <div className="space-y-4">
      <Card className="p-5 border-[#132A4C]">
        <h3 className="font-bold text-base mb-1">Configuración general</h3>
        <p className="text-sm text-[#93A0BB] mb-3">
          Minutos de transición y calentamiento que se reservan entre el final de un partido y el inicio del siguiente en la misma cancha/mesa. También se usa para detectar si un mismo equipo queda con menos margen que este entre dos partidos, aunque no lleguen a pisarse literalmente.
        </p>
        <label className="text-sm">
          Minutos de transición
          <input
            type="number" min={0}
            className="block w-24 border border-[#2B3B5C] rounded-lg px-2 py-1 mt-1"
            value={transitionMinutes}
            onChange={(e) => setTransitionMinutes(Math.max(0, Number(e.target.value) || 0))}
          />
        </label>
      </Card>
      <p className="text-sm text-[#93A0BB]">
        Cantidad de canchas/mesas, duración estimada de cada partido, ventanas horarias (día + hora de inicio, tomadas del cronograma provisorio) y categorías por disciplina. Todo editable.
      </p>
      {disciplines.map((d) => (
        <Card key={d.id} className="p-5">
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <h3 className="font-bold text-base flex-1 min-w-[160px]">{d.name}</h3>
            <label className="text-xs text-[#93A0BB]">
              Canchas/mesas
              <input
                type="number" min={1}
                className="block w-20 border border-[#2B3B5C] rounded-lg px-2 py-1 mt-1"
                value={d.courts}
                onChange={(e) => updateDiscipline(d.id, { courts: Math.max(1, Number(e.target.value) || 1) })}
              />
            </label>
            <label className="text-xs text-[#93A0BB]">
              Duración (min)
              <input
                type="number" min={5}
                className="block w-24 border border-[#2B3B5C] rounded-lg px-2 py-1 mt-1"
                value={d.duration}
                onChange={(e) => updateDiscipline(d.id, { duration: Math.max(5, Number(e.target.value) || 5) })}
              />
            </label>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB]">Ventanas horarias</p>
                <button onClick={() => addVenue(d.id)} className="text-xs flex items-center gap-1 text-[#C9A227] hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </div>
              <div className="space-y-1.5">
                {d.venues.map((v, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <select
                      className="border border-[#2B3B5C] rounded px-2 py-1 text-xs"
                      value={v.day}
                      onChange={(e) => updateVenue(d.id, i, { day: e.target.value })}
                    >
                      {DAYS.map((day) => <option key={day} value={day}>{day}</option>)}
                    </select>
                    <input
                      type="time"
                      className="border border-[#2B3B5C] rounded px-2 py-1 text-xs"
                      value={v.time}
                      onChange={(e) => updateVenue(d.id, i, { time: e.target.value })}
                    />
                    <button onClick={() => removeVenue(d.id, i)} className="text-[#93A0BB] hover:text-[#E0684A]">
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                {d.venues.length === 0 && <p className="text-xs text-[#7484A3]">Sin ventanas horarias cargadas.</p>}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB]">Categorías</p>
                <button onClick={() => addCategory(d.id)} className="text-xs flex items-center gap-1 text-[#C9A227] hover:underline">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.categories.map((c) => (
                  <span key={c.id} className="flex items-center gap-1 bg-[#101C33] border border-[#24334F] rounded-full px-2.5 py-1 text-xs">
                    {c.name}
                    {c.maxTeams > 1 && <span className="text-[#C9A227] font-semibold">×{c.maxTeams}</span>}
                    <button onClick={() => removeCategory(d.id, c.id)} className="text-[#7484A3] hover:text-[#E0684A]">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function InscripcionesTab({ departamentales, category, cs, toggleDept, addExtraTeam, removeTeamEntry, teamLabel }) {
  if (!category) return null;
  return (
    <Card className="p-5">
      <h2 className="font-bold text-lg mb-1">Inscriptos — {category.name}</h2>
      <p className="text-sm text-[#93A0BB] mb-4">
        Tildá las departamentales que participan en esta categoría. {category.maxTeams > 1 && `Esta categoría admite hasta ${category.maxTeams} equipos/participantes por departamental: usá "+" para sumar otro, se numerarán en orden ascendente.`}
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-5">
        {departamentales.map((dep) => {
          const entries = cs.registrations.filter((r) => r.dept === dep.name);
          const checked = entries.length > 0;
          return (
            <div key={dep.id} className={`border rounded-lg px-3 py-2 text-sm ${checked ? "border-[#132A4C] bg-[#2A2410]" : "border-[#24334F]"}`}>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={checked} onChange={() => toggleDept(dep.name)} />
                <span className="flex-1">{dep.name}</span>
                {category.maxTeams > 1 && checked && (
                  <button
                    onClick={() => addExtraTeam(dep.name)}
                    disabled={entries.length >= category.maxTeams}
                    className="text-[#C9A227] disabled:text-[#3A4A68]"
                    title="Agregar otro equipo de esta departamental"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </label>
              {checked && entries.length > 1 && (
                <div className="mt-1 pl-6 flex flex-wrap gap-1">
                  {entries.map((e) => (
                    <span key={e.id} className="text-xs bg-[#16233F] border border-[#24334F] rounded px-1.5 py-0.5 flex items-center gap-1">
                      {teamLabel(e)}
                      <button onClick={() => removeTeamEntry(e.id)}><X className="w-3 h-3 text-[#7484A3]" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-sm font-medium">Total inscriptos: {cs.registrations.length}</p>
    </Card>
  );
}

function AntecedentesTab({ registeredLabels, cs, moveSeed, removeSeed, pasteText, setPasteText, parsePaste }) {
  const seeded = cs.seedOrder.filter((l) => registeredLabels.includes(l));
  const unseeded = registeredLabels.filter((l) => !seeded.includes(l));
  return (
    <Card className="p-5">
      <h2 className="font-bold text-lg mb-1">Antecedentes (torneo anterior)</h2>
      <p className="text-sm text-[#93A0BB] mb-4">
        Ordená de mejor a peor posición del año anterior a los equipos que ya están inscriptos en esta categoría. Los que no tengan antecedente entran sin sembrar (orden aleatorio) al sortear.
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-2">Orden de siembra actual</p>
          {seeded.length === 0 && <p className="text-sm text-[#7484A3] mb-2">Sin antecedentes cargados aún.</p>}
          <ol className="space-y-1.5 mb-4">
            {seeded.map((label, i) => (
              <li key={label} className="flex items-center gap-2 bg-[#101C33] border border-[#24334F] rounded-lg px-3 py-1.5 text-sm">
                <span className="font-mono text-[#C9A227] font-semibold w-5">{i + 1}</span>
                <span className="flex-1">{label}</span>
                <button onClick={() => moveSeed(label, -1)} className="text-[#93A0BB]"><ChevronUp className="w-4 h-4" /></button>
                <button onClick={() => moveSeed(label, 1)} className="text-[#93A0BB]"><ChevronDown className="w-4 h-4" /></button>
                <button onClick={() => removeSeed(label)} className="text-[#7484A3] hover:text-[#E0684A]"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ol>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-2">Sin antecedente — agregar</p>
          <div className="flex flex-wrap gap-1.5">
            {unseeded.map((label) => (
              <button
                key={label}
                onClick={() => moveSeed(label, 0)}
                className="text-xs border border-[#2B3B5C] rounded-full px-2.5 py-1 hover:bg-[#101C33]"
              >
                + {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-2">
            Pegar ranking desde Excel
          </p>
          <p className="text-xs text-[#93A0BB] mb-2">
            Copiá y pegá acá la columna de nombres de departamentales del año anterior, una por renglón, ordenada de 1° a último puesto. Se van a reconocer automáticamente los que coincidan con los inscriptos.
          </p>
          <textarea
            className="w-full border border-[#2B3B5C] rounded-lg px-3 py-2 text-sm h-40 font-mono"
            placeholder={"Necochea\nMar del Plata\nAzul\n..."}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
          <button onClick={parsePaste} className="mt-2 flex items-center gap-1.5 bg-[#C9A227] text-[#132A4C] text-sm px-3 py-2 rounded-lg hover:bg-[#A9841C]">
            <ListChecks className="w-4 h-4" /> Aplicar orden pegado
          </button>
        </div>
      </div>
    </Card>
  );
}

function SorteoTab({ discipline, category, cs, csKey, updateCS, registeredLabels, runDraw, setStanding, generatePlayoff, conflicts, transitionMinutes }) {
  if (!category) return null;
  const relevantConflicts = conflicts.filter((c) => c.m1.key === csKey || c.m2.key === csKey);

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <h2 className="font-bold text-lg mb-3">Modalidad de sorteo — {category.name}</h2>
        <div className="flex flex-wrap gap-3 mb-4">
          {[
            { id: "grupos", label: "Grupos" },
            { id: "grupos_playoff", label: "Grupos + Playoff" },
            { id: "draw", label: "Llave / Draw" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => updateCS(csKey, { modality: m.id })}
              className={`px-4 py-2 rounded-lg text-sm font-medium border ${
                cs.modality === m.id ? "bg-[#C9A227] text-[#132A4C] border-[#C9A227]" : "border-[#2B3B5C] text-[#C7CEDC]"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {(cs.modality === "grupos" || cs.modality === "grupos_playoff") && (
          <div className="flex flex-wrap gap-5 mb-4">
            <label className="text-sm">
              Participantes por grupo
              <input
                type="number" min={2}
                className="block w-24 border border-[#2B3B5C] rounded-lg px-2 py-1 mt-1"
                value={cs.groupSize}
                onChange={(e) => updateCS(csKey, { groupSize: Math.max(2, Number(e.target.value) || 2) })}
              />
            </label>
            {cs.modality === "grupos_playoff" && (
              <label className="text-sm">
                Avanzan por grupo a playoff
                <input
                  type="number" min={1}
                  className="block w-24 border border-[#2B3B5C] rounded-lg px-2 py-1 mt-1"
                  value={cs.advancePerGroup}
                  onChange={(e) => updateCS(csKey, { advancePerGroup: Math.max(1, Number(e.target.value) || 1) })}
                />
              </label>
            )}
          </div>
        )}

        <p className="text-sm text-[#93A0BB] mb-3">
          Inscriptos: {registeredLabels.length} · Con antecedente: {cs.seedOrder.filter((l) => registeredLabels.includes(l)).length} · Margen entre partidos: {transitionMinutes} min (editable en "Disciplinas y sedes")
        </p>

        <button
          onClick={runDraw}
          className="flex items-center gap-2 bg-[#132A4C] text-[#C9A227] font-semibold text-sm px-4 py-2.5 rounded-lg hover:brightness-95"
        >
          <Shuffle className="w-4 h-4" /> {cs.drawn ? "Rehacer sorteo" : "Realizar sorteo"}
        </button>
      </Card>

      {relevantConflicts.length > 0 && (
        <Card className="p-4 border-[#E0684A] bg-[#3A241F]">
          <p className="text-sm font-semibold text-[#E0684A] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> {relevantConflicts.length} superposición(es) horaria detectada(s) para esta categoría.
          </p>
          <p className="text-xs text-[#93A0BB] mt-1">Revisalas y resolvelas en la pestaña "Fixture y conflictos".</p>
        </Card>
      )}

      {cs.groups && (
        <Card className="p-5">
          <h3 className="font-bold mb-3">Grupos</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {cs.groups.map((g, gi) => (
              <div key={gi} className="border border-[#24334F] rounded-lg p-3">
                <p className="font-semibold text-sm mb-2">Grupo {groupLetter(gi)}</p>
                <ul className="text-sm mb-3 space-y-0.5">
                  {g.map((t) => <li key={t}>· {t}</li>)}
                </ul>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-1">Partidos</p>
                <ul className="text-xs font-mono space-y-1">
                  {(cs.groupMatches || []).filter((m) => m.group === gi).map((m) => (
                    <li key={m.id}>
                      {m.teamA} vs {m.teamB} — {m.day || "sin día"} {m.time || ""} {m.court ? `(cancha ${m.court})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      )}

      {cs.modality === "grupos_playoff" && cs.groups && (
        <Card className="p-5">
          <h3 className="font-bold mb-3">Posiciones finales de grupo (cargar cuando termine la fase de grupos)</h3>
          <div className="grid md:grid-cols-2 gap-4 mb-4">
            {cs.groups.map((g, gi) => (
              <div key={gi} className="border border-[#24334F] rounded-lg p-3">
                <p className="font-semibold text-sm mb-2">Grupo {groupLetter(gi)}</p>
                {Array.from({ length: cs.advancePerGroup }, (_, r) => (
                  <div key={r} className="flex items-center gap-2 mb-1.5 text-sm">
                    <span className="w-6 text-[#C9A227] font-mono font-semibold">{r + 1}°</span>
                    <select
                      className="flex-1 border border-[#2B3B5C] rounded px-2 py-1 text-sm"
                      value={(cs.groupStandings[gi] || [])[r] || ""}
                      onChange={(e) => setStanding(gi, r, e.target.value)}
                    >
                      <option value="">-- elegir equipo --</option>
                      {g.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <button
            onClick={generatePlayoff}
            className="flex items-center gap-2 bg-[#C9A227] text-[#132A4C] text-sm px-4 py-2.5 rounded-lg hover:bg-[#A9841C]"
          >
            <RefreshCw className="w-4 h-4" /> Generar llave de playoff
          </button>

          {cs.playoffMatches && cs.playoffMatches.length > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-1">Llave de playoff</p>
              <ul className="text-sm font-mono space-y-1">
                {cs.playoffMatches.map((m) => (
                  <li key={m.id}>
                    {m.label}: {m.teamA || "?"} vs {m.teamB || "?"} {m.day ? `— ${m.day} ${m.time} (cancha ${m.court})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      {cs.modality === "draw" && cs.drawMatches && (
        <Card className="p-5">
          <h3 className="font-bold mb-3">Llave</h3>
          {Array.from(new Set(cs.drawMatches.map((m) => m.round))).map((r) => (
            <div key={r} className="mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-1">
                {cs.drawMatches.find((m) => m.round === r).label && r === Math.max(...cs.drawMatches.map((m) => m.round))
                  ? "Final"
                  : `Ronda ${r}`}
              </p>
              <ul className="text-sm font-mono space-y-1">
                {cs.drawMatches.filter((m) => m.round === r).map((m) => (
                  <li key={m.id}>
                    {m.label}: {m.teamA || "?"} vs {m.bye ? "BYE (pasa directo)" : m.teamB || "?"}
                    {m.day ? ` — ${m.day} ${m.time} (cancha ${m.court})` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function CalendarioTab({ allMatches, conflicts, ignoredConflicts, setIgnoredConflicts, rescheduleMatch, autoResolveConflict, departamentales }) {
  const [filterDept, setFilterDept] = useState("");
  const sorted = allMatches
    .filter((m) => m.day)
    .filter((m) => !filterDept || baseDept(m.teamA) === filterDept || baseDept(m.teamB) === filterDept)
    .sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || parseHM(a.time) - parseHM(b.time));

  return (
    <div className="space-y-5">
      {conflicts.length > 0 && (
        <Card className="p-5 border-[#E0684A]">
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2 text-[#E0684A]">
            <AlertTriangle className="w-5 h-5" /> Superposiciones horarias detectadas ({conflicts.length})
          </h2>
          <div className="space-y-3">
            {conflicts.map((c) => (
              <div key={c.pairId} className="border border-[#5C3A32] bg-[#3A241F] rounded-lg p-3 text-sm">
                <p className="font-semibold mb-1">{c.dept} juega en dos lugares a la vez:</p>
                <p className="font-mono text-xs mb-1">
                  {c.m1.disciplineName} · {c.m1.categoryName} — {c.m1.teamA} vs {c.m1.teamB} — {c.m1.day} {c.m1.time}
                </p>
                <p className="font-mono text-xs mb-2">
                  {c.m2.disciplineName} · {c.m2.categoryName} — {c.m2.teamA} vs {c.m2.teamB} — {c.m2.day} {c.m2.time}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => setIgnoredConflicts((prev) => ({ ...prev, [c.pairId]: true }))}
                    className="flex items-center gap-1 text-xs bg-[#16233F] border border-[#2B3B5C] px-2.5 py-1.5 rounded-lg hover:bg-[#101C33]"
                  >
                    <Check className="w-3.5 h-3.5" /> Seguir igual con el sorteo
                  </button>
                  <button
                    onClick={() => autoResolveConflict(c)}
                    className="flex items-center gap-1 text-xs bg-[#C9A227] text-[#132A4C] px-2.5 py-1.5 rounded-lg hover:bg-[#A9841C]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Autoresolver (buscar horario libre)
                  </button>
                  <ReprogramarControl match={c.m2} rescheduleMatch={rescheduleMatch} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-bold text-lg">Fixture general</h2>
          <select
            className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
          >
            <option value="">Todas las departamentales</option>
            {departamentales.map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#93A0BB] border-b border-[#24334F]">
                <th className="py-2 pr-3">Día</th>
                <th className="py-2 pr-3">Hora</th>
                <th className="py-2 pr-3">Cancha</th>
                <th className="py-2 pr-3">Disciplina</th>
                <th className="py-2 pr-3">Categoría</th>
                <th className="py-2 pr-3">Etapa</th>
                <th className="py-2 pr-3">Partido</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((m) => {
                const inConflict = conflicts.some((c) => c.m1.id === m.id || c.m2.id === m.id);
                return (
                  <tr key={m.key + m.id} className={`border-b border-[#1E2C47] ${inConflict ? "bg-[#3A241F]" : ""}`}>
                    <td className="py-1.5 pr-3 font-mono">{m.day}</td>
                    <td className="py-1.5 pr-3 font-mono">{m.time}</td>
                    <td className="py-1.5 pr-3">{m.court}</td>
                    <td className="py-1.5 pr-3">{m.disciplineName}</td>
                    <td className="py-1.5 pr-3">{m.categoryName}</td>
                    <td className="py-1.5 pr-3">{m.stage}</td>
                    <td className="py-1.5 pr-3">{m.teamA || "?"} vs {m.bye ? "BYE" : m.teamB || "?"}</td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr><td colSpan={7} className="py-6 text-center text-[#7484A3]">Todavía no hay partidos sorteados y programados.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ReprogramarControl({ match, rescheduleMatch }) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(match.day);
  const [time, setTime] = useState(match.time);
  const [court, setCourt] = useState(match.court);
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1 text-xs bg-[#16233F] border border-[#2B3B5C] px-2.5 py-1.5 rounded-lg hover:bg-[#101C33]">
        <RefreshCw className="w-3.5 h-3.5" /> Reprogramar este partido
      </button>
    );
  }
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select className="border border-[#2B3B5C] rounded px-2 py-1 text-xs" value={day} onChange={(e) => setDay(e.target.value)}>
        {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <input type="time" className="border border-[#2B3B5C] rounded px-2 py-1 text-xs" value={time} onChange={(e) => setTime(e.target.value)} />
      <input type="number" min={1} className="border border-[#2B3B5C] rounded px-2 py-1 text-xs w-16" value={court} onChange={(e) => setCourt(Number(e.target.value))} />
      <button
        onClick={() => {
          rescheduleMatch(match.key, match.id, match.stage, day, time, court);
          setOpen(false);
        }}
        className="text-xs bg-[#C9A227] text-[#132A4C] px-2.5 py-1.5 rounded-lg"
      >
        Guardar
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AUDITOR DE DESARROLLO DE LAS JORNADAS                              */
/* ------------------------------------------------------------------ */

const INCIDENT_TYPES = [
  "Reclamo deportivo",
  "Lesión / asistencia médica",
  "Logística / infraestructura",
  "Conducta / disciplinario",
  "Otro",
];
const INCIDENT_STATES = ["Abierta", "En curso", "Resuelta"];

function estadoColor(estado) {
  if (estado === "Resuelta") return { bg: "#16261E", border: "#2E4A3A", text: "#4FAE72" };
  if (estado === "En curso") return { bg: "#2E2712", border: "#5C4A22", text: "#E0C15A" };
  return { bg: "#3A241F", border: "#5C3A32", text: "#E0684A" };
}

function AuditorTab({
  allMatches, matchResults, setMatchResult, disciplines, departamentales,
  attendance, toggleAttendance, incidents, addIncident, updateIncident, removeIncident,
  conflicts, stats,
}) {
  const [sub, setSub] = useState("resumen");
  const SUBS = [
    { id: "resumen", label: "Resumen", icon: BarChart3 },
    { id: "resultados", label: "Resultados", icon: CheckCircle2 },
    { id: "asistencia", label: "Asistencia", icon: UserCheck },
    { id: "incidencias", label: "Incidencias", icon: Siren },
  ];
  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-5 border-b border-[#24334F]">
        {SUBS.map((s) => {
          const Icon = s.icon;
          const active = sub === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSub(s.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                active ? "bg-[#16233F] border border-b-0 border-[#24334F] text-[#C9A227]" : "text-[#93A0BB] hover:text-[#C9A227]"
              }`}
            >
              <Icon className="w-4 h-4" />
              {s.label}
              {s.id === "incidencias" && stats.incidenciasAbiertas > 0 && (
                <span className="ml-1 bg-[#E0684A] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                  {stats.incidenciasAbiertas}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {sub === "resumen" && (
        <AuditorResumen allMatches={allMatches} matchResults={matchResults} disciplines={disciplines} conflicts={conflicts} stats={stats} />
      )}
      {sub === "resultados" && (
        <AuditorResultados allMatches={allMatches} matchResults={matchResults} setMatchResult={setMatchResult} disciplines={disciplines} conflicts={conflicts} />
      )}
      {sub === "asistencia" && (
        <AuditorAsistencia departamentales={departamentales} attendance={attendance} toggleAttendance={toggleAttendance} stats={stats} />
      )}
      {sub === "incidencias" && (
        <AuditorIncidencias
          disciplines={disciplines}
          departamentales={departamentales}
          incidents={incidents}
          addIncident={addIncident}
          updateIncident={updateIncident}
          removeIncident={removeIncident}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub, tone = "neutral" }) {
  const tones = {
    neutral: "text-[#C9A227]",
    good: "text-[#4FAE72]",
    warn: "text-[#E0C15A]",
    bad: "text-[#E0684A]",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-1">{label}</p>
      <p className={`text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {sub && <p className="text-xs text-[#7484A3] mt-0.5">{sub}</p>}
    </Card>
  );
}

function AuditorResumen({ allMatches, matchResults, disciplines, conflicts, stats }) {
  const porDisciplina = disciplines.map((d) => {
    const ms = allMatches.filter((m) => m.disciplineId === d.id);
    const jugados = ms.filter((m) => matchResults[m.id] && matchResults[m.id].jugado).length;
    return { id: d.id, name: d.name, programados: ms.length, jugados };
  }).filter((d) => d.programados > 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Categorías sorteadas" value={`${stats.categoriasConSorteo}/${stats.totalCategoriasDefinidas}`} />
        <StatCard label="Equipos inscriptos" value={stats.totalEquiposInscriptos} />
        <StatCard label="Partidos programados" value={stats.partidosProgramados} />
        <StatCard label="Partidos jugados" value={stats.partidosJugados} tone="good" sub={`${stats.partidosPendientes} pendientes`} />
        <StatCard
          label="Conflictos horarios"
          value={conflicts.length}
          tone={conflicts.length > 0 ? "bad" : "good"}
          sub={conflicts.length > 0 ? "sin resolver" : "sin superposiciones"}
        />
        <StatCard
          label="Incidencias abiertas"
          value={stats.incidenciasAbiertas}
          tone={stats.incidenciasAbiertas > 0 ? "bad" : "good"}
        />
      </div>

      <Card className="p-5">
        <h3 className="font-bold mb-3">Asistencia general por día</h3>
        <div className="grid sm:grid-cols-3 gap-3">
          {stats.asistenciaPorDia.map((a) => (
            <div key={a.day} className="border border-[#24334F] rounded-lg p-3">
              <p className="text-sm font-semibold">{a.day}</p>
              <p className="text-xl font-bold text-[#C9A227]">{a.presentes}/{a.total}</p>
              <p className="text-xs text-[#7484A3]">departamentales presentes</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-bold mb-3">Avance por disciplina</h3>
        {porDisciplina.length === 0 ? (
          <p className="text-sm text-[#7484A3]">Todavía no hay partidos programados en ninguna disciplina.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[#93A0BB] border-b border-[#24334F]">
                  <th className="py-2 pr-3">Disciplina</th>
                  <th className="py-2 pr-3">Partidos programados</th>
                  <th className="py-2 pr-3">Jugados</th>
                  <th className="py-2 pr-3">Pendientes</th>
                  <th className="py-2 pr-3">Avance</th>
                </tr>
              </thead>
              <tbody>
                {porDisciplina.map((d) => (
                  <tr key={d.id} className="border-b border-[#1E2C47]">
                    <td className="py-1.5 pr-3 font-medium">{d.name}</td>
                    <td className="py-1.5 pr-3">{d.programados}</td>
                    <td className="py-1.5 pr-3">{d.jugados}</td>
                    <td className="py-1.5 pr-3">{d.programados - d.jugados}</td>
                    <td className="py-1.5 pr-3 w-40">
                      <div className="h-2 bg-[#1E2C47] rounded-full overflow-hidden">
                        <div
                          className="h-2 bg-[#132A4C]"
                          style={{ width: `${d.programados ? Math.round((d.jugados / d.programados) * 100) : 0}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function AuditorResultados({ allMatches, matchResults, setMatchResult, disciplines, conflicts }) {
  const [filterDay, setFilterDay] = useState("");
  const [filterDisc, setFilterDisc] = useState("");
  const [onlyPending, setOnlyPending] = useState(false);

  const rows = allMatches
    .filter((m) => !filterDay || m.day === filterDay)
    .filter((m) => !filterDisc || m.disciplineId === filterDisc)
    .filter((m) => !onlyPending || !(matchResults[m.id] && matchResults[m.id].jugado))
    .sort((a, b) => dayIndex(a.day) - dayIndex(b.day) || parseHM(a.time) - parseHM(b.time));

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Día</label>
          <select className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm" value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
            <option value="">Todos</option>
            {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Disciplina</label>
          <select className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm" value={filterDisc} onChange={(e) => setFilterDisc(e.target.value)}>
            <option value="">Todas</option>
            {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-[#C9A227] mb-1.5">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
          Solo pendientes de carga
        </label>
      </Card>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#93A0BB] border-b border-[#24334F] bg-[#1C2C4A]">
                <th className="py-2 px-3">Día / hora</th>
                <th className="py-2 px-3">Disciplina</th>
                <th className="py-2 px-3">Categoría</th>
                <th className="py-2 px-3">Partido</th>
                <th className="py-2 px-3">Jugado</th>
                <th className="py-2 px-3">Resultado</th>
                <th className="py-2 px-3">Ganador</th>
                <th className="py-2 px-3">Hora real (inicio–fin)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const mr = matchResults[m.id] || {};
                const inConflict = conflicts.some((c) => c.m1.id === m.id || c.m2.id === m.id);
                return (
                  <tr key={m.key + m.id} className={`border-b border-[#1E2C47] ${inConflict ? "bg-[#3A241F]" : mr.jugado ? "bg-[#15261C]" : ""}`}>
                    <td className="py-1.5 px-3 font-mono text-xs whitespace-nowrap">{m.day} {m.time}</td>
                    <td className="py-1.5 px-3">{m.disciplineName}</td>
                    <td className="py-1.5 px-3">{m.categoryName}</td>
                    <td className="py-1.5 px-3">{m.teamA || "?"} vs {m.teamB || "?"}</td>
                    <td className="py-1.5 px-3">
                      <input
                        type="checkbox"
                        checked={!!mr.jugado}
                        onChange={(e) => setMatchResult(m.id, { jugado: e.target.checked })}
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <input
                        type="text"
                        placeholder="ej. 3-1"
                        className="border border-[#2B3B5C] rounded px-2 py-1 text-xs w-20"
                        value={mr.resultado || ""}
                        onChange={(e) => setMatchResult(m.id, { resultado: e.target.value })}
                      />
                    </td>
                    <td className="py-1.5 px-3">
                      <select
                        className="border border-[#2B3B5C] rounded px-2 py-1 text-xs"
                        value={mr.ganador || ""}
                        onChange={(e) => setMatchResult(m.id, { ganador: e.target.value })}
                      >
                        <option value="">—</option>
                        {m.teamA && <option value={m.teamA}>{m.teamA}</option>}
                        {m.teamB && <option value={m.teamB}>{m.teamB}</option>}
                        <option value="Empate">Empate</option>
                      </select>
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          className="border border-[#2B3B5C] rounded px-1.5 py-1 text-xs"
                          value={mr.horaInicioReal || ""}
                          onChange={(e) => setMatchResult(m.id, { horaInicioReal: e.target.value })}
                        />
                        <span className="text-[#7484A3]">–</span>
                        <input
                          type="time"
                          className="border border-[#2B3B5C] rounded px-1.5 py-1 text-xs"
                          value={mr.horaFinReal || ""}
                          onChange={(e) => setMatchResult(m.id, { horaFinReal: e.target.value })}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr><td colSpan={8} className="py-6 text-center text-[#7484A3]">No hay partidos que coincidan con el filtro.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function AuditorAsistencia({ departamentales, attendance, toggleAttendance, stats }) {
  function marcarTodos(day, presente) {
    departamentales.forEach((d) => {
      const key = `${day}::${d.name}`;
      const current = !!attendance[key];
      if (current !== presente) toggleAttendance(day, d.name);
    });
  }
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <p className="text-sm text-[#93A0BB] mb-4">
          Asistencia general de cada departamental/delegación por día del evento (no se carga asistencia individual de participantes).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-[#93A0BB] border-b border-[#24334F]">
                <th className="py-2 pr-3">Departamental</th>
                {DAYS.map((day) => <th key={day} className="py-2 px-3 text-center">{day}</th>)}
              </tr>
            </thead>
            <tbody>
              {departamentales.map((d) => (
                <tr key={d.id} className="border-b border-[#1E2C47]">
                  <td className="py-1.5 pr-3 font-medium">{d.name}</td>
                  {DAYS.map((day) => (
                    <td key={day} className="py-1.5 px-3 text-center">
                      <input
                        type="checkbox"
                        checked={!!attendance[`${day}::${d.name}`]}
                        onChange={() => toggleAttendance(day, d.name)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="py-2 pr-3 text-xs font-semibold text-[#93A0BB]">Marcar todos</td>
                {DAYS.map((day) => (
                  <td key={day} className="py-2 px-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => marcarTodos(day, true)} className="text-[10px] bg-[#16261E] text-[#4FAE72] border border-[#2E4A3A] rounded px-1.5 py-0.5">
                        Todos
                      </button>
                      <button onClick={() => marcarTodos(day, false)} className="text-[10px] bg-[#101C33] text-[#93A0BB] border border-[#2B3B5C] rounded px-1.5 py-0.5">
                        Ninguno
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <div className="grid sm:grid-cols-3 gap-3">
        {stats.asistenciaPorDia.map((a) => (
          <StatCard key={a.day} label={a.day} value={`${a.presentes}/${a.total}`} sub="departamentales presentes" />
        ))}
      </div>
    </div>
  );
}

function IncidentCard({ incident, disciplines, updateIncident, removeIncident }) {
  const [editing, setEditing] = useState(false);
  const [estado, setEstado] = useState(incident.estado);
  const [responsable, setResponsable] = useState(incident.responsable || "");
  const [resolucion, setResolucion] = useState(incident.resolucion || "");
  const colors = estadoColor(incident.estado);
  const disc = disciplines.find((d) => d.id === incident.disciplineId);

  return (
    <div className="border rounded-lg p-4" style={{ borderColor: colors.border, backgroundColor: colors.bg }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-xs font-mono text-[#93A0BB]">{incident.day}{incident.hora ? ` · ${incident.hora}` : ""} — {disc ? disc.name : "General"}{incident.categoria ? ` · ${incident.categoria}` : ""}</p>
          <p className="text-sm font-semibold mt-0.5" style={{ color: colors.text }}>{incident.tipo}</p>
        </div>
        <span className="text-xs font-semibold px-2 py-1 rounded-full" style={{ color: colors.text, backgroundColor: "#16233F", border: `1px solid ${colors.border}` }}>
          {incident.estado}
        </span>
      </div>
      <p className="text-sm text-[#EDE7D6] mb-1">{incident.descripcion}</p>
      {incident.involucrados && (
        <p className="text-xs text-[#93A0BB] mb-1"><strong>Involucrados:</strong> {incident.involucrados}</p>
      )}
      {incident.responsable && !editing && (
        <p className="text-xs text-[#93A0BB] mb-1"><strong>Responsable:</strong> {incident.responsable}</p>
      )}
      {incident.resolucion && !editing && (
        <p className="text-xs text-[#4FAE72] mt-1"><strong>Resolución:</strong> {incident.resolucion}</p>
      )}

      {editing ? (
        <div className="mt-3 space-y-2 bg-[#16233F] border border-[#24334F] rounded-lg p-3">
          <div>
            <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Estado</label>
            <select className="border border-[#2B3B5C] rounded px-2 py-1 text-xs w-full" value={estado} onChange={(e) => setEstado(e.target.value)}>
              {INCIDENT_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Responsable de atenderla</label>
            <input type="text" className="border border-[#2B3B5C] rounded px-2 py-1 text-xs w-full" value={responsable} onChange={(e) => setResponsable(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Resolución / novedades</label>
            <textarea className="border border-[#2B3B5C] rounded px-2 py-1 text-xs w-full" rows={2} value={resolucion} onChange={(e) => setResolucion(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { updateIncident(incident.id, { estado, responsable, resolucion }); setEditing(false); }}
              className="text-xs bg-[#C9A227] text-[#132A4C] px-3 py-1.5 rounded-lg"
            >
              Guardar
            </button>
            <button onClick={() => setEditing(false)} className="text-xs bg-[#16233F] border border-[#2B3B5C] px-3 py-1.5 rounded-lg">
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-2">
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs bg-[#16233F] border border-[#2B3B5C] px-2.5 py-1.5 rounded-lg hover:bg-[#101C33]">
            <RefreshCw className="w-3.5 h-3.5" /> Actualizar estado
          </button>
          <button onClick={() => removeIncident(incident.id)} className="flex items-center gap-1 text-xs bg-[#16233F] border border-[#2B3B5C] px-2.5 py-1.5 rounded-lg hover:bg-[#3A241F] hover:text-[#E0684A]">
            <Trash2 className="w-3.5 h-3.5" /> Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

function AuditorIncidencias({ disciplines, departamentales, incidents, addIncident, updateIncident, removeIncident }) {
  const [showForm, setShowForm] = useState(false);
  const [filterEstado, setFilterEstado] = useState("");
  const [form, setForm] = useState({
    day: DAYS[0], hora: "", disciplineId: "", categoria: "", involucrados: "",
    tipo: INCIDENT_TYPES[0], descripcion: "", responsable: "",
  });

  function submit() {
    if (!form.descripcion.trim()) return;
    addIncident({ ...form });
    setForm({ day: DAYS[0], hora: "", disciplineId: "", categoria: "", involucrados: "", tipo: INCIDENT_TYPES[0], descripcion: "", responsable: "" });
    setShowForm(false);
  }

  const filtered = incidents.filter((i) => !filterEstado || i.estado === filterEstado);

  return (
    <div className="space-y-4">
      <Card className="p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-[#93A0BB]">Filtrar por estado</label>
          <select className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm" value={filterEstado} onChange={(e) => setFilterEstado(e.target.value)}>
            <option value="">Todas ({incidents.length})</option>
            {INCIDENT_STATES.map((s) => <option key={s} value={s}>{s} ({incidents.filter((i) => i.estado === s).length})</option>)}
          </select>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-[#C9A227] text-[#132A4C] text-sm px-4 py-2.5 rounded-lg hover:bg-[#A9841C]"
        >
          <Plus className="w-4 h-4" /> Registrar incidencia
        </button>
      </Card>

      {showForm && (
        <Card className="p-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Día</label>
              <select className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Hora aproximada</label>
              <input type="time" className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Disciplina</label>
              <select className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full" value={form.disciplineId} onChange={(e) => setForm({ ...form, disciplineId: e.target.value })}>
                <option value="">General / sin disciplina específica</option>
                {disciplines.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Categoría (opcional)</label>
              <input type="text" className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full" value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Tipo</label>
              <select className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full" value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                {INCIDENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Departamentales / equipos involucrados (opcional)</label>
            <input
              type="text"
              list="dept-suggestions"
              placeholder="ej. Necochea, Mar del Plata"
              className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full"
              value={form.involucrados}
              onChange={(e) => setForm({ ...form, involucrados: e.target.value })}
            />
            <datalist id="dept-suggestions">
              {departamentales.map((d) => <option key={d.id} value={d.name} />)}
            </datalist>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Descripción</label>
            <textarea
              className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full"
              rows={3}
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Qué pasó, dónde, y cualquier detalle relevante para el seguimiento."
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#93A0BB] mb-1">Responsable de atenderla (opcional)</label>
            <input type="text" className="border border-[#2B3B5C] rounded-lg px-3 py-1.5 text-sm w-full" value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button onClick={submit} className="bg-[#132A4C] text-[#C9A227] text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-95">
              Guardar incidencia
            </button>
            <button onClick={() => setShowForm(false)} className="bg-[#16233F] border border-[#2B3B5C] text-sm px-4 py-2 rounded-lg">
              Cancelar
            </button>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-[#7484A3]">No hay incidencias registradas{filterEstado ? ` en estado "${filterEstado}"` : ""}.</Card>
        )}
        {filtered.map((i) => (
          <IncidentCard key={i.id} incident={i} disciplines={disciplines} updateIncident={updateIncident} removeIncident={removeIncident} />
        ))}
      </div>
    </div>
  );
}
