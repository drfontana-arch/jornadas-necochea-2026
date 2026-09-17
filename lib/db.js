import { getSupabase } from "./supabase";

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

  return matches.map((m) => {
    const cat = catMap[m.category_id];
    const disc = cat ? discMap[cat.discipline_id] : null;
    return {
      ...fromDbMatch(m),
      disciplineId: cat ? cat.discipline_id : m.discipline_id,
      disciplineName: disc ? disc.name : "?",
      categoryName: cat ? cat.name : "?",
      duration: disc ? disc.duration_minutes : 60,
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
export const INDIVIDUAL_DISCIPLINES = ["natacion", "maraton", "patinCarrera", "travesia4x4", "pesca", "tiro"];

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

/* ---------- resultados ---------- */
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
  return data.map((r) => ({ ...r, departamental_name: depMap[r.departamental_id] || "?" }));
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
