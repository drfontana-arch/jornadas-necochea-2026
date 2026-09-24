/* Lógica PURA para importar el CSV de inscriptos (sin acceso a datos): parsear
   el archivo y decidir, fila por fila, si se puede cargar contra lo que YA
   está configurado en el sistema (departamentales, disciplinas, categorías).
   No crea nada por su cuenta salvo departamentales -- una disciplina o
   categoría que falte se reporta para que se configure a mano (necesita
   sedes/horarios que el CSV no trae). */

const EXPECTED_HEADERS = ["participante_id", "nombre", "apellido", "departamental", "disciplina", "categoria", "equipo", "equipo_nro"];

export function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Parser CSV chico (soporta campos entre comillas con comas/comillas
// adentro), sin depender de ninguna librería externa.
export function parseCsv(text) {
  const clean = text.replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field); field = "";
    } else if (ch === "\n") {
      row.push(field); field = "";
      rows.push(row); row = [];
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}

function rowsToObjects(rows) {
  if (rows.length === 0) return { header: [], objects: [] };
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const objects = rows.slice(1).map((r, i) => {
    const obj = { __line: i + 2 };
    header.forEach((h, idx) => { obj[h] = (r[idx] ?? "").trim(); });
    return obj;
  });
  return { header, objects };
}

/* referenceData = { departamentales: [{id,name}], disciplines: [{id,name,categories:[{id,name,...}]}] }
   (tal como los devuelven listDepartamentales() y listDisciplines() de lib/db.js)

   Devuelve { fatalError } si al CSV le faltan columnas, o si no:
   { totalRows, valid, errors, skipped, departamentalesToCreate, participantesUnicos, categoriasAfectadas } */
export function resolveImportRows(csvText, referenceData) {
  const rows = parseCsv(csvText);
  const { header, objects } = rowsToObjects(rows);

  const missingCols = EXPECTED_HEADERS.filter((h) => !header.includes(h));
  if (missingCols.length > 0) {
    return { fatalError: `Al CSV le faltan columnas: ${missingCols.join(", ")}. Se esperan: ${EXPECTED_HEADERS.join(", ")}.` };
  }

  const depByNorm = new Map((referenceData.departamentales || []).map((d) => [normalizeText(d.name), d]));
  const discList = (referenceData.disciplines || []).map((d) => ({
    id: d.id,
    name: d.name,
    catByNorm: new Map((d.categories || []).map((c) => [normalizeText(c.name), c])),
  }));
  const discByNorm = new Map(discList.map((d) => [normalizeText(d.name), d]));

  const valid = [];
  const errors = [];
  const skippedGroups = new Map(); // reason -> { reason, count, sample: [] }
  const departamentalesToCreate = new Map(); // normName -> nombre original (primera vez que aparece)
  const seenParticipantCategory = new Set(); // "participanteId::categoryId"
  const participantesSet = new Set();

  function addSkip(reason, fullName) {
    if (!skippedGroups.has(reason)) skippedGroups.set(reason, { reason, count: 0, sample: [] });
    const g = skippedGroups.get(reason);
    g.count++;
    if (fullName && g.sample.length < 3 && !g.sample.includes(fullName)) g.sample.push(fullName);
  }

  objects.forEach((o) => {
    const participanteId = (o.participante_id || "").trim();
    const nombre = (o.nombre || "").trim();
    const apellido = (o.apellido || "").trim();
    const fullName = `${nombre} ${apellido}`.replace(/\s+/g, " ").trim();
    const departamentalRaw = (o.departamental || "").trim();
    const disciplinaRaw = (o.disciplina || "").trim();
    const categoriaRaw = (o.categoria || "").trim();
    const equipoRaw = (o.equipo || "").trim();
    const equipoNroRaw = (o.equipo_nro || "").trim();

    if (!/^\d+$/.test(participanteId)) {
      errors.push({ line: o.__line, reason: `participante_id inválido: "${participanteId}"` });
      return;
    }
    if (!fullName) {
      errors.push({ line: o.__line, reason: `Fila ${o.__line}: falta nombre y/o apellido.` });
      return;
    }
    if (!departamentalRaw) {
      errors.push({ line: o.__line, reason: `${fullName}: falta la departamental.` });
      return;
    }
    if (!disciplinaRaw || !categoriaRaw) {
      errors.push({ line: o.__line, reason: `${fullName}: falta disciplina o categoría.` });
      return;
    }

    const depNorm = normalizeText(departamentalRaw);
    if (!depByNorm.has(depNorm) && !departamentalesToCreate.has(depNorm)) {
      departamentalesToCreate.set(depNorm, departamentalRaw);
    }

    const disc = discByNorm.get(normalizeText(disciplinaRaw));
    if (!disc) {
      addSkip(`Disciplina no configurada: "${disciplinaRaw}"`, fullName);
      return;
    }
    const cat = disc.catByNorm.get(normalizeText(categoriaRaw));
    if (!cat) {
      addSkip(`Categoría no configurada: "${disc.name} · ${categoriaRaw}"`, fullName);
      return;
    }

    const dupKey = `${participanteId}::${cat.id}`;
    if (seenParticipantCategory.has(dupKey)) {
      addSkip("Inscripción duplicada (la misma persona repetida en la misma categoría)", fullName);
      return;
    }
    seenParticipantCategory.add(dupKey);

    participantesSet.add(participanteId);
    valid.push({
      participanteId,
      fullName,
      departamentalNorm: depNorm,
      departamentalDisplay: departamentalRaw,
      disciplineId: disc.id,
      disciplineName: disc.name,
      categoryId: cat.id,
      categoryName: cat.name,
      teamLabel: equipoRaw || null,
      teamNumber: equipoRaw ? (parseInt(equipoNroRaw, 10) || 1) : null,
    });
  });

  return {
    totalRows: objects.length,
    valid,
    errors,
    skipped: [...skippedGroups.values()].sort((a, b) => b.count - a.count),
    departamentalesToCreate: [...departamentalesToCreate.values()],
    participantesUnicos: participantesSet.size,
    categoriasAfectadas: new Set(valid.map((v) => v.categoryId)).size,
  };
}
