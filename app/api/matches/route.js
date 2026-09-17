import { NextResponse } from "next/server";
import { listAllMatches, listRestrictions, getIndividualDisciplineBusyMatches, getRosterByMatchId } from "../../../lib/db";
import { computeConflicts, computeRestrictionViolations } from "../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const matches = await listAllMatches();
    const individualBusy = await getIndividualDisciplineBusyMatches();
    const matchesWithIndividual = matches.concat(individualBusy);
    if (searchParams.get("withConflicts")) {
      const rosterByMatchId = await getRosterByMatchId();
      const conflicts = computeConflicts(matchesWithIndividual, 10, rosterByMatchId);
      const restrictions = await listRestrictions();
      const violations = computeRestrictionViolations(matchesWithIndividual, restrictions);
      return NextResponse.json({ matches: matchesWithIndividual, conflicts, violations });
    }
    return NextResponse.json({ matches: matchesWithIndividual });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
