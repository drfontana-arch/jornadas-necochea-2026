"use client";
import { useEffect, useState } from "react";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import Card from "../../../components/Card";

const DAYS = ["2026-10-09", "2026-10-10", "2026-10-11"];
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

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

  if (loading) return <p className="text-[#9FB0D0] text-sm">Cargando…</p>;

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-lg">Departamentales / Instituciones</h2>
        </div>
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            className="flex-1 bg-[#0C2043] border border-[#2A4E85] rounded-lg px-3 py-2 text-sm"
            placeholder="Nombre de la nueva departamental"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addDept()}
          />
          <button onClick={addDept} className="flex items-center gap-1.5 bg-[#2FD3C4] text-[#0C2043] text-sm px-3 py-2 rounded-lg hover:bg-[#1E9C90]">
            <Plus className="w-4 h-4" /> Agregar
          </button>
        </div>
        <ul className="space-y-1.5">
          {list.map((d) => (
            <li key={d.id} className="flex items-center justify-between bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-2 text-sm">
              <span>{d.name}</span>
              <div className="flex gap-2">
                <button onClick={() => rename(d.id, d.name)} className="text-[#9FB0D0] hover:text-[#2FD3C4] px-1">✎</button>
                <button onClick={() => remove(d.id)} className="text-[#7A8FBE] hover:text-[#E0684A] px-1"><Trash2 className="w-4 h-4" /></button>
              </div>
            </li>
          ))}
          {list.length === 0 && <p className="text-sm text-[#7A8FBE]">No hay departamentales cargadas todavía.</p>}
        </ul>
      </Card>

      <RestriccionesSection departamentales={list} />
    </div>
  );
}

const SCOPE_LABEL = { departamental: "Toda la departamental", equipo: "Un equipo/pareja puntual", individual: "Una persona puntual" };

