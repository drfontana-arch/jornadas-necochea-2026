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

export function bracketDimensions(matches) {
  const rounds = computeBracketLayout(matches);
  if (rounds.length === 0) return { width: 0, height: 0, rounds };
  const firstRoundCount = rounds[0].length;
  return {
    width: rounds.length * BRACKET_COL_WIDTH + 60,
    height: firstRoundCount * BRACKET_ROW_HEIGHT + 140,
    rounds,
  };
}
