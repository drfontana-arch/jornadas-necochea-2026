import { NextResponse } from "next/server";
import { rescheduleCategory } from "../../../../../lib/sorteoRunner";
import { conflictsForCategory } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;
    const reshuffleOrder = body.reshuffleOrder ?? true;
    const result = await rescheduleCategory(params.id, transitionMinutes, null, { reshuffleOrder });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    const { conflicts, violations } = await conflictsForCategory(params.id, transitionMinutes);
    return NextResponse.json({ ...result, conflicts, violations });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
