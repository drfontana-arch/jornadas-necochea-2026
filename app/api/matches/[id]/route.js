import { NextResponse } from "next/server";
import { rescheduleMatch } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  try {
    const { day, time, court } = await req.json();
    await rescheduleMatch(params.id, day, time, court);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
