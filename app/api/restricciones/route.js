import { NextResponse } from "next/server";
import { listRestrictions, addRestriction } from "../../../lib/db";

export async function GET() {
  try {
    const restrictions = await listRestrictions();
    return NextResponse.json({ restrictions });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const payload = {
      departamental_id: body.departamentalId,
      scope: body.scope,
      team_label: body.scope === "equipo" ? (body.teamLabel || null) : null,
      participant_name: body.scope === "individual" ? (body.participantName || null) : null,
      day: body.day || null,
      unavailable_all_day: !!body.unavailableAllDay,
      not_before: body.unavailableAllDay ? null : (body.notBefore || null),
      not_after: body.unavailableAllDay ? null : (body.notAfter || null),
      note: body.note || null,
    };
    if (!payload.departamental_id || !payload.scope) {
      return NextResponse.json({ error: "Falta departamental o alcance." }, { status: 400 });
    }
    const restriction = await addRestriction(payload);
    return NextResponse.json({ restriction });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
