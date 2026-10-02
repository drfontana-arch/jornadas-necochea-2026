import { NextResponse } from "next/server";
import { listAllMatches, getMatchById, getIndividualDisciplineBusyMatches, getRosterByMatchId, addIndividualRosters, listRestrictions } from "../../../../../lib/db";
import { computeConflicts, computeRestrictionViolations } from "../../../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

// Simula "¿qué pasaría si este partido quedara en este día/hora/cancha?"
// SIN guardar nada -- se usa desde el control de reprogramación manual
// para avisar de superposiciones antes de confirmar el cambio. Funciona
// también para un partido que todavía no tiene horario (listAllMatches()
// no lo trae, por eso se busca aparte con getMatchById).
export async function POST(req, { params }) {
  try {
    const { day, time, court } = await req.json();
    const [target, matches, individualBusy] = await Promise.all([
      getMatchById(params.id),
      listAllMatches(),
      getIndividualDisciplineBusyMatches(),
    ]);
    const all = matches.concat(individualBusy);
    const others = all.filter((m) => m.id !== params.id);
    const proposed = { ...target, day, time, court };
    const combined = [...others, proposed];

    const rosterByMatchId = addIndividualRosters(await getRosterByMatchId(), individualBusy);
    const conflicts = computeConflicts(combined, 10, rosterByMatchId).filter((c) => c.m1.id === params.id || c.m2.id === params.id);
    const restrictions = await listRestrictions();
    const violations = computeRestrictionViolations(combined, restrictions).filter((v) => v.match.id === params.id);

    // Dos partidos de la MISMA disciplina no pueden usar la misma cancha al
    // mismo día/hora, sin importar si comparten departamental o no -- es
    // una cancha física, no una etiqueta.
    const courtClash = others.find((m) =>
      m.disciplineId === target.disciplineId && m.day === day && m.time === time && m.court === court
    ) || null;

    return NextResponse.json({ conflicts, violations, courtClash });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
