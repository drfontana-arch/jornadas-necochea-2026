import { NextResponse } from "next/server";
import { listDisciplines } from "../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await listDisciplines();
    return NextResponse.json({ disciplines: data });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
