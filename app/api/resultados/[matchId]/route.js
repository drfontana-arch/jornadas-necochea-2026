import { NextResponse } from "next/server";
import { upsertMatchResult } from "../../../../lib/db";

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const patch = {};
    ["jugado", "resultado", "ganador", "hora_inicio_real", "hora_fin_real", "novedades"].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    await upsertMatchResult(params.matchId, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
