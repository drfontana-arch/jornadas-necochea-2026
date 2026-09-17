"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Users, Settings2, ClipboardList, ListChecks, Shuffle, CalendarDays,
  ClipboardCheck, Scale,
} from "lucide-react";

const TABS = [
  { href: "/departamentales", label: "Departamentales", icon: Users },
  { href: "/disciplinas", label: "Disciplinas y sedes", icon: Settings2 },
  { href: "/inscripciones", label: "Inscripciones", icon: ClipboardList },
  { href: "/antecedentes", label: "Antecedentes", icon: ListChecks },
  { href: "/sorteo", label: "Sorteo", icon: Shuffle },
  { href: "/calendario", label: "Fixture y conflictos", icon: CalendarDays },
  { href: "/auditor", label: "Auditor de jornadas", icon: ClipboardCheck },
];

export default function AppShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [conflictCount, setConflictCount] = useState(0);
  const [incidentCount, setIncidentCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadBadges() {
      try {
        const res = await fetch("/api/matches?withConflicts=1");
        const data = await res.json();
        if (!cancelled) setConflictCount((data.conflicts?.length || 0) + (data.violations?.length || 0));
      } catch (e) { /* noop */ }
      try {
        const res = await fetch("/api/incidencias");
        const data = await res.json();
        if (!cancelled) setIncidentCount((data.incidents || []).filter((i) => i.estado !== "Resuelta").length);
      } catch (e) { /* noop */ }
    }
    loadBadges();
    const interval = setInterval(loadBadges, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [pathname]);

  async function salir() {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen bg-[#0C2043] text-[#EDE7D6]">
      <div className="bg-[#2FD3C4] text-[#0C2043] border-b-4 border-[#0C2043]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-xs tracking-[0.25em] uppercase text-[#0C2043] font-semibold">
              Colegio de Magistrados y Funcionarios · Pcia. de Buenos Aires
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Jornadas Necochea 2026</h1>
            <p className="text-[11px] text-[#35528A] mt-1">
              Herramienta interna de organización — sorteo, auditoría y supervisión.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={salir} className="text-xs text-[#35528A] hover:text-[#0C2043] underline underline-offset-2">
              Salir
            </button>
            <Scale className="w-10 h-10 text-[#0C2043] hidden md:block" />
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap gap-1 pb-0">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = pathname?.startsWith(t.href);
            return (
              <button
                key={t.href}
                onClick={() => router.push(t.href)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                  active ? "bg-[#0C2043] text-[#2FD3C4]" : "text-[#35528A] hover:bg-[#1E9C90]"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
                {t.href === "/calendario" && conflictCount > 0 && (
                  <span className="ml-1 bg-[#E0684A] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                    {conflictCount}
                  </span>
                )}
                {t.href === "/auditor" && incidentCount > 0 && (
                  <span className="ml-1 bg-[#E0684A] text-white text-[10px] rounded-full w-5 h-5 flex items-center justify-center">
                    {incidentCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-6 py-6">{children}</div>
    </div>
  );
}
