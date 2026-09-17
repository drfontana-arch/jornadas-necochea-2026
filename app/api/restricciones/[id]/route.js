import { NextResponse } from "next/server";
import { removeRestriction } from "../../../../lib/db";

export async function DELETE(req, { params }) {
  try {
    await removeRestriction(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
