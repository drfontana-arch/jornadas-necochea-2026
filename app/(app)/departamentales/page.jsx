"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import Card from "../../../components/Card";

export default function DepartamentalesPage() {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");

  async function load() {
    const res = await fetch("/api/departamentales");
    const data = await res.json();
    setList(data.departamentales || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function addDept() {
    if (!newName.trim()) return;
    await fetch("/api/departamentales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    setNewName("");
    load();
  }
  async function rename(id, current) {
    const name = prompt("Nuevo nombre:", current);
    if (!name || !name.trim()) return;
    await fetch(`/api/departamentales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    load();
  }
  async function remove(id) {
    if (!confirm("¿Eliminar esta departamental? No se borrarán sus inscripciones ya cargadas.")) return;
    await fetch(`/api/departamentales/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return <p className="text-[#93A0BB] text-sm">Cargando…</p>;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold text-lg">Departamentales / Instituciones</h2>
      </div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          className="flex-1 bg-[#101C33] border border-[#2B3B5C] rounded-lg px-3 py-2 text-sm"
          placeholder="Nombre de la nueva departamental"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addDept()}
        />
        <button onClick={addDept} className="flex items-center gap-1.5 bg-[#C9A227] text-[#132A4C] text-sm px-3 py-2 rounded-lg hover:bg-[#A9841C]">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>
      <ul className="space-y-1.5">
        {list.map((d) => (
          <li key={d.id} className="flex items-center justify-between bg-[#101C33] border border-[#24334F] rounded-lg px-3 py-2 text-sm">
            <span>{d.name}</span>
            <div className="flex gap-2">
              <button onClick={() => rename(d.id, d.name)} className="text-[#93A0BB] hover:text-[#C9A227] px-1">✎</button>
              <button onClick={() => remove(d.id)} className="text-[#7484A3] hover:text-[#E0684A] px-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          </li>
        ))}
        {list.length === 0 && <p className="text-sm text-[#7484A3]">No hay departamentales cargadas todavía.</p>}
      </ul>
    </Card>
  );
}
