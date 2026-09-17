import { NextResponse } from "next/server";
import { updateVenue, removeVenue } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const patch = {};
    if (body.day !== undefined) patch.day = body.day;
    if (body.time !== undefined) patch.time = body.time;
    if (body.location !== undefined) patch.location = body.location;
    await updateVenue(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await removeVenue(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
