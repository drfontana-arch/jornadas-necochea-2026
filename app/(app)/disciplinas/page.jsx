"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import Card from "../../../components/Card";

const DAYS = ["2026-10-09", "2026-10-10", "2026-10-11"];
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

export default function DisciplinasPage() {
  const [disciplines, setDisciplines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(null);

  async function load() {
    const res = await fetch("/api/disciplinas");
    const data = await res.json();
    setDisciplines(data.disciplines || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function updateDiscipline(id, patch) {
    await fetch(`/api/disciplinas/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load();
  }
  async function addVenue(id) {
    await fetch(`/api/disciplinas/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "venue", day: DAYS[0], time: "09:00", location: "" }),
    });
    load();
  }
  async function updateVenue(venueId, patch) {
    await fetch(`/api/venues/${venueId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    load();
  }
  async function removeVenue(venueId) {
    await fetch(`/api/venues/${venueId}`, { method: "DELETE" });
    load();
  }
  async function addCategory(id) {
    const name = prompt("Nombre de la nueva categoría:");
    if (!name || !name.trim()) return;
    await fetch(`/api/disciplinas/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "category", name: name.trim(), maxTeams: 1 }),
    });
    load();
  }
  async function removeCategory(catId) {
    if (!confirm("¿Eliminar esta categoría? Se perderá su sorteo si ya se realizó.")) return;
    await fetch(`/api/categorias/${catId}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="text-[#93A0BB] text-sm">Cargando…</p>;

  return (
    <div className="space-y-3">
      {disciplines.map((d) => {
        const isOpen = open === d.id;
        return (
          <Card key={d.id} className="p-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setOpen(isOpen ? null : d.id)}>
              <div>
                <p className="font-bold">{d.name}</p>
                <p className="text-xs text-[#93A0BB]">{d.categories.length} categorías · {d.venues.length} sedes · {d.courts} cancha(s) · {d.duration} min</p>
              </div>
              <span className="text-[#C9A227] text-sm">{isOpen ? "Cerrar ▲" : "Ver ▼"}</span>
            </div>

            {isOpen && (
              <div className="mt-4 grid md:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <label className="text-xs text-[#93A0BB]">
                      Canchas
                      <input
                        type="number" min={1} defaultValue={d.courts}
                        onBlur={(e) => updateDiscipline(d.id, { courts: Number(e.target.value) })}
                        className="block w-20 mt-1 bg-[#101C33] border border-[#2B3B5C] rounded px-2 py-1 text-sm text-[#EDE7D6]"
                      />
                    </label>
                    <label className="text-xs text-[#93A0BB]">
                      Duración (min)
                      <input
                        type="number" min={5} defaultValue={d.duration}
                        onBlur={(e) => updateDiscipline(d.id, { duration: Number(e.target.value) })}
                        className="block w-24 mt-1 bg-[#101C33] border border-[#2B3B5C] rounded px-2 py-1 text-sm text-[#EDE7D6]"
                      />
                    </label>
                  </div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB] mb-2">Sedes / horarios</p>
                  <div className="space-y-1.5 mb-2">
                    {d.venues.map((v) => (
                      <div key={v.id} className="flex items-center gap-1.5 text-sm">
                        <select
                          defaultValue={v.day}
                          onChange={(e) => updateVenue(v.id, { day: e.target.value })}
                          className="bg-[#101C33] border border-[#2B3B5C] rounded px-1.5 py-1 text-xs"
                        >
                          {DAYS.map((day) => <option key={day} value={day}>{DAY_LABEL[day]}</option>)}
                        </select>
                        <input
                          type="time" defaultValue={v.time}
                          onBlur={(e) => updateVenue(v.id, { time: e.target.value })}
                          className="bg-[#101C33] border border-[#2B3B5C] rounded px-1.5 py-1 text-xs"
                        />
                        <input
                          type="text" placeholder="Lugar" defaultValue={v.location || ""}
                          onBlur={(e) => updateVenue(v.id, { location: e.target.value })}
                          className="flex-1 bg-[#101C33] border border-[#2B3B5C] rounded px-1.5 py-1 text-xs"
                        />
                        <button onClick={() => removeVenue(v.id)} className="text-[#7484A3] hover:text-[#E0684A]"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => addVenue(d.id)} className="text-xs flex items-center gap-1 text-[#C9A227] hover:underline">
                    <Plus className="w-3.5 h-3.5" /> Agregar sede
                  </button>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-[#93A0BB]">Categorías</p>
                    <button onClick={() => addCategory(d.id)} className="text-xs flex items-center gap-1 text-[#C9A227] hover:underline">
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {d.categories.map((c) => (
                      <span key={c.id} className="flex items-center gap-1 bg-[#101C33] border border-[#24334F] rounded-full px-2.5 py-1 text-xs">
                        {c.name}
                        {c.max_teams > 1 && <span className="text-[#C9A227] font-semibold">×{c.max_teams}</span>}
                        <button onClick={() => removeCategory(c.id)} className="text-[#7484A3] hover:text-[#E0684A]"><X className="w-3 h-3" /></button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
