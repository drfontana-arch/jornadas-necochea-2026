import { NextResponse } from "next/server";
import { listIncidents, addIncident } from "../../../lib/db";

export async function GET() {
  try {
    const incidents = await listIncidents();
    return NextResponse.json({ incidents });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    const payload = {
      day: body.day || null,
      hora: body.hora || null,
      discipline_id: body.disciplineId || null,
      categoria: body.categoria || null,
      involucrados: body.involucrados || null,
      tipo: body.tipo,
      descripcion: body.descripcion,
      responsable: body.responsable || null,
      estado: "Abierta",
    };
    const incident = await addIncident(payload);
    return NextResponse.json({ incident });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
