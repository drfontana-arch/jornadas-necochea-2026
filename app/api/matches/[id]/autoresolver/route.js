import { NextResponse } from "next/server";
import { listAllMatches, rescheduleMatch } from "../../../../../lib/db";
import { getSupabase } from "../../../../../lib/supabase";
import { buildSlotPool, overlaps, baseDept } from "../../../../../lib/sorteoLogic";

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
      duration: target.duration,
      courts: (await sb.from("disciplines").select("courts").eq("id", target.disciplineId).single()).data.courts,
      venues: venuesRaw.map((v) => ({ day: v.day, time: v.time.slice(0, 5) })),
    };

    const otherMatches = allMatches.filter((m) => m.id !== target.id);
    const poolSize = discipline.venues.length * discipline.courts * 6 + 12;
    const pool = buildSlotPool(discipline, poolSize, transitionMinutes);
    const depts = [baseDept(target.teamA), baseDept(target.teamB)].filter(Boolean);
    const usedInDisc = new Set(
      otherMatches.filter((m) => m.disciplineId === target.disciplineId).map((m) => `${m.day}::${m.time}::${m.court}`)
    );
    const found = pool.find((s) => {
      const key = `${s.day}::${s.time}::${s.court}`;
      if (usedInDisc.has(key)) return false;
      return !depts.some((d) =>
        otherMatches.some((m) => {
          const mDepts = [baseDept(m.teamA), baseDept(m.teamB)].filter(Boolean);
          return mDepts.includes(d) && overlaps({ day: s.day, time: s.time }, discipline.duration, m, m.duration, transitionMinutes);
        })
      );
    });
    if (!found) {
      return NextResponse.json({ error: "No se encontró un horario libre sin superposición dentro de las sedes/horarios ya definidos." }, { status: 409 });
    }
    await rescheduleMatch(target.id, found.day, found.time, found.court);
    return NextResponse.json({ ok: true, slot: found });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
