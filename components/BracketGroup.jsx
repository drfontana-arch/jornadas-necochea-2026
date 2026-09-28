"use client";
import { bracketDimensions, isIndividualBracket, SHOW_SCHEDULE_IN_POSTER, BRACKET_COL_WIDTH, BRACKET_BOX_WIDTH } from "../lib/bracketLayout";
import { baseDept, isPersonEntrant } from "../lib/sorteoLogic";

const NAVY = "#1B3D6D";
const NAVY_DARK = "#0F274A";
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

export default function BracketGroup({ matches, title, x = 0, y = 0 }) {
  const { rounds, width, rowHeight, boxHeight } = bracketDimensions(matches);
  if (rounds.length === 0) return null;
  // Categorías de UNA persona (Ajedrez, Tenis/Tenis de Mesa Singles): en
  // vez del nombre completo se imprime la departamental, con un espacio
  // en blanco debajo para completar el nombre a mano (puede cambiar el
  // día del torneo). rowHeight/boxHeight ya vienen más altos para esto
  // (ver bracketDimensions en lib/bracketLayout.js).
  const individual = isIndividualBracket(matches);

  function boxX(roundIdx) { return x + 30 + roundIdx * BRACKET_COL_WIDTH; }
  function boxY(rowUnit) { return y + (title ? 100 : 40) + rowUnit * rowHeight; }

  return (
    <g>
      {title && (
        <text x={x + width / 2} y={y + 50} textAnchor="middle" fontSize="30" fontWeight="700" fill={NAVY_DARK} fontFamily="Georgia, serif">
          {title}
        </text>
      )}

      {rounds.map(function (round, ci) {
        return (
          <text key={"h-" + ci} x={boxX(ci) + BRACKET_BOX_WIDTH / 2} y={y + (title ? 80 : 20)} textAnchor="middle" fontSize="15" fontWeight="700"
            fill={NAVY} letterSpacing="1.5" fontFamily="Arial, sans-serif">
            {round[0] && round[0].label && round.length === 1 ? round[0].label.toUpperCase() : "RONDA " + (ci + 1)}
          </text>
        );
      })}

      {rounds.map(function (round, ci) {
        if (ci === rounds.length - 1) return null;
        const nextRound = rounds[ci + 1];
        return round.map(function (m, i) {
          const parentX2 = boxX(ci) + BRACKET_BOX_WIDTH;
          const parentY = boxY(m.y) + boxHeight / 2;
          const childIdx = Math.floor(i / 2);
          const child = nextRound[childIdx];
          if (!child) return null;
          const childX1 = boxX(ci + 1);
          const childY = boxY(child.y) + boxHeight / 2;
          const midX = parentX2 + (BRACKET_COL_WIDTH - BRACKET_BOX_WIDTH) / 2;
          const d = "M " + parentX2 + " " + parentY + " H " + midX + " V " + childY + " H " + childX1;
          return <path key={"c-" + ci + "-" + i} d={d} stroke="#B9C4D4" strokeWidth="2" fill="none" />;
        });
      })}

      {rounds.map(function (round, ci) {
        return round.map(function (m, i) {
          const bx = boxX(ci);
          const by = boxY(m.y);
          const rawA = m.teamA || "";
          const rawB = m.bye ? "BYE (pasa directo)" : (m.teamB || "");
          // Casillero sin definir todavía (ni equipo ni BYE): se deja en
          // blanco a propósito -- en el póster impreso sirve para
          // completar el nombre del ganador a mano, en vez de imprimir
          // "A definir" y tener que tacharlo. En una llave individual, en
          // vez del nombre de la persona se imprime la departamental (ver
          // más abajo la línea de puntos debajo, para completar el
          // nombre real a mano).
          const teamALabel = individual && isPersonEntrant(rawA) ? baseDept(rawA) : rawA;
          const teamBLabel = individual && !m.bye && isPersonEntrant(rawB) ? baseDept(rawB) : rawB;
          const half = boxHeight / 2;
          return (
            <g key={m.id}>
              <rect x={bx} y={by} width={BRACKET_BOX_WIDTH} height={boxHeight} rx={6} fill="#FFFFFF" stroke={NAVY} strokeWidth="1.5" />
              <line x1={bx} y1={by + half} x2={bx + BRACKET_BOX_WIDTH} y2={by + half} stroke="#DDE3EC" strokeWidth="1" />
              <text x={bx + 10} y={individual ? by + 20 : by + half - 8} fontSize="15" fontWeight="600" fill={NAVY_DARK} fontFamily="Arial, sans-serif">
                {teamALabel.slice(0, 26)}
              </text>
              {individual && (
                <line x1={bx + 10} y1={by + half - 10} x2={bx + BRACKET_BOX_WIDTH - 10} y2={by + half - 10} stroke="#B9C4D4" strokeWidth="1" strokeDasharray="3,2" />
              )}
              <text x={bx + 10} y={individual ? by + half + 20 : by + half + 18} fontSize="15" fontWeight="600" fill={NAVY_DARK} fontFamily="Arial, sans-serif">
                {teamBLabel.slice(0, 26)}
              </text>
              {individual && !m.bye && (
                <line x1={bx + 10} y1={by + boxHeight - 10} x2={bx + BRACKET_BOX_WIDTH - 10} y2={by + boxHeight - 10} stroke="#B9C4D4" strokeWidth="1" strokeDasharray="3,2" />
              )}
              {SHOW_SCHEDULE_IN_POSTER && m.day && (
                <text x={bx + BRACKET_BOX_WIDTH - 8} y={by - 6} fontSize="12" textAnchor="end" fill="#5A6B85" fontFamily="Arial, sans-serif">
                  {(DAY_LABEL[m.day] || m.day) + " · " + m.time + " · Cancha " + m.court}
                </text>
              )}
            </g>
          );
        });
      })}
    </g>
  );
}
