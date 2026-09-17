"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pass, setPass] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: pass }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "No se pudo ingresar.");
        return;
      }
      router.push("/departamentales");
      router.refresh();
    } catch (e) {
      setError("Error de conexión.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#101C33] px-4">
      <div className="bg-[#16233F] rounded-xl border border-[#24334F] shadow-sm p-8 max-w-sm w-full">
        <p className="text-xs tracking-[0.25em] uppercase text-[#93A0BB] font-semibold mb-1">
          Colegio de Magistrados y Funcionarios
        </p>
        <h1 className="text-lg font-bold text-[#C9A227] mb-4">Jornadas Necochea 2026 — Acceso restringido</h1>
        <p className="text-sm text-[#93A0BB] mb-3">Ingresá la contraseña de acceso para esta herramienta.</p>
        <input
          type="password"
          className="w-full bg-[#101C33] border border-[#2B3B5C] text-[#EDE7D6] rounded-lg px-3 py-2 text-sm mb-2"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Contraseña"
          autoFocus
        />
        {error && <p className="text-xs text-[#E0684A] mb-2">{error}</p>}
        <button
          onClick={submit}
          disabled={loading}
          className="w-full bg-[#C9A227] text-[#132A4C] text-sm font-medium py-2 rounded-lg hover:bg-[#A9841C] disabled:opacity-60"
        >
          {loading ? "Verificando…" : "Entrar"}
        </button>
        <p className="text-[11px] text-[#7484A3] mt-4 leading-snug">
          Esto es un filtro básico para evitar accesos casuales, no una autenticación segura.
        </p>
      </div>
    </div>
  );
}
