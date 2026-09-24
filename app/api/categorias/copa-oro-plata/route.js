import { NextResponse } from "next/server";
import { listSplitCategories } from "../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const splits = await listSplitCategories();
    return NextResponse.json({ splits });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
