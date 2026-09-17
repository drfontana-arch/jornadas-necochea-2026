import { NextResponse } from "next/server";
import { runSorteoForCategory } from "../../../../../lib/sorteoRunner";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const body = await req.json().catch(() => ({}));
    const transitionMinutes = body.transitionMinutes ?? 10;
    const result = await runSorteoForCategory(params.id, transitionMinutes);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
