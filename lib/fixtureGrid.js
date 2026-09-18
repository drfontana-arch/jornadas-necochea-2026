/* Lógica PURA de las vistas de grilla del fixture (sin React ni acceso a
   datos): colores por categoría y armado de las dos grillas. La usan la
   pantalla del Fixture y el exportador a Excel. */

export const GRID_DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

export function catKeyOf(m) {
  return m.key || `ind-${m.disciplineId}`;
}
export function catLabelOf(m) {
  return `${m.disciplineName} · ${m.categoryName}`;
}
export function matchText(m) {
  if (m.bye) return `${m.teamA || "?"} vs BYE`;
  if (m.teamB) return `${m.teamA} vs ${m.teamB}`;
  if (m.teamA) return `${m.teamA} (horario de competencia)`;
  return "A definir vs A definir";
}
export function courtLabelOf(m) {
  return m.court != null ? `Cancha ${m.court}` : "—";
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const to = (x) => Math.round(255 * x).toString(16).padStart(2, "0");
  return `${to(f(0))}${to(f(8))}${to(f(4))}`.toUpperCase();
}

/* Un color pastel por categoría. Se asigna por posición en la lista
   completa de categorías (ordenada), separando los tonos con el ángulo
   áureo para que categorías vecinas no queden parecidas. Pasar SIEMPRE la
   lista completa de partidos (no la filtrada) para que el color de cada
   categoría no cambie al filtrar. */
export function buildCategoryColors(allMatches) {
  const cats = new Map();
  allMatches.forEach((m) => { if (!cats.has(catKeyOf(m))) cats.set(catKeyOf(m), catLabelOf(m)); });
  const ordered = [...cats.entries()].sort((a, b) => a[1].localeCompare(b[1], "es"));
  const colors = {};
  ordered.forEach(([key, label], i) => {
    const h = Math.round((i * 137.508) % 360);
    const l = [80, 74, 86][i % 3];
    colors[key] = { label, bg: `hsl(${h}, 62%, ${l}%)`, hex: hslToHex(h, 62, l) };
  });
  return colors;
}

const byDayTime = (a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || "");

export function gridDays(matches) {
  return [...new Set(matches.map((m) => m.day).filter(Boolean))].sort();
}

/* Grilla A: una fila por cancha (disciplina + sede + nº de cancha), una
   columna por día; cada casillero lista los partidos de esa cancha ese día
   en orden de hora. */
export function buildCourtGrid(matches) {
  const rows = new Map();
  matches.forEach((m) => {
    const key = `${m.disciplineName}||${m.location || ""}||${m.court ?? ""}`;
    if (!rows.has(key)) {
      rows.set(key, {
        key,
        disciplineName: m.disciplineName,
        location: m.location || null,
        court: m.court ?? null,
        byDay: {},
      });
    }
    const row = rows.get(key);
    (row.byDay[m.day] = row.byDay[m.day] || []).push(m);
  });
  const list = [...rows.values()];
  list.forEach((r) => Object.values(r.byDay).forEach((arr) => arr.sort(byDayTime)));
  list.sort(
    (a, b) =>
      a.disciplineName.localeCompare(b.disciplineName, "es") ||
      (a.location || "").localeCompare(b.location || "", "es") ||
      (a.court ?? 0) - (b.court ?? 0)
  );
  return { days: gridDays(matches), rows: list };
}
export function courtRowLabel(row) {
  return [row.disciplineName, row.location, row.court != null ? `Cancha ${row.court}` : null].filter(Boolean).join(" · ");
}

/* Grilla B (agenda): una fila por hora de inicio, una columna por día; cada
   casillero lista los partidos que arrancan a esa hora ese día. */
export function buildAgendaGrid(matches) {
  const times = [...new Set(matches.map((m) => m.time).filter(Boolean))].sort();
  const cells = {};
  matches.forEach((m) => {
    const k = `${m.time}::${m.day}`;
    (cells[k] = cells[k] || []).push(m);
  });
  Object.values(cells).forEach((arr) =>
    arr.sort((a, b) => a.disciplineName.localeCompare(b.disciplineName, "es") || (a.court ?? 0) - (b.court ?? 0))
  );
  return { days: gridDays(matches), times, cells };
}
