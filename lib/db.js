import { getSupabase } from "./supabase";
import { INDIVIDUAL_DISCIPLINES } from "./sorteoLogic";
import { normalizeText } from "./csvImport";

/* ---------- departamentales ---------- */
export async function listDepartamentales() {
  const sb = getSupabase();
  const { data, error } = await sb.from("departamentales").select("*").order("name");
  if (error) throw error;
  return data;
}
export async function addDepartamental(name) {
  const sb = getSupabase();
  const { data, error } = await sb.from("departamentales").insert({ name }).select().single();
  if (error) throw error;
  return data;
}
export async function renameDepartamental(id, name) {
  const sb = getSupabase();
  const { error } = await sb.from("departamentales").update({ name }).eq("id", id);
  if (error) throw error;
}
export async function removeDepartamental(id) {
  const sb = getSupabase();
  const { error } = await sb.from("departamentales").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- disciplinas (con venues y categorías) ---------- */
export async function listDisciplines() {
  const sb = getSupabase();
  const [{ data: disciplines, error: e1 }, { data: venues, error: e2 }, { data: categories, error: e3 }] =
    await Promise.all([
      sb.from("disciplines").select("*").order("name"),
      sb.from("venues").select("*").order("day").order("time"),
      sb.from("categories").select("*").eq("active", true).order("name"),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  return disciplines.map((d) => ({
    ...d,
    duration: d.duration_minutes,
    venues: venues.filter((v) => v.discipline_id === d.id).map((v) => ({ ...v, day: v.day, time: v.time.slice(0, 5) })),
    categories: categories.filter((c) => c.discipline_id === d.id),
  }));
}

export async function addVenue(disciplineId, day, time, location) {
  const sb = getSupabase();
  const { error } = await sb.from("venues").insert({ discipline_id: disciplineId, day, time, location: location || null });
  if (error) throw error;
}
export async function updateVenue(id, patch) {
  const sb = getSupabase();
  const { error } = await sb.from("venues").update(patch).eq("id", id);
  if (error) throw error;
}
export async function removeVenue(id) {
  const sb = getSupabase();
  const { error } = await sb.from("venues").delete().eq("id", id);
  if (error) throw error;
}
export async function updateDiscipline(id, patch) {
  const sb = getSupabase();
  const { error } = await sb.from("disciplines").update(patch).eq("id", id);
  if (error) throw error;
}
export async function addCategory(disciplineId, name, maxTeams = 1) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("categories")
    .insert({ discipline_id: disciplineId, name, max_teams: maxTeams })
    .select()
    .single();
  if (error) throw error;
  return data;
}
export async function removeCategory(id) {
  const sb = getSupabase();
  const { error } = await sb.from("categories").delete().eq("id", id);
  if (error) throw error;
}
export async function getCategory(id) {
  const sb = getSupabase();
  const { data: cat, error } = await sb.from("categories").select("*").eq("id", id).single();
  if (error) throw error;
  const { data: disc, error: e2 } = await sb.from("disciplines").select("*").eq("id", cat.discipline_id).single();
  if (e2) throw e2;
  return { ...cat, disciplines: disc };
}
export async function updateCategorySettings(id, patch) {
  const sb = getSupabase();
  const { error } = await sb.from("categories").update(patch).eq("id", id);
  if (error) throw error;
}

/* ---------- Copa Oro / Copa Plata ---------- */
// Disciplinas de deporte en equipo alcanzadas por el Art. de Copa Oro/Plata del reglamento
export const COPA_ORO_PLATA_DISCIPLINES = ["futbol11", "futbolReducido", "basquet", "voley", "hockey"];
export const COPA_ORO_PLATA_MIN_EQUIPOS = 12;

export async function splitIntoOroPlata(categoryId, oroDepartamentalIds) {
  const sb = getSupabase();

  const { data: original, error: e0 } = await sb.from("categories").select("*").eq("id", categoryId).single();
  if (e0) throw e0;

  const { data: entries, error: e1 } = await sb.from("team_entries").select("*").eq("category_id", categoryId);
  if (e1) throw e1;

  const oroSet = new Set(oroDepartamentalIds);

  const { data: oroCat, error: e2 } = await sb
    .from("categories")
    .insert({
      discipline_id: original.discipline_id,
      name: `${original.name} — Copa Oro`,
      max_teams: original.max_teams,
      copa: "oro",
      parent_category_id: original.id,
    })
    .select()
    .single();
  if (e2) throw e2;

  const { data: plataCat, error: e3 } = await sb
    .from("categories")
    .insert({
      discipline_id: original.discipline_id,
      name: `${original.name} — Copa Plata`,
      max_teams: original.max_teams,
      copa: "plata",
      parent_category_id: original.id,
    })
    .select()
    .single();
  if (e3) throw e3;

  for (const entry of entries) {
    const targetId = oroSet.has(entry.departamental_id) ? oroCat.id : plataCat.id;
    const { error: eUp } = await sb.from("team_entries").update({ category_id: targetId }).eq("id", entry.id);
    if (eUp) throw eUp;
  }

  const { error: e4 } = await sb.from("categories").update({ active: false }).eq("id", categoryId);
  if (e4) throw e4;

  return { oro: oroCat, plata: plataCat };
}

// Categorías que YA se dividieron en Copa Oro/Plata (la original queda
// desactivada -- ver splitIntoOroPlata más arriba). Se usa para poder
// deshacer la división: por ejemplo, si se dividió con datos de prueba
// antes de tener el CSV real de inscriptos, conviene deshacerla, volver a
// cargar el CSV real sobre la categoría única, y recién ahí dividirla de
// nuevo con los números reales.
export async function listSplitCategories() {
  const sb = getSupabase();
  const { data: children, error: e1 } = await sb.from("categories").select("*").not("copa", "is", null);
  if (e1) throw e1;
  if (!children || children.length === 0) return [];

  const parentIds = [...new Set(children.map((c) => c.parent_category_id).filter(Boolean))];
  const { data: parents, error: e2 } = await sb.from("categories").select("id, name, discipline_id, active").in("id", parentIds);
  if (e2) throw e2;
  const parentMap = {};
  (parents || []).forEach((p) => { parentMap[p.id] = p; });

  const discIds = [...new Set((parents || []).map((p) => p.discipline_id))];
  const { data: discs, error: e3 } = await sb.from("disciplines").select("id, name").in("id", discIds);
  if (e3) throw e3;
  const discMap = {};
  (discs || []).forEach((d) => { discMap[d.id] = d.name; });

  const childIds = children.map((c) => c.id);
  const { data: entries, error: e4 } = await sb.from("team_entries").select("category_id, departamental_id").in("category_id", childIds);
  if (e4) throw e4;
  const countByCategory = {};
  (entries || []).forEach((e) => { countByCategory[e.category_id] = (countByCategory[e.category_id] || 0) + 1; });

  const byParent = {};
  children.forEach((c) => {
    const parentId = c.parent_category_id;
    if (!parentId || !parentMap[parentId]) return;
    if (!byParent[parentId]) {
      byParent[parentId] = {
        parentId,
        parentName: parentMap[parentId].name,
        disciplineName: discMap[parentMap[parentId].discipline_id] || "?",
        parentActive: parentMap[parentId].active,
        children: [],
      };
    }
    byParent[parentId].children.push({ id: c.id, name: c.name, copa: c.copa, teamCount: countByCategory[c.id] || 0 });
  });
  return Object.values(byParent);
}

// Deshace una división en Copa Oro/Plata: borra las dos categorías hijas
// (con sus partidos, resultados, equipos e inscripciones -- si van a
// recargarse desde un CSV nuevo, esto de todos modos se reconstruye) y
// reactiva la categoría única original.
export async function revertOroPlataSplit(parentCategoryId) {
  const sb = getSupabase();
  const { data: parent, error: e0 } = await sb.from("categories").select("id, name").eq("id", parentCategoryId).single();
  if (e0) throw e0;
  if (!parent) throw new Error("No se encontró la categoría original.");

  const { data: children, error: e1 } = await sb.from("categories").select("id, name").eq("parent_category_id", parentCategoryId);
  if (e1) throw e1;
  if (!children || children.length === 0) throw new Error("Esta categoría no tiene una división para deshacer.");

  const childIds = children.map((c) => c.id);

  const { data: matchRows, error: e2 } = await sb.from("matches").select("id").in("category_id", childIds);
  if (e2) throw e2;
  const matchIds = (matchRows || []).map((m) => m.id);
  if (matchIds.length > 0) {
    const { error: e3 } = await sb.from("match_results").delete().in("match_id", matchIds);
    if (e3) throw e3;
  }
  const { error: e4 } = await sb.from("matches").delete().in("category_id", childIds);
  if (e4) throw e4;
  const { error: e5 } = await sb.from("team_entries").delete().in("category_id", childIds);
  if (e5) throw e5;
  const { error: e6 } = await sb.from("registrations").delete().in("category_id", childIds);
  if (e6) throw e6;
  const { error: e7 } = await sb.from("categories").delete().in("id", childIds);
  if (e7) throw e7;
  const { error: e8 } = await sb.from("categories").update({ active: true }).eq("id", parentCategoryId);
  if (e8) throw e8;

  return { parentId: parentCategoryId, parentName: parent.name, childrenRemoved: children.length };
}

export async function listTeamEntries(categoryId) {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("team_entries")
    .select("*")
    .eq("category_id", categoryId)
    .order("team_number");
  if (error) throw error;
  if (!data || data.length === 0) return [];
  const depIds = [...new Set(data.map((r) => r.departamental_id))];
  const { data: deps, error: e2 } = await sb.from("departamentales").select("id, name").in("id", depIds);
  if (e2) throw e2;
  const depMap = {};
  (deps || []).forEach((d) => { depMap[d.id] = d.name; });
  return data.map((r) => ({ id: r.id, dept: depMap[r.departamental_id] || "?", departamentalId: r.departamental_id, num: r.team_number }));
}
export async function addTeamEntry(categoryId, departamentalId, teamNumber) {
  const sb = getSupabase();
  const { error } = await sb
    .from("team_entries")
    .insert({ category_id: categoryId, departamental_id: departamentalId, team_number: teamNumber });
  if (error) throw error;
}
export async function removeTeamEntry(id) {
  const sb = getSupabase();
  const { error } = await sb.from("team_entries").delete().eq("id", id);
  if (error) throw error;
}
export async function removeTeamEntriesByDept(categoryId, departamentalId) {
  const sb = getSupabase();
  const { error } = await sb
    .from("team_entries")
    .delete()
    .eq("category_id", categoryId)
    .eq("departamental_id", departamentalId);
  if (error) throw error;
}

/* ---------- partidos ---------- */
export async function listMatchesForCategory(categoryId, stage) {
  const sb = getSupabase();
  let q = sb.from("matches").select("*").eq("category_id", categoryId);
  if (stage) q = q.eq("stage", stage);
  const { data, error } = await q.order("round").order("seq");
  if (error) throw error;
  return data.map(fromDbMatch);
}

export async function replaceMatchesForStage(categoryId, stage, matches) {
  const sb = getSupabase();
  const { error: delErr } = await sb.from("matches").delete().eq("category_id", categoryId).eq("stage", stage);
  if (delErr) throw delErr;
  if (matches.length === 0) return [];
  const rows = matches.map((m) => toDbMatch(categoryId, stage, m));
  const { data, error } = await sb.from("matches").insert(rows).select();
  if (error) throw error;
  return data.map(fromDbMatch);
}

export async function appendMatches(categoryId, stage, matches) {
  const sb = getSupabase();
  if (matches.length === 0) return [];
  const rows = matches.map((m) => toDbMatch(categoryId, stage, m));
  const { data, error } = await sb.from("matches").insert(rows).select();
  if (error) throw error;
  return data.map(fromDbMatch);
}

export async function listAllMatches() {
  const sb = getSupabase();
  const { data: matches, error } = await sb
    .from("matches")
    .select("*")
    .not("day", "is", null)
    .not("time", "is", null);
  if (error) throw error;
  if (!matches || matches.length === 0) return [];

  const categoryIds = [...new Set(matches.map((m) => m.category_id))];
  const { data: cats, error: e2 } = await sb.from("categories").select("id, name, discipline_id").in("id", categoryIds);
  if (e2) throw e2;
  const catMap = {};
  (cats || []).forEach((c) => { catMap[c.id] = c; });

  const disciplineIds = [...new Set((cats || []).map((c) => c.discipline_id))];
  const { data: discs, error: e3 } = await sb.from("disciplines").select("id, name, duration_minutes").in("id", disciplineIds);
  if (e3) throw e3;
  const discMap = {};
  (discs || []).forEach((d) => { discMap[d.id] = d; });

  const { data: venues, error: e4 } = await sb.from("venues").select("*").in("discipline_id", disciplineIds);
  if (e4) throw e4;
  // Ubicación por disciplina+día (aproximado a la primera sede de ese día
  // si una disciplina tiene más de una -- alcanza para dejar en claro que
  // "cancha 1" de una disciplina no es la misma cancha física que
  // "cancha 1" de otra).
  const locationByDisciplineDay = {};
  (venues || []).forEach((v) => {
    const key = `${v.discipline_id}::${v.day}`;
    if (!locationByDisciplineDay[key]) locationByDisciplineDay[key] = v.location;
  });

  return matches.map((m) => {
    const cat = catMap[m.category_id];
    const disc = cat ? discMap[cat.discipline_id] : null;
    return {
      ...fromDbMatch(m),
      disciplineId: cat ? cat.discipline_id : m.discipline_id,
      disciplineName: disc ? disc.name : "?",
      categoryName: cat ? cat.name : "?",
      duration: disc ? disc.duration_minutes : 60,
      location: cat ? locationByDisciplineDay[`${cat.discipline_id}::${m.day}`] || null : null,
    };
  });
}

export async function rescheduleMatch(id, day, time, court) {
  const sb = getSupabase();
  const { error } = await sb.from("matches").update({ day, time, court }).eq("id", id);
  if (error) throw error;
}

// Reemplaza un código de clasificado ("1A", "2B", ...) por el nombre real
// del equipo en los partidos de playoff YA programados de esta categoría,
// sin tocar el día/hora/cancha ya asignados.
export async function resolveQualifierCode(categoryId, code, realLabel) {
  const sb = getSupabase();
  const { data: matches, error } = await sb
    .from("matches")
    .select("id, team_a, team_b")
    .eq("category_id", categoryId)
    .eq("stage", "playoff");
  if (error) throw error;
  for (const m of matches || []) {
    const patch = {};
    if (m.team_a === code) patch.team_a = realLabel;
    if (m.team_b === code) patch.team_b = realLabel;
    if (Object.keys(patch).length > 0) {
      const { error: eUp } = await sb.from("matches").update(patch).eq("id", m.id);
      if (eUp) throw eUp;
    }
  }
}

function toDbMatch(categoryId, stage, m) {
  return {
    category_id: categoryId,
    discipline_id: m.disciplineId,
    stage,
    round: m.round ?? null,
    group_label: m.groupLabel ?? null,
    label: m.label ?? null,
    team_a: m.teamA ?? null,
    team_b: m.teamB ?? null,
    is_bye: !!m.bye,
    is_placeholder: !!m.placeholder,
    day: m.day ?? null,
    time: m.time ?? null,
    court: m.court ?? null,
    seq: m.seq ?? null,
  };
}
function fromDbMatch(m) {
  return {
    id: m.id,
    key: m.category_id,
    disciplineId: m.discipline_id,
    round: m.round,
    seq: m.seq,
    groupLabel: m.group_label,
    group: m.group_label ? m.group_label.charCodeAt(m.group_label.length - 1) - 65 : undefined,
    label: m.label,
    teamA: m.team_a,
    teamB: m.team_b,
    bye: m.is_bye,
    placeholder: m.is_placeholder,
    day: m.day,
    time: m.time ? m.time.slice(0, 5) : m.time,
    court: m.court,
    stage: m.stage === "grupos" ? "Grupos" : m.stage === "playoff" ? "Playoff" : "Llave",
  };
}

/* ---------- disciplinas individuales/cronometradas ---------- */
// No se sortean (no hay "equipo A vs equipo B"), pero sus horarios sí ocupan
// a la departamental que tenga gente anotada ahí, para el motor de conflictos.
// (la lista en sí vive en sorteoLogic.js, que es segura de importar del cliente)
export { INDIVIDUAL_DISCIPLINES };

export async function getIndividualDisciplineBusyMatches() {
  const sb = getSupabase();
  const { data: regs, error } = await sb
    .from("registrations")
    .select("discipline_id, participant_id")
    .in("discipline_id", INDIVIDUAL_DISCIPLINES);
  if (error) throw error;
  if (!regs || regs.length === 0) return [];

  const participantIds = [...new Set(regs.map((r) => r.participant_id))];
  const { data: parts, error: e2 } = await sb.from("participants").select("id, departamental_id").in("id", participantIds);
  if (e2) throw e2;
  const partDeptMap = {};
  (parts || []).forEach((p) => { partDeptMap[p.id] = p.departamental_id; });

  const { data: deps, error: e3 } = await sb.from("departamentales").select("id, name");
  if (e3) throw e3;
  const depNameMap = {};
  (deps || []).forEach((d) => { depNameMap[d.id] = d.name; });

  const pairs = new Set();
  regs.forEach((r) => {
    const depId = partDeptMap[r.participant_id];
    if (depId) pairs.add(`${r.discipline_id}::${depId}`);
  });
  if (pairs.size === 0) return [];

  const { data: venues, error: e4 } = await sb.from("venues").select("*").in("discipline_id", INDIVIDUAL_DISCIPLINES);
  if (e4) throw e4;
  const { data: discs, error: e5 } = await sb.from("disciplines").select("id, name, duration_minutes").in("id", INDIVIDUAL_DISCIPLINES);
  if (e5) throw e5;
  const discMap = {};
  (discs || []).forEach((d) => { discMap[d.id] = d; });

  const busy = [];
  pairs.forEach((key) => {
    const [discId, depId] = key.split("::");
    const deptName = depNameMap[depId];
    const disc = discMap[discId];
    if (!deptName || !disc) return;
    venues.filter((v) => v.discipline_id === discId).forEach((v) => {
      busy.push({
        id: `ind-${discId}-${depId}-${v.id}`,
        teamA: deptName,
        teamB: null,
        day: v.day,
        time: v.time.slice(0, 5),
        duration: disc.duration_minutes,
        disciplineId: discId,
        disciplineName: disc.name,
        categoryName: "Competencia individual",
        stage: "Individual",
      });
    });
  });
  return busy;
}

// Lista de personas (no departamentales) inscriptas en una categoría --
// pensado para las disciplinas individuales/cronometradas, donde lo que
// importa es quién corre/participa, no un "equipo".
export async function listParticipantsForCategory(categoryId) {
  const sb = getSupabase();
  const { data: regs, error } = await sb
    .from("registrations")
    .select("participant_id, team_label, position")
    .eq("category_id", categoryId);
  if (error) throw error;
  if (!regs || regs.length === 0) return [];

  const participantIds = [...new Set(regs.map((r) => r.participant_id))];
  const { data: parts, error: e2 } = await sb.from("participants").select("id, full_name, departamental_id").in("id", participantIds);
  if (e2) throw e2;
  const partMap = {};
  (parts || []).forEach((p) => { partMap[p.id] = p; });

  const depIds = [...new Set((parts || []).map((p) => p.departamental_id).filter(Boolean))];
  const { data: deps, error: e3 } = await sb.from("departamentales").select("id, name").in("id", depIds);
  if (e3) throw e3;
  const depMap = {};
  (deps || []).forEach((d) => { depMap[d.id] = d.name; });

  return regs
    .map((r) => {
      const p = partMap[r.participant_id];
      if (!p) return null;
      return {
        fullName: p.full_name,
        departamental: depMap[p.departamental_id] || "?",
        teamLabel: r.team_label,
        position: r.position,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.departamental.localeCompare(b.departamental) || a.fullName.localeCompare(b.fullName));
}

// Para cada partido programado, ¿qué PERSONAS concretas juegan en cada
// equipo? Se usa para detectar superposiciones reales (misma persona en
// dos lugares) en vez de "misma departamental" -- lo cual daba muchísimos
// falsos positivos (categorías Masculino/Femenino nunca comparten
// jugadores, ni todas las actividades nocturnas del viernes son la misma
// gente).
export async function getRosterByMatchId() {
  const sb = getSupabase();
  const [{ data: matchRows, error: e1 }, { data: teamEntries, error: e2 }, { data: regs, error: e3 }, { data: parts, error: e4 }, { data: deps, error: e5 }] =
    await Promise.all([
      sb.from("matches").select("id, category_id, team_a, team_b").not("day", "is", null),
      sb.from("team_entries").select("*"),
      sb.from("registrations").select("participant_id, category_id, position"),
      sb.from("participants").select("id, departamental_id"),
      sb.from("departamentales").select("id, name"),
    ]);
  if (e1) throw e1;
  if (e2) throw e2;
  if (e3) throw e3;
  if (e4) throw e4;
  if (e5) throw e5;

  const depNameById = {};
  (deps || []).forEach((d) => { depNameById[d.id] = d.name; });
  const partDeptById = {};
  (parts || []).forEach((p) => { partDeptById[p.id] = p.departamental_id; });

  // registros agrupados por categoria+departamental+posicion, para poder
  // encontrar a la gente de un team_entry puntual (categoria+dept+numero)
  const regsByCategoryDeptPos = {};
  (regs || []).forEach((r) => {
    const depId = partDeptById[r.participant_id];
    if (!depId) return;
    const pos = r.position || 1;
    const key = `${r.category_id}::${depId}::${pos}`;
    (regsByCategoryDeptPos[key] = regsByCategoryDeptPos[key] || []).push(r.participant_id);
  });

  // etiqueta de equipo por team_entry, replicando la misma lógica que usa
  // el sorteo (computeLabels): "Dept" si es la única de esa categoria,
  // "Dept N" si hay más de una.
  const entriesByCategory = {};
  (teamEntries || []).forEach((te) => { (entriesByCategory[te.category_id] = entriesByCategory[te.category_id] || []).push(te); });

  const rosterByLabel = {}; // categoryId -> { label: Set(participantId) }
  Object.entries(entriesByCategory).forEach(([categoryId, list]) => {
    const countsByDept = {};
    list.forEach((te) => { countsByDept[te.departamental_id] = (countsByDept[te.departamental_id] || 0) + 1; });
    rosterByLabel[categoryId] = {};
    list.forEach((te) => {
      const depName = depNameById[te.departamental_id];
      if (!depName) return;
      const label = countsByDept[te.departamental_id] > 1 ? `${depName} ${te.team_number}` : depName;
      const key = `${categoryId}::${te.departamental_id}::${te.team_number}`;
      const people = regsByCategoryDeptPos[key] || [];
      rosterByLabel[categoryId][label] = new Set([...(rosterByLabel[categoryId][label] || []), ...people]);
    });
  });

  const rosterByMatchId = {};
  (matchRows || []).forEach((m) => {
    const perCategory = rosterByLabel[m.category_id] || {};
    const rosterA = perCategory[m.team_a] || new Set();
    const rosterB = perCategory[m.team_b] || new Set();
    rosterByMatchId[m.id] = new Set([...rosterA, ...rosterB]);
  });
  return rosterByMatchId;
}


export async function listMatchResults() {
  const sb = getSupabase();
  const { data, error } = await sb.from("match_results").select("*");
  if (error) throw error;
  const map = {};
  data.forEach((r) => { map[r.match_id] = r; });
  return map;
}
export async function upsertMatchResult(matchId, patch) {
  const sb = getSupabase();
  const { error } = await sb.from("match_results").upsert({ match_id: matchId, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}

/* ---------- asistencia ---------- */
export async function listAttendance() {
  const sb = getSupabase();
  const { data, error } = await sb.from("attendance").select("*");
  if (error) throw error;
  return data;
}
export async function setAttendance(day, departamentalId, presente) {
  const sb = getSupabase();
  const { error } = await sb
    .from("attendance")
    .upsert({ day, departamental_id: departamentalId, presente, updated_at: new Date().toISOString() }, { onConflict: "day,departamental_id" });
  if (error) throw error;
}

/* ---------- restricciones horarias ---------- */
export async function listRestrictions() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("schedule_restrictions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  if (!data || data.length === 0) return [];
  const depIds = [...new Set(data.map((r) => r.departamental_id))];
  const { data: deps, error: e2 } = await sb.from("departamentales").select("id, name").in("id", depIds);
  if (e2) throw e2;
  const depMap = {};
  (deps || []).forEach((d) => { depMap[d.id] = d.name; });
  // Las restricciones de equipo pueden llevar la categoría ("Nombre::idCategoria")
  const catIds = [...new Set(data.map((r) => (r.scope === "equipo" ? r.team_label : null)).filter(Boolean)
    .map((v) => (v.includes("::") ? v.slice(v.lastIndexOf("::") + 2) : null)).filter(Boolean))];
  const catNameById = {};
  if (catIds.length > 0) {
    const { data: cats, error: e3 } = await sb.from("categories").select("id, name, discipline_id").in("id", catIds);
    if (e3) throw e3;
    const dIds = [...new Set((cats || []).map((c) => c.discipline_id))];
    const { data: discs, error: e4 } = await sb.from("disciplines").select("id, name").in("id", dIds);
    if (e4) throw e4;
    const dName = {};
    (discs || []).forEach((d) => { dName[d.id] = d.name; });
    (cats || []).forEach((c) => { catNameById[c.id] = `${dName[c.discipline_id] || "?"} · ${c.name}`; });
  }
  return data.map((r) => {
    const out = { ...r, departamental_name: depMap[r.departamental_id] || "?" };
    if (r.scope === "equipo" && r.team_label && r.team_label.includes("::")) {
      const i = r.team_label.lastIndexOf("::");
      out.team_display = r.team_label.slice(0, i);
      out.team_category_name = catNameById[r.team_label.slice(i + 2)] || null;
    }
    return out;
  });
}
// Opciones para el formulario de restricciones: los equipos/parejas y las
// personas realmente inscriptos de una departamental, para elegirlos de una
// lista en vez de tipearlos. La etiqueta del equipo replica la del sorteo
// ("Dept" si es el único de la categoría, "Dept N" si hay más de uno).
export async function listRestrictionOptions(departamentalId) {
  const sb = getSupabase();
  const { data: dep, error: e0 } = await sb.from("departamentales").select("id, name").eq("id", departamentalId).single();
  if (e0) throw e0;

  const { data: entries, error: e1 } = await sb.from("team_entries").select("category_id, team_number").eq("departamental_id", departamentalId);
  if (e1) throw e1;
  const { data: parts, error: e2 } = await sb.from("participants").select("id, full_name").eq("departamental_id", departamentalId);
  if (e2) throw e2;

  const partIds = (parts || []).map((p) => p.id);
  let regs = [];
  if (partIds.length > 0) {
    const { data, error } = await sb.from("registrations").select("participant_id, category_id").in("participant_id", partIds);
    if (error) throw error;
    regs = data || [];
  }

  const categoryIds = [...new Set([...(entries || []).map((e) => e.category_id), ...regs.map((r) => r.category_id)])];
  const catMap = {};
  if (categoryIds.length > 0) {
    const { data: cats, error: e3 } = await sb.from("categories").select("id, name, discipline_id, active").in("id", categoryIds);
    if (e3) throw e3;
    (cats || []).forEach((c) => { catMap[c.id] = c; });
    const discIds = [...new Set((cats || []).map((c) => c.discipline_id))];
    const { data: discs, error: e4 } = await sb.from("disciplines").select("id, name").in("id", discIds);
    if (e4) throw e4;
    const discMap = {};
    (discs || []).forEach((d) => { discMap[d.id] = d.name; });
    Object.values(catMap).forEach((c) => { c.fullName = `${discMap[c.discipline_id] || "?"} · ${c.name}`; });
  }
  const isActive = (cid) => catMap[cid] && catMap[cid].active !== false;

  const countByCategory = {};
  (entries || []).forEach((e) => { countByCategory[e.category_id] = (countByCategory[e.category_id] || 0) + 1; });
  // Un equipo/pareja POR categoría (no juntados por nombre), para que la
  // restricción valga solo para ese equipo en esa categoría.
  const teams = (entries || [])
    .filter((e) => isActive(e.category_id))
    .map((e) => {
      const label = countByCategory[e.category_id] > 1 ? `${dep.name} ${e.team_number}` : dep.name;
      return {
        value: `${label}::${e.category_id}`,
        label,
        categoryName: catMap[e.category_id].fullName,
      };
    })
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName, "es") || a.label.localeCompare(b.label, "es", { numeric: true }));

  const catsByPerson = {};
  regs.forEach((r) => {
    if (!isActive(r.category_id)) return;
    (catsByPerson[r.participant_id] = catsByPerson[r.participant_id] || new Set()).add(catMap[r.category_id].fullName);
  });
  const participants = (parts || [])
    .filter((p) => catsByPerson[p.id])
    .map((p) => ({ id: p.id, fullName: p.full_name, categories: [...catsByPerson[p.id]].sort() }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));

  return { teams, participants };
}

export async function addRestriction(payload) {
  const sb = getSupabase();
  const { data, error } = await sb.from("schedule_restrictions").insert(payload).select("*").single();
  if (error) throw error;
  const { data: dep, error: e2 } = await sb.from("departamentales").select("name").eq("id", data.departamental_id).single();
  if (e2) throw e2;
  return { ...data, departamental_name: dep.name };
}
export async function removeRestriction(id) {
  const sb = getSupabase();
  const { error } = await sb.from("schedule_restrictions").delete().eq("id", id);
  if (error) throw error;
}
export async function listIncidents() {
  const sb = getSupabase();
  const { data, error } = await sb.from("incidents").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
export async function addIncident(payload) {
  const sb = getSupabase();
  const { data, error } = await sb.from("incidents").insert(payload).select().single();
  if (error) throw error;
  return data;
}
export async function updateIncident(id, patch) {
  const sb = getSupabase();
  const { error } = await sb.from("incidents").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}
export async function removeIncident(id) {
  const sb = getSupabase();
  const { error } = await sb.from("incidents").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- reset del sorteo ---------- */
// Las categorías de un alcance dado: una categoría puntual, todas las de
// una disciplina, o todas (si no se pasa ninguno de los dos).
export async function categoriesInScope({ disciplineId, categoryId } = {}) {
  const sb = getSupabase();
  let q = sb.from("categories").select("id, name, discipline_id");
  if (categoryId) q = q.eq("id", categoryId);
  else if (disciplineId) q = q.eq("discipline_id", disciplineId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function countMatchesForCategories(categoryIds) {
  if (!categoryIds || categoryIds.length === 0) return 0;
  const sb = getSupabase();
  const { count, error } = await sb.from("matches").select("id", { count: "exact", head: true }).in("category_id", categoryIds);
  if (error) throw error;
  return count || 0;
}

// Borra SOLO el fixture de partidos (matches + los resultados ya cargados
// sobre ellos) de las categorías del alcance elegido, y las deja "sin
// sortear" para poder volver a correr el sorteo. NO toca la modalidad,
// tamaño de grupo ni clasificados por grupo de cada categoría (el "modo de
// disputa"), ni las sedes/canchas (venues), ni las inscripciones
// (team_entries/participants/registrations) -- eso sigue igual.
export async function resetSorteo({ disciplineId, categoryId } = {}) {
  const sb = getSupabase();
  const cats = await categoriesInScope({ disciplineId, categoryId });
  const categoryIds = cats.map((c) => c.id);
  if (categoryIds.length === 0) return { categoriesCount: 0, matchesDeleted: 0 };

  const { data: matchRows, error: e1 } = await sb.from("matches").select("id").in("category_id", categoryIds);
  if (e1) throw e1;
  const matchIds = (matchRows || []).map((m) => m.id);

  if (matchIds.length > 0) {
    const { error: e2 } = await sb.from("match_results").delete().in("match_id", matchIds);
    if (e2) throw e2;
  }
  const { error: e3 } = await sb.from("matches").delete().in("category_id", categoryIds);
  if (e3) throw e3;

  const { error: e4 } = await sb
    .from("categories")
    .update({ drawn: false, groups: null, group_standings: {} })
    .in("id", categoryIds);
  if (e4) throw e4;

  return { categoriesCount: categoryIds.length, matchesDeleted: matchIds.length };
}

/* ---------- importar base de inscriptos (CSV) ---------- */
// Datos de referencia contra los que se resuelve el CSV (ver
// resolveImportRows en lib/csvImport.js): departamentales y disciplinas
// con sus categorías activas, tal como ya existen en el sistema.
export async function fetchImportReferenceData() {
  const [departamentales, disciplines] = await Promise.all([listDepartamentales(), listDisciplines()]);
  return { departamentales, disciplines };
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Reemplazo total: borra TODAS las personas, equipos (team_entries) e
// inscripciones (registrations) actuales y las reconstruye desde cero a
// partir de las filas ya resueltas por resolveImportRows. Crea las
// departamentales que falten (por nombre). NO toca disciplinas/sedes, ni
// la configuración de sorteo de las categorías (modalidad, tamaño de
// grupo, clasificados), ni los partidos ya sorteados.
export async function applyCsvImportReplaceTotal(resolved, referenceData) {
  if (!resolved.valid || resolved.valid.length === 0) {
    throw new Error("No hay ninguna fila válida para importar -- no se borró nada. Revisá las disciplinas/categorías que faltan por configurar.");
  }
  const sb = getSupabase();

  // 1) crear las departamentales que falten
  const depByNorm = new Map(referenceData.departamentales.map((d) => [normalizeText(d.name), d]));
  const toCreate = resolved.departamentalesToCreate.filter((name) => !depByNorm.has(normalizeText(name)));
  if (toCreate.length > 0) {
    const { data, error } = await sb.from("departamentales").insert(toCreate.map((name) => ({ name }))).select();
    if (error) throw error;
    (data || []).forEach((d) => depByNorm.set(normalizeText(d.name), d));
  }

  // 2) borrar TODO lo anterior. Se filtra por una columna que siempre
  // existe y nunca es null, en vez de por el nombre de la clave primaria
  // (que puede variar), para borrar todas las filas sin excepción.
  const { error: eDelReg } = await sb.from("registrations").delete().not("participant_id", "is", null);
  if (eDelReg) throw eDelReg;
  const { error: eDelTeam } = await sb.from("team_entries").delete().not("category_id", "is", null);
  if (eDelTeam) throw eDelTeam;
  const { error: eDelPart } = await sb.from("participants").delete().not("id", "is", null);
  if (eDelPart) throw eDelPart;

  // 3) reconstruir: personas (una fila por participante_id, la primera vez
  // que aparece), equipos (una fila por categoría+departamental+número), e
  // inscripciones (una fila por cada fila válida del CSV).
  const participantsMap = new Map();
  resolved.valid.forEach((r) => {
    if (participantsMap.has(r.participanteId)) return;
    const dep = depByNorm.get(r.departamentalNorm);
    participantsMap.set(r.participanteId, { id: Number(r.participanteId), full_name: r.fullName, departamental_id: dep ? dep.id : null });
  });
  const participantsRows = [...participantsMap.values()];
  for (const batch of chunkArray(participantsRows, 500)) {
    const { error } = await sb.from("participants").insert(batch);
    if (error) throw error;
  }

  const teamEntriesMap = new Map();
  resolved.valid.forEach((r) => {
    if (!r.teamLabel) return;
    const dep = depByNorm.get(r.departamentalNorm);
    if (!dep) return;
    const key = `${r.categoryId}::${dep.id}::${r.teamNumber}`;
    if (!teamEntriesMap.has(key)) teamEntriesMap.set(key, { category_id: r.categoryId, departamental_id: dep.id, team_number: r.teamNumber });
  });
  const teamEntriesRows = [...teamEntriesMap.values()];
  for (const batch of chunkArray(teamEntriesRows, 500)) {
    const { error } = await sb.from("team_entries").insert(batch);
    if (error) throw error;
  }

  const registrationsRows = resolved.valid.map((r) => ({
    participant_id: Number(r.participanteId),
    category_id: r.categoryId,
    discipline_id: r.disciplineId,
    team_label: r.teamLabel,
    position: r.teamNumber,
  }));
  for (const batch of chunkArray(registrationsRows, 500)) {
    const { error } = await sb.from("registrations").insert(batch);
    if (error) throw error;
  }

  return {
    departamentalesCreadas: toCreate.length,
    participantesCreados: participantsRows.length,
    equiposCreados: teamEntriesRows.length,
    inscripcionesCreadas: registrationsRows.length,
  };
}
