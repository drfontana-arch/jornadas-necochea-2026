import { NextResponse } from "next/server";
import { updateIncident, removeIncident } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const patch = {};
    ["estado", "responsable", "resolucion"].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    await updateIncident(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await removeIncident(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
