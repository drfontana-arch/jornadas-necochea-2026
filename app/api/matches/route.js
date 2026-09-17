import { NextResponse } from "next/server";
import { listAllMatches, listRestrictions } from "../../../lib/db";
import { computeConflicts, computeRestrictionViolations } from "../../../lib/sorteoLogic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const matches = await listAllMatches();
    if (searchParams.get("withConflicts")) {
      const conflicts = computeConflicts(matches, 10);
      const restrictions = await listRestrictions();
      const violations = computeRestrictionViolations(matches, restrictions);
      return NextResponse.json({ matches, conflicts, violations });
    }
    return NextResponse.json({ matches });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
