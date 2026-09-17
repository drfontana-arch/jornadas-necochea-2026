import { NextResponse } from "next/server";
import { listParticipantsForCategory } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const participants = await listParticipantsForCategory(params.id);
    return NextResponse.json({ participants });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
