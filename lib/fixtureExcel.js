/* Exporta el fixture a un .xlsx real (con colores por categoría), que abre
   igual en Excel y en Google Sheets. Se carga exceljs recién al exportar. */
import {
  GRID_DAY_LABEL, catKeyOf, catLabelOf, matchText, courtLabelOf,
  buildCourtGrid, buildAgendaGrid, courtRowLabel,
} from "./fixtureGrid";

const fill = (hex) => ({ type: "pattern", pattern: "solid", fgColor: { argb: `FF${hex}` } });
const HEADER_FILL = fill("163A67");
const HEADER_FONT = { bold: true, color: { argb: "FFFFFFFF" } };
const dayLabel = (d) => GRID_DAY_LABEL[d] || d;
const sheetName = (s) => s.slice(0, 31);

function styleHeader(row) {
  row.eachCell((c) => {
    c.fill = HEADER_FILL;
    c.font = HEADER_FONT;
    c.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
}

export async function exportFixtureXlsx(matches, colors, fileName = "fixture-jornadas-necochea-2026") {
  const mod = await import("exceljs/dist/exceljs.min.js");
  const ExcelJS = mod.default || mod;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Sorteador Jornadas Necochea 2026";
  const colorOf = (m) => (colors[catKeyOf(m)] ? colors[catKeyOf(m)].hex : null);
  const sorted = matches.slice().sort((a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || ""));

  // Hoja 1: listado plano
  const ws1 = wb.addWorksheet(sheetName("Listado"));
  ws1.columns = [
    { header: "Día", width: 12 }, { header: "Hora", width: 8 }, { header: "Disciplina", width: 20 },
    { header: "Sede", width: 28 }, { header: "Cancha", width: 9 }, { header: "Categoría", width: 30 },
    { header: "Etapa", width: 10 }, { header: "Partido", width: 44 },
  ];
  styleHeader(ws1.getRow(1));
  sorted.forEach((m) => {
    const row = ws1.addRow([dayLabel(m.day), m.time, m.disciplineName, m.location || "", m.court ?? "", m.categoryName, m.stage, matchText(m)]);
    const hex = colorOf(m);
    if (hex) row.getCell(6).fill = fill(hex);
  });
  ws1.views = [{ state: "frozen", ySplit: 1 }];
  ws1.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 8 } };

  // Hoja 2: por cancha (una fila por cancha, una columna por día+hora)
  const grid = buildCourtGrid(sorted);
  const slots = [...new Map(sorted.map((m) => [`${m.day}::${m.time}`, { day: m.day, time: m.time }])).values()];
  const ws2 = wb.addWorksheet(sheetName("Por cancha"));
  ws2.getColumn(1).width = 44;
  ws2.addRow(["Cancha", ...slots.map((s) => `${dayLabel(s.day)}\n${s.time}`)]);
  styleHeader(ws2.getRow(1));
  slots.forEach((_, i) => { ws2.getColumn(i + 2).width = 30; });
  grid.rows.forEach((r) => {
    const cells = slots.map((s) => (r.byDay[s.day] || []).filter((m) => m.time === s.time));
    const row = ws2.addRow([courtRowLabel(r), ...cells.map((ms) => ms.map((m) => `${m.categoryName}\n${matchText(m)}`).join("\n\n"))]);
    row.getCell(1).font = { bold: true };
    cells.forEach((ms, i) => {
      const cell = row.getCell(i + 2);
      cell.alignment = { wrapText: true, vertical: "top" };
      if (ms.length > 0 && colorOf(ms[0])) cell.fill = fill(colorOf(ms[0]));
    });
  });
  ws2.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  // Hoja 3: agenda (una fila por hora, una columna por día)
  const agenda = buildAgendaGrid(sorted);
  const ws3 = wb.addWorksheet(sheetName("Agenda"));
  ws3.getColumn(1).width = 9;
  ws3.addRow(["Hora", ...agenda.days.map(dayLabel)]);
  styleHeader(ws3.getRow(1));
  agenda.days.forEach((_, i) => { ws3.getColumn(i + 2).width = 60; });
  agenda.times.forEach((t) => {
    const cells = agenda.days.map((d) => agenda.cells[`${t}::${d}`] || []);
    const row = ws3.addRow([t, ...cells.map((ms) => ms.map((m) => `${m.disciplineName} · ${courtLabelOf(m)} · ${m.categoryName}: ${matchText(m)}`).join("\n"))]);
    row.getCell(1).font = { bold: true };
    cells.forEach((ms, i) => {
      const cell = row.getCell(i + 2);
      cell.alignment = { wrapText: true, vertical: "top" };
      const keys = new Set(ms.map(catKeyOf));
      if (ms.length > 0 && keys.size === 1 && colorOf(ms[0])) cell.fill = fill(colorOf(ms[0]));
    });
  });
  ws3.views = [{ state: "frozen", xSplit: 1, ySplit: 1 }];

  // Hoja 4: leyenda de colores
  const ws4 = wb.addWorksheet(sheetName("Colores"));
  ws4.columns = [{ header: "Categoría", width: 50 }];
  styleHeader(ws4.getRow(1));
  const seen = new Map();
  sorted.forEach((m) => { if (!seen.has(catKeyOf(m))) seen.set(catKeyOf(m), m); });
  [...seen.values()]
    .sort((a, b) => catLabelOf(a).localeCompare(catLabelOf(b), "es"))
    .forEach((m) => {
      const row = ws4.addRow([catLabelOf(m)]);
      if (colorOf(m)) row.getCell(1).fill = fill(colorOf(m));
    });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
