"use client";
import { bracketDimensions, BRACKET_ROW_HEIGHT, BRACKET_COL_WIDTH, BRACKET_BOX_WIDTH, BRACKET_BOX_HEIGHT } from "../lib/bracketLayout";

const NAVY = "#1B3D6D";
const NAVY_DARK = "#0F274A";
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

export default function BracketGroup({ matches, title, x = 0, y = 0 }) {
  const { rounds, width } = bracketDimensions(matches);
  if (rounds.length === 0) return null;

  function boxX(roundIdx) { return x + 30 + roundIdx * BRACKET_COL_WIDTH; }
  function boxY(rowUnit) { return y + (title ? 100 : 40) + rowUnit * BRACKET_ROW_HEIGHT; }

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
          const parentY = boxY(m.y) + BRACKET_BOX_HEIGHT / 2;
          const childIdx = Math.floor(i / 2);
          const child = nextRound[childIdx];
          if (!child) return null;
          const childX1 = boxX(ci + 1);
          const childY = boxY(child.y) + BRACKET_BOX_HEIGHT / 2;
          const midX = parentX2 + (BRACKET_COL_WIDTH - BRACKET_BOX_WIDTH) / 2;
          const d = "M " + parentX2 + " " + parentY + " H " + midX + " V " + childY + " H " + childX1;
          return <path key={"c-" + ci + "-" + i} d={d} stroke="#B9C4D4" strokeWidth="2" fill="none" />;
        });
      })}

      {rounds.map(function (round, ci) {
        return round.map(function (m, i) {
          const bx = boxX(ci);
          const by = boxY(m.y);
          const teamALabel = m.teamA || (m.bye ? "" : "A definir");
          const teamBLabel = m.bye ? "BYE (pasa directo)" : (m.teamB || "A definir");
          return (
            <g key={m.id}>
              <rect x={bx} y={by} width={BRACKET_BOX_WIDTH} height={BRACKET_BOX_HEIGHT} rx={6} fill="#FFFFFF" stroke={NAVY} strokeWidth="1.5" />
              <line x1={bx} y1={by + BRACKET_BOX_HEIGHT / 2} x2={bx + BRACKET_BOX_WIDTH} y2={by + BRACKET_BOX_HEIGHT / 2} stroke="#DDE3EC" strokeWidth="1" />
              <text x={bx + 10} y={by + BRACKET_BOX_HEIGHT / 2 - 8} fontSize="15" fontWeight="600" fill={NAVY_DARK} fontFamily="Arial, sans-serif">
                {teamALabel.slice(0, 26)}
              </text>
              <text x={bx + 10} y={by + BRACKET_BOX_HEIGHT / 2 + 18} fontSize="15" fontWeight="600" fill={NAVY_DARK} fontFamily="Arial, sans-serif">
                {teamBLabel.slice(0, 26)}
              </text>
              {m.day && (
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
