import { NextResponse } from "next/server";
import { updateDiscipline, addVenue, addCategory } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const patch = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.courts !== undefined) patch.courts = body.courts;
    if (body.duration !== undefined) patch.duration_minutes = body.duration;
    await updateDiscipline(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// Agregar sede o categoría a esta disciplina
export async function POST(req, { params }) {
  try {
    const body = await req.json();
    if (body.type === "venue") {
      await addVenue(params.id, body.day, body.time, body.location);
      return NextResponse.json({ ok: true });
    }
    if (body.type === "category") {
      const cat = await addCategory(params.id, body.name, body.maxTeams || 1);
      return NextResponse.json({ category: cat });
    }
    return NextResponse.json({ error: "type debe ser 'venue' o 'category'." }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
