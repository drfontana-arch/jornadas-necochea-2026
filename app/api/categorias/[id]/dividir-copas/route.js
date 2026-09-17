import { NextResponse } from "next/server";
import { splitIntoOroPlata } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const { oroDepartamentalIds } = await req.json();
    if (!Array.isArray(oroDepartamentalIds) || oroDepartamentalIds.length === 0) {
      return NextResponse.json({ error: "Elegí al menos una departamental para la Copa Oro." }, { status: 400 });
    }
    const result = await splitIntoOroPlata(params.id, oroDepartamentalIds);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
