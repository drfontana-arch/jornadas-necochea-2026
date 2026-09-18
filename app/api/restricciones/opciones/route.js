import { NextResponse } from "next/server";
import { listRestrictionOptions } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req) {
  try {
    const departamentalId = new URL(req.url).searchParams.get("departamentalId");
    if (!departamentalId) return NextResponse.json({ error: "Falta la departamental." }, { status: 400 });
    const options = await listRestrictionOptions(departamentalId);
    return NextResponse.json(options);
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
