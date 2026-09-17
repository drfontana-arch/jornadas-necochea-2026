import { NextResponse } from "next/server";
import { listAllMatches } from "../../../lib/db";
import { computeConflicts } from "../../../lib/sorteoLogic";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const matches = await listAllMatches();
    if (searchParams.get("withConflicts")) {
      const conflicts = computeConflicts(matches, 10);
      return NextResponse.json({ matches, conflicts });
    }
    return NextResponse.json({ matches });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
