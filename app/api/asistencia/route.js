import { NextResponse } from "next/server";
import { listAttendance, setAttendance } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listAttendance();
    return NextResponse.json({ attendance: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const { day, departamentalId, presente } = await req.json();
    await setAttendance(day, departamentalId, presente);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
