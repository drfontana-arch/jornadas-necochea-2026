import { NextResponse } from "next/server";
import { listTeamEntries, addTeamEntry, removeTeamEntry, removeTeamEntriesByDept, getCategory, updateCategorySettings } from "../../../../../lib/db";

export async function GET(req, { params }) {
  try {
    const entries = await listTeamEntries(params.id);
    return NextResponse.json({ entries });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Marca/desmarca una departamental (toggle) o suma un equipo extra
export async function POST(req, { params }) {
  try {
    const body = await req.json();
    const entries = await listTeamEntries(params.id);
    if (body.action === "toggle") {
      const existing = entries.filter((e) => e.departamentalId === body.departamentalId);
      if (existing.length > 0) {
        await removeTeamEntriesByDept(params.id, body.departamentalId);
      } else {
        await addTeamEntry(params.id, body.departamentalId, 1);
      }
    } else if (body.action === "addExtra") {
      const count = entries.filter((e) => e.departamentalId === body.departamentalId).length;
      await addTeamEntry(params.id, body.departamentalId, count + 1);
    }
    // cualquier cambio en inscriptos invalida un sorteo previo
    await updateCategorySettings(params.id, { drawn: false });
    const updated = await listTeamEntries(params.id);
    return NextResponse.json({ entries: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { searchParams } = new URL(req.url);
    const entryId = searchParams.get("entryId");
    if (!entryId) return NextResponse.json({ error: "entryId requerido." }, { status: 400 });
    await removeTeamEntry(entryId);
    await updateCategorySettings(params.id, { drawn: false });
    const updated = await listTeamEntries(params.id);
    return NextResponse.json({ entries: updated });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
