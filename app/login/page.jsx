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
    <div className="min-h-screen flex items-center justify-center bg-[#0C2043] px-4">
      <div className="bg-[#163A67] rounded-xl border border-[#21426E] shadow-sm p-8 max-w-sm w-full">
        <p className="text-xs tracking-[0.25em] uppercase text-[#9FB0D0] font-semibold mb-1">
          Colegio de Magistrados y Funcionarios
        </p>
        <h1 className="text-lg font-bold text-[#2FD3C4] mb-4">Jornadas Necochea 2026 — Acceso restringido</h1>
        <p className="text-sm text-[#9FB0D0] mb-3">Ingresá la contraseña de acceso para esta herramienta.</p>
        <input
          type="password"
          className="w-full bg-[#0C2043] border border-[#2A4E85] text-[#EDE7D6] rounded-lg px-3 py-2 text-sm mb-2"
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
          className="w-full bg-[#2FD3C4] text-[#0C2043] text-sm font-medium py-2 rounded-lg hover:bg-[#1E9C90] disabled:opacity-60"
        >
          {loading ? "Verificando…" : "Entrar"}
        </button>
        <p className="text-[11px] text-[#7A8FBE] mt-4 leading-snug">
          Esto es un filtro básico para evitar accesos casuales, no una autenticación segura.
        </p>
      </div>
    </div>
  );
}
