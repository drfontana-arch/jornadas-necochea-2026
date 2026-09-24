/* Lógica PURA para importar el CSV de inscriptos (sin acceso a datos): parsear
   el archivo y decidir, fila por fila, si se puede cargar contra lo que YA
   está configurado en el sistema (departamentales, disciplinas, categorías).
   No crea nada por su cuenta salvo departamentales -- una disciplina o
   categoría que falte se reporta para que se configure a mano (necesita
   sedes/horarios que el CSV no trae). */

const EXPECTED_HEADERS = ["participante_id", "nombre", "apellido", "departamental", "disciplina", "categoria", "equipo", "equipo_nro"];

// Además de acentos/mayúsculas/espacios, también se ignora la puntuación
// (guiones, puntos, paréntesis, "+") -- así "Avellaneda-Lanús" matchea con
// "AVELLANEDA LANUS", y "Senior (+42)" matchea con "Senior 42", en vez de
// reportarse como "no configurada" solo por una diferencia de formato.
export function normalizeText(s) {
  return (s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
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

// Clave para mapear a mano una disciplina del CSV a una ya configurada, cuyo
// nombre no matchea ni siquiera después de normalizar (ej. el CSV dice
// "Hockey" y en el sistema está como "Hockey (Seven)"). Se usa tal cual en
// `overrides.disciplines`.
export function disciplineOverrideKey(disciplinaRaw) {
  return normalizeText(disciplinaRaw);
}
// Ídem para una categoría puntual dentro de una disciplina YA resuelta
// (directo o por override). Se usa tal cual en `overrides.categories`.
export function categoryOverrideKey(disciplineId, categoriaRaw) {
  return `${disciplineId}::${normalizeText(categoriaRaw)}`;
}

/* referenceData = { departamentales: [{id,name}], disciplines: [{id,name,categories:[{id,name,...}]}] }
   (tal como los devuelven listDepartamentales() y listDisciplines() de lib/db.js)

   overrides = { disciplines: { [disciplineOverrideKey]: disciplineId }, categories: { [categoryOverrideKey]: categoryId } }
   -- mapeos a mano para cuando el texto del CSV no matchea ni normalizado
   (nombres realmente distintos, no solo una diferencia de formato).

   Devuelve { fatalError } si al CSV le faltan columnas, o si no:
   { totalRows, valid, errors, skipped, departamentalesToCreate, participantesUnicos, categoriasAfectadas } */
export function resolveImportRows(csvText, referenceData, overrides = {}) {
  const rows = parseCsv(csvText);
  const { header, objects } = rowsToObjects(rows);

  const missingCols = EXPECTED_HEADERS.filter((h) => !header.includes(h));
  if (missingCols.length > 0) {
    return { fatalError: `Al CSV le faltan columnas: ${missingCols.join(", ")}. Se esperan: ${EXPECTED_HEADERS.join(", ")}.` };
  }

  const discOverrides = overrides.disciplines || {};
  const catOverrides = overrides.categories || {};

  const depByNorm = new Map((referenceData.departamentales || []).map((d) => [normalizeText(d.name), d]));
  const discById = new Map((referenceData.disciplines || []).map((d) => [d.id, d]));
  const discList = (referenceData.disciplines || []).map((d) => ({
    id: d.id,
    name: d.name,
    catByNorm: new Map((d.categories || []).map((c) => [normalizeText(c.name), c])),
    catById: new Map((d.categories || []).map((c) => [c.id, c])),
  }));
  const discListById = new Map(discList.map((d) => [d.id, d]));
  const discByNorm = new Map(discList.map((d) => [normalizeText(d.name), d]));

  const valid = [];
  const errors = [];
  const skippedGroups = new Map(); // key -> { type, reason, count, sample, disciplinaRaw, categoriaRaw, disciplineId }
  const departamentalesToCreate = new Map(); // normName -> nombre original (primera vez que aparece)
  const seenParticipantCategory = new Set(); // "participanteId::categoryId"
  const participantesSet = new Set();

  function addSkip(group, fullName) {
    const key = group.key;
    if (!skippedGroups.has(key)) skippedGroups.set(key, { ...group, count: 0, sample: [] });
    const g = skippedGroups.get(key);
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

    // La disciplina resuelve por nombre normalizado, o -- si se mapeó a
    // mano porque el nombre es realmente distinto -- por el override.
    const discKey = disciplineOverrideKey(disciplinaRaw);
    let disc = discByNorm.get(normalizeText(disciplinaRaw));
    if (!disc && discOverrides[discKey]) disc = discListById.get(discOverrides[discKey]);
    if (!disc) {
      addSkip({ key: `disc::${discKey}`, type: "discipline", reason: `Disciplina no configurada: "${disciplinaRaw}"`, disciplinaRaw }, fullName);
      return;
    }

    const catKey = categoryOverrideKey(disc.id, categoriaRaw);
    let cat = disc.catByNorm.get(normalizeText(categoriaRaw));
    if (!cat && catOverrides[catKey]) cat = disc.catById.get(catOverrides[catKey]);
    if (!cat) {
      addSkip({
        key: `cat::${catKey}`, type: "category",
        reason: `Categoría no configurada: "${disc.name} · ${categoriaRaw}"`,
        disciplinaRaw, categoriaRaw, disciplineId: disc.id, disciplineName: disc.name,
      }, fullName);
      return;
    }

    const dupKey = `${participanteId}::${cat.id}`;
    if (seenParticipantCategory.has(dupKey)) {
      addSkip({ key: "dup", type: "duplicate", reason: "Inscripción duplicada (la misma persona repetida en la misma categoría)" }, fullName);
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
