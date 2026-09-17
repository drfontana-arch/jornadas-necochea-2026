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
