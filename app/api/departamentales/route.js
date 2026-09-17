import { NextResponse } from "next/server";
import { listDepartamentales, addDepartamental } from "../../../lib/db";

export async function GET() {
  try {
    const data = await listDepartamentales();
    return NextResponse.json({ departamentales: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req) {
  try {
    const { name } = await req.json();
    if (!name || !name.trim()) return NextResponse.json({ error: "Nombre requerido." }, { status: 400 });
    const data = await addDepartamental(name.trim());
    return NextResponse.json({ departamental: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
