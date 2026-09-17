import { NextResponse } from "next/server";
import { listMatchesForCategory } from "../../../../../lib/db";

export const dynamic = "force-dynamic";

export async function GET(req, { params }) {
  try {
    const [grupos, playoff, llave] = await Promise.all([
      listMatchesForCategory(params.id, "grupos"),
      listMatchesForCategory(params.id, "playoff"),
      listMatchesForCategory(params.id, "llave"),
    ]);
    return NextResponse.json({ groupMatches: grupos, playoffMatches: playoff, drawMatches: llave });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
