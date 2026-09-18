import { NextResponse } from "next/server";
import { listAllMatches, rescheduleMatch, listRestrictions, getIndividualDisciplineBusyMatches } from "../../../../../lib/db";
import { getSupabase } from "../../../../../lib/supabase";
import { buildSlotPool, overlaps, baseDept, slotBlockedByRestrictions, absoluteMinutes } from "../../../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;

    const allMatches = await listAllMatches();
    const target = allMatches.find((m) => m.id === params.id);
    if (!target) return NextResponse.json({ error: "Partido no encontrado." }, { status: 404 });

    const sb = getSupabase();
    const { data: venuesRaw, error: venuesErr } = await sb
      .from("venues").select("*").eq("discipline_id", target.disciplineId);
    if (venuesErr) throw venuesErr;
    const discipline = {
      id: target.disciplineId,
      duration: target.duration,
      courts: (await sb.from("disciplines").select("courts").eq("id", target.disciplineId).single()).data.courts,
      venues: venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5) })),
    };

    const otherMatches = allMatches.filter((m) => m.id !== target.id).concat(await getIndividualDisciplineBusyMatches());
    const restrictions = await listRestrictions();
    // Límites cronológicos dentro de la misma categoría: el partido no puede
    // empezar antes de que termine la ronda anterior (ni la fase de grupos,
    // si es de playoff) ni terminar después de que empiece la ronda siguiente
    // (ni el playoff, si es de grupos).
    const buffer = transitionMinutes || 0;
    const sameCat = allMatches.filter((m) => m.id !== target.id && m.key === target.key && m.day && m.time);
    const isBefore = (m) =>
      (m.stage === target.stage && m.round != null && target.round != null && m.round < target.round) ||
      (target.stage === "Playoff" && m.stage === "Grupos");
    const isAfter = (m) =>
      (m.stage === target.stage && m.round != null && target.round != null && m.round > target.round) ||
      (target.stage === "Grupos" && m.stage === "Playoff");
    let lowerBound = 0;
    sameCat.filter(isBefore).forEach((m) => {
      lowerBound = Math.max(lowerBound, absoluteMinutes(m.day, m.time) + m.duration + buffer);
    });
    let upperBound = Infinity;
    sameCat.filter(isAfter).forEach((m) => {
      upperBound = Math.min(upperBound, absoluteMinutes(m.day, m.time));
    });

    const currentAbs = absoluteMinutes(target.day, target.time);
    const pool = buildSlotPool(discipline, 5000, transitionMinutes, lowerBound);
    const teamLabels = [target.teamA, target.teamB].filter(Boolean);
    const depts = teamLabels.map(baseDept);
    const usedInDisc = new Set(
      otherMatches.filter((m) => m.disciplineId === target.disciplineId).map((m) => `${m.day}::${m.time}::${m.court}`)
    );
    // Entre todos los horarios válidos elegimos el más cercano al actual, en
    // vez del primero libre, para no mandar el partido lejos de donde estaba.
    const candidates = pool
      .filter((s) => absoluteMinutes(s.day, s.time) + discipline.duration + buffer <= upperBound)
      .sort((a, b) => Math.abs(absoluteMinutes(a.day, a.time) - currentAbs) - Math.abs(absoluteMinutes(b.day, b.time) - currentAbs));
    const found = candidates.find((s) => {
      const key = `${s.day}::${s.time}::${s.court}`;
      if (usedInDisc.has(key)) return false;
      if (depts.some((d, i) => slotBlockedByRestrictions(d, teamLabels[i], s.day, s.time, discipline.duration, restrictions, target.key))) return false;
      return !depts.some((d) =>
        otherMatches.some((m) => {
          const mDepts = [baseDept(m.teamA), baseDept(m.teamB)].filter(Boolean);
          return mDepts.includes(d) && overlaps({ day: s.day, time: s.time }, discipline.duration, m, m.duration, transitionMinutes);
        })
      );
    });
    if (!found) {
      return NextResponse.json({ error: "No se encontró un horario libre sin superposición que respete el orden de las rondas de esta categoría (después de la ronda anterior y antes de la siguiente) dentro de las sedes/horarios ya definidos." }, { status: 409 });
    }
    await rescheduleMatch(target.id, found.day, found.time, found.court);
    return NextResponse.json({ ok: true, slot: found });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
