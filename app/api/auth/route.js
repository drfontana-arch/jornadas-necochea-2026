import { NextResponse } from "next/server";
import { hashToken, AUTH_COOKIE } from "../../../lib/authEdge";

export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const passphrase = body.passphrase || "";
  if (!process.env.ACCESS_PASSPHRASE) {
    return NextResponse.json(
      { ok: false, error: "El sistema todavía no tiene una contraseña configurada (falta ACCESS_PASSPHRASE)." },
      { status: 500 }
    );
  }
  if (passphrase !== process.env.ACCESS_PASSPHRASE) {
    return NextResponse.json({ ok: false, error: "Contraseña incorrecta." }, { status: 401 });
  }
  const token = await hashToken(passphrase, process.env.SESSION_SECRET || "");
  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(AUTH_COOKIE);
  return res;
}
