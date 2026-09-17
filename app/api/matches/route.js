import { NextResponse } from "next/server";
import { listAllMatches, listRestrictions, getIndividualDisciplineBusyMatches } from "../../../lib/db";
import { computeConflicts, computeRestrictionViolations } from "../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const matches = await listAllMatches();
    if (searchParams.get("withConflicts")) {
      const individualBusy = await getIndividualDisciplineBusyMatches();
      const forConflicts = matches.concat(individualBusy);
      const conflicts = computeConflicts(forConflicts, 10);
      const restrictions = await listRestrictions();
      const violations = computeRestrictionViolations(forConflicts, restrictions);
      return NextResponse.json({ matches, conflicts, violations });
    }
    return NextResponse.json({ matches });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
