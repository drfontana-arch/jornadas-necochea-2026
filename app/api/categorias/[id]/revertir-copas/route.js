import { NextResponse } from "next/server";
import { revertOroPlataSplit } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const result = await revertOroPlataSplit(params.id);
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
