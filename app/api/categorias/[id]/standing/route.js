import { NextResponse } from "next/server";
import { getCategory, updateCategorySettings } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function POST(req, { params }) {
  try {
    const { groupIndex, rank, label } = await req.json();
    const category = await getCategory(params.id);
    const gs = { ...(category.group_standings || {}) };
    const arr = (gs[groupIndex] || []).slice();
    arr[rank] = label;
    gs[groupIndex] = arr;
    await updateCategorySettings(params.id, { group_standings: gs });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
