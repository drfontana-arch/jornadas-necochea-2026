import { NextResponse } from "next/server";
import { renameDepartamental, removeDepartamental } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function PATCH(req, { params }) {
  try {
    const { name } = await req.json();
    if (!name || !name.trim()) return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });
    await renameDepartamental(params.id, name.trim());
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await removeDepartamental(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
