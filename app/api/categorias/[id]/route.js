import { NextResponse } from "next/server";
import { getCategory, updateCategorySettings, removeCategory } from "../../../../lib/db";

export async function GET(req, { params }) {
  try {
    const cat = await getCategory(params.id);
    return NextResponse.json({ category: cat });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const body = await req.json();
    const patch = {};
    ["modality", "group_size", "advance_per_group", "seed_order", "groups", "group_standings", "drawn"].forEach((k) => {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    await updateCategorySettings(params.id, patch);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    await removeCategory(params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