function RestriccionesSection({ departamentales }) {
  const [restrictions, setRestrictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    departamentalId: "", scope: "departamental", teamLabel: "", participantName: "",
    day: "", unavailableAllDay: false, notBefore: "", notAfter: "", note: "",
  });

  const [options, setOptions] = useState({ teams: [], participants: [] });
  const [optionsLoading, setOptionsLoading] = useState(false);

  async function load() {
    const res = await fetch("/api/restricciones");
    const data = await res.json();
    setRestrictions(data.restrictions || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  // Al elegir departamental, traemos sus equipos/parejas y personas
  // inscriptos para que se elijan de una lista (sin tipear).
  useEffect(() => {
    setOptions({ teams: [], participants: [] });
    if (!form.departamentalId || form.scope === "departamental") return;
    let cancelled = false;
    setOptionsLoading(true);
    fetch(`/api/restricciones/opciones?departamentalId=${form.departamentalId}`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setOptions({ teams: data.teams || [], participants: data.participants || [] }); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOptionsLoading(false); });
    return () => { cancelled = true; };
  }, [form.departamentalId, form.scope]);

  async function submit() {
    if (!form.departamentalId) { alert("Elegí una departamental."); return; }
    if (form.scope === "equipo" && !form.teamLabel) { alert("Elegí el equipo o pareja de la lista."); return; }
    if (form.scope === "individual" && !form.participantName) { alert("Elegí la persona de la lista."); return; }
    await fetch("/api/restricciones", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form),
    });
    setForm({ departamentalId: "", scope: "departamental", teamLabel: "", participantName: "", day: "", unavailableAllDay: false, notBefore: "", notAfter: "", note: "" });
    setShowForm(false);
    load();
  }
  async function remove(id) {
    if (!confirm("¿Eliminar esta restricción?")) return;
    await fetch(`/api/restricciones/${id}`, { method: "DELETE" });
    load();
  }

  if (loading) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-bold text-lg">Restricciones horarias</h2>
          <p className="text-xs text-[#7A8FBE] mt-0.5">
            Horarios en los que una departamental, un equipo/pareja o una persona no pueden jugar. Se aplican
            automáticamente al sortear y al autoresolver superposiciones (las individuales quedan registradas,
            pero recién se van a aplicar solas cuando tengamos los datos de inscriptos por persona).
          </p>
        </div>
        <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-2 bg-[#2FD3C4] text-[#0C2043] text-sm px-4 py-2.5 rounded-lg hover:bg-[#1E9C90] whitespace-nowrap">
          <Plus className="w-4 h-4" /> Nueva restricción
        </button>
      </div>

      {showForm && (
        <div className="bg-[#0C2043] border border-[#21426E] rounded-lg p-4 mb-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Departamental</label>
              <select className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.departamentalId} onChange={(e) => setForm({ ...form, departamentalId: e.target.value, teamLabel: "", participantName: "" })}>
                <option value="">-- elegir --</option>
                {departamentales.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Alcance</label>
              <select className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value, teamLabel: "", participantName: "" })}>
                {Object.entries(SCOPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          {form.scope === "equipo" && (
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Equipo o pareja inscripto</label>
              <select className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.teamLabel} onChange={(e) => setForm({ ...form, teamLabel: e.target.value })} disabled={!form.departamentalId || optionsLoading}>
                <option value="">{!form.departamentalId ? "-- primero elegí la departamental --" : optionsLoading ? "Cargando…" : options.teams.length === 0 ? "Esta departamental no tiene equipos inscriptos" : "-- elegir --"}</option>
                {options.teams.map((t) => (
                  <option key={t.label} value={t.label}>{t.label} — {t.categories.join("; ")}</option>
                ))}
              </select>
            </div>
          )}
          {form.scope === "individual" && (
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Persona inscripta</label>
              <select className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.participantName} onChange={(e) => setForm({ ...form, participantName: e.target.value })} disabled={!form.departamentalId || optionsLoading}>
                <option value="">{!form.departamentalId ? "-- primero elegí la departamental --" : optionsLoading ? "Cargando…" : options.participants.length === 0 ? "Esta departamental no tiene personas inscriptas" : "-- elegir --"}</option>
                {options.participants.map((p) => (
                  <option key={p.id} value={p.fullName}>{p.fullName} — {p.categories.join("; ")}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Día</label>
              <select className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })}>
                <option value="">Todos los días</option>
                {DAYS.map((d) => <option key={d} value={d}>{DAY_LABEL[d]}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-[#EDE7D6]">
              <input type="checkbox" checked={form.unavailableAllDay} onChange={(e) => setForm({ ...form, unavailableAllDay: e.target.checked })} />
              No disponible en todo el día
            </label>
          </div>

          {!form.unavailableAllDay && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">No antes de (opcional)</label>
                <input type="time" className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.notBefore} onChange={(e) => setForm({ ...form, notBefore: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">No después de (opcional)</label>
                <input type="time" className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.notAfter} onChange={(e) => setForm({ ...form, notAfter: e.target.value })} />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[#9FB0D0] mb-1">Nota (opcional)</label>
            <input type="text" placeholder="ej. llega en combi, sale a las 14 desde Necochea" className="w-full bg-[#163A67] border border-[#2A4E85] rounded-lg px-3 py-1.5 text-sm" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <button onClick={submit} className="bg-[#2FD3C4] text-[#0C2043] text-sm font-semibold px-4 py-2 rounded-lg hover:brightness-95">Guardar restricción</button>
            <button onClick={() => setShowForm(false)} className="bg-[#163A67] border border-[#2A4E85] text-sm px-4 py-2 rounded-lg">Cancelar</button>
          </div>
        </div>
      )}

      {restrictions.length === 0 ? (
        <p className="text-sm text-[#7A8FBE]">No hay restricciones cargadas todavía.</p>
      ) : (
        <ul className="space-y-1.5">
          {restrictions.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 bg-[#0C2043] border border-[#21426E] rounded-lg px-3 py-2 text-sm">
              <div>
                <p className="font-medium">
                  {r.departamental_name}
                  {r.scope === "equipo" && ` — equipo "${r.team_label}"`}
                  {r.scope === "individual" && ` — ${r.participant_name}`}
                  {r.scope === "individual" && (
                    <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-[#E0C15A]">
                      <AlertTriangle className="w-3 h-3" /> sin aplicar automático (falta el CSV)
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#7A8FBE]">
                  {r.day ? DAY_LABEL[r.day] : "Todos los días"} ·{" "}
                  {r.unavailable_all_day ? "no disponible en todo el día" : [
                    r.not_before ? `no antes de ${r.not_before.slice(0, 5)}` : null,
                    r.not_after ? `no después de ${r.not_after.slice(0, 5)}` : null,
                  ].filter(Boolean).join(" · ") || "sin franja específica"}
                  {r.note ? ` · ${r.note}` : ""}
                </p>
              </div>
              <button onClick={() => remove(r.id)} className="text-[#7A8FBE] hover:text-[#E0684A] shrink-0"><Trash2 className="w-4 h-4" /></button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
