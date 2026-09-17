import { NextResponse } from "next/server";
import { getSupabase } from "../../../lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sb = getSupabase();
    const { count, error } = await sb.from("team_entries").select("*", { count: "exact", head: true });
    if (error) throw error;
    return NextResponse.json({ total: count });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
