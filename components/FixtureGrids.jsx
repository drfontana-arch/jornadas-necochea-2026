"use client";
import {
  GRID_DAY_LABEL, catKeyOf, matchText, courtLabelOf,
  buildCourtGrid, buildAgendaGrid, courtRowLabel,
} from "../lib/fixtureGrid";

const dayLabel = (d) => GRID_DAY_LABEL[d] || d;

function Chip({ m, colors, children }) {
  const c = colors[catKeyOf(m)];
  return (
    <div
      className="rounded-md px-2 py-1 text-xs leading-snug text-[#0C2043] border border-black/10"
      style={{ background: c ? c.bg : "#d8dee9" }}
      title={`${m.disciplineName} · ${m.categoryName}`}
    >
      {children}
    </div>
  );
}

export function CategoryLegend({ matches, colors }) {
  const keys = [...new Set(matches.map(catKeyOf))].filter((k) => colors[k]);
  keys.sort((a, b) => colors[a].label.localeCompare(colors[b].label, "es"));
  if (keys.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {keys.map((k) => (
        <span key={k} className="text-[11px] rounded px-2 py-0.5 text-[#0C2043] border border-black/10" style={{ background: colors[k].bg }}>
          {colors[k].label}
        </span>
      ))}
    </div>
  );
}

/* Grilla por cancha: una fila por cancha, una columna por día. */
export function CourtGrid({ matches, colors }) {
  const { days, rows } = buildCourtGrid(matches);
  if (rows.length === 0) return <p className="py-6 text-center text-sm text-[#7A8FBE]">No hay partidos para mostrar.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[#9FB0D0]">
            <th className="py-2 pr-3 sticky left-0 bg-[#132A4C] z-10 min-w-[200px]">Cancha</th>
            {days.map((d) => <th key={d} className="py-2 px-2 min-w-[260px]">{dayLabel(d)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-[#21426E] align-top">
              <td className="py-2 pr-3 sticky left-0 bg-[#132A4C] z-10 font-semibold">{courtRowLabel(r)}</td>
              {days.map((d) => (
                <td key={d} className="py-2 px-2">
                  <div className="space-y-1">
                    {(r.byDay[d] || []).map((m) => (
                      <Chip key={m.id} m={m} colors={colors}>
                        <span className="font-mono font-bold">{m.time}</span> · {m.categoryName}
                        <br />
                        {matchText(m)}
                      </Chip>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Grilla tipo agenda: horas en vertical, días en horizontal. */
export function AgendaGrid({ matches, colors }) {
  const { days, times, cells } = buildAgendaGrid(matches);
  if (times.length === 0) return <p className="py-6 text-center text-sm text-[#7A8FBE]">No hay partidos para mostrar.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-[#9FB0D0]">
            <th className="py-2 pr-3 sticky left-0 bg-[#132A4C] z-10 w-16">Hora</th>
            {days.map((d) => <th key={d} className="py-2 px-2 min-w-[300px]">{dayLabel(d)}</th>)}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => (
            <tr key={t} className="border-t border-[#21426E] align-top">
              <td className="py-2 pr-3 sticky left-0 bg-[#132A4C] z-10 font-mono font-bold">{t}</td>
              {days.map((d) => (
                <td key={d} className="py-2 px-2">
                  <div className="space-y-1">
                    {(cells[`${t}::${d}`] || []).map((m) => (
                      <Chip key={m.id} m={m} colors={colors}>
                        <span className="font-semibold">{m.disciplineName} · {courtLabelOf(m)}</span> · {m.categoryName}
                        <br />
                        {matchText(m)}
                      </Chip>
                    ))}
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
