import { isPersonEntrant } from "./sorteoLogic";

// Dado un array de partidos de una llave (con round y seq), calcula la
// posición vertical (en unidades de fila) de cada uno para poder dibujar
// las líneas de conexión entre rondas de forma prolija.
export function computeBracketLayout(matches) {
  if (!matches || matches.length === 0) return [];

  const rounds = {};
  matches.forEach((m) => {
    if (!rounds[m.round]) rounds[m.round] = [];
    rounds[m.round].push(m);
  });
  const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  roundNumbers.forEach((r) => rounds[r].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0)));

  const positions = {};
  const firstRound = roundNumbers[0];
  rounds[firstRound].forEach((m, i) => { positions[`${firstRound}-${i}`] = i; });

  for (let idx = 1; idx < roundNumbers.length; idx++) {
    const r = roundNumbers[idx];
    const prevR = roundNumbers[idx - 1];
    rounds[r].forEach((m, i) => {
      const yA = positions[`${prevR}-${2 * i}`];
      const yB = positions[`${prevR}-${2 * i + 1}`];
      const y = yA !== undefined && yB !== undefined ? (yA + yB) / 2 : yA ?? yB ?? i;
      positions[`${r}-${i}`] = y;
    });
  }

  return roundNumbers.map((r) => rounds[r].map((m, i) => ({ ...m, y: positions[`${r}-${i}`] })));
}

export const BRACKET_ROW_HEIGHT = 110;
export const BRACKET_COL_WIDTH = 300;
export const BRACKET_BOX_WIDTH = 240;
export const BRACKET_BOX_HEIGHT = 68;
// Categorías de UNA persona (Ajedrez, Tenis/Tenis de Mesa Singles): el
// casillero imprime solo la departamental, dejando un espacio en blanco
// debajo para completar el nombre a mano -- necesita más alto que el de
// un equipo, que es una sola línea fija.
export const BRACKET_INDIVIDUAL_EXTRA_HEIGHT = 28;

// Una llave es de UNA persona si alguno de sus casilleros ya trae una
// etiqueta de persona (ver isPersonEntrant en sorteoLogic.js) -- una
// misma categoría siempre sortea equipos O personas, nunca mezclado.
export function isIndividualBracket(matches) {
  return (matches || []).some((m) => isPersonEntrant(m.teamA) || isPersonEntrant(m.teamB));
}

export function bracketDimensions(matches) {
  const rounds = computeBracketLayout(matches);
  if (rounds.length === 0) return { width: 0, height: 0, rounds, rowHeight: BRACKET_ROW_HEIGHT, boxHeight: BRACKET_BOX_HEIGHT };
  const firstRoundCount = rounds[0].length;
  const extra = isIndividualBracket(matches) ? BRACKET_INDIVIDUAL_EXTRA_HEIGHT : 0;
  const rowHeight = BRACKET_ROW_HEIGHT + extra;
  const boxHeight = BRACKET_BOX_HEIGHT + extra;
  return {
    width: rounds.length * BRACKET_COL_WIDTH + 60,
    height: firstRoundCount * rowHeight + 140,
    rounds,
    rowHeight,
    boxHeight,
  };
}
