import { NextResponse } from "next/server";
import { listMatchResults } from "../../../lib/db";

export async function GET() {
  try {
    const results = await listMatchResults();
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
