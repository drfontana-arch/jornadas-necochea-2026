"use client";
import { computeBracketLayout } from "../lib/bracketLayout";

const NAVY = "#1B3D6D";
const NAVY_DARK = "#0F274A";

const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

export default function BracketSVG({ matches, title }) {
  const rounds = computeBracketLayout(matches);
  if (rounds.length === 0) return null;

  const rowHeight = 110;
  const colWidth = 300;
  const boxWidth = 240;
  const boxHeight = 68;
  const firstRoundCount = rounds[0].length;
  const height = firstRoundCount * rowHeight + 140;
  const width = rounds.length * colWidth + 60;

  function boxX(roundIdx) { return 30 + roundIdx * colWidth; }
  function boxY(rowUnit) { return 100 + rowUnit * rowHeight; }

  return (
    <svg viewBox={"0 0 " + width + " " + height} width="100%" style={{ minWidth: width }} xmlns="http://www.w3.org/2000/svg">
      <text x={width / 2} y={50} textAnchor="middle" fontSize="30" fontWeight="700" fill={NAVY_DARK} fontFamily="Georgia, serif">
        {title}
      </text>

      {rounds.map(function (round, ci) {
        return (
          <text key={"h-" + ci} x={boxX(ci) + boxWidth / 2} y={80} textAnchor="middle" fontSize="15" fontWeight="700"
            fill={NAVY} letterSpacing="1.5" fontFamily="Arial, sans-serif">
            {round[0] && round[0].label && round.length === 1 ? round[0].label.toUpperCase() : "RONDA " + (ci + 1)}
          </text>
        );
      })}

      {rounds.map(function (round, ci) {
        if (ci === rounds.length - 1) return null;
        const nextRound = rounds[ci + 1];
        return round.map(function (m, i) {
          const parentX2 = boxX(ci) + boxWidth;
          const parentY = boxY(m.y) + boxHeight / 2;
          const childIdx = Math.floor(i / 2);
          const child = nextRound[childIdx];
          if (!child) return null;
          const childX1 = boxX(ci + 1);
          const childY = boxY(child.y) + boxHeight / 2;
          const midX = parentX2 + (colWidth - boxWidth) / 2;
          const d = "M " + parentX2 + " " + parentY + " H " + midX + " V " + childY + " H " + childX1;
          return <path key={"c-" + ci + "-" + i} d={d} stroke="#B9C4D4" strokeWidth="2" fill="none" />;
        });
      })}

      {rounds.map(function (round, ci) {
        return round.map(function (m, i) {
          const x = boxX(ci);
          const y = boxY(m.y);
          const teamALabel = m.teamA || (m.bye ? "" : "A definir");
          const teamBLabel = m.bye ? "BYE (pasa directo)" : (m.teamB || "A definir");
          return (
            <g key={m.id}>
              <rect x={x} y={y} width={boxWidth} height={boxHeight} rx={6} fill="#FFFFFF" stroke={NAVY} strokeWidth="1.5" />
              <line x1={x} y1={y + boxHeight / 2} x2={x + boxWidth} y2={y + boxHeight / 2} stroke="#DDE3EC" strokeWidth="1" />
              <text x={x + 10} y={y + boxHeight / 2 - 8} fontSize="15" fontWeight="600" fill={NAVY_DARK} fontFamily="Arial, sans-serif">
                {teamALabel.slice(0, 26)}
              </text>
              <text x={x + 10} y={y + boxHeight / 2 + 18} fontSize="15" fontWeight="600" fill={NAVY_DARK} fontFamily="Arial, sans-serif">
                {teamBLabel.slice(0, 26)}
              </text>
              {m.day && (
                <text x={x + boxWidth - 8} y={y - 6} fontSize="12" textAnchor="end" fill="#5A6B85" fontFamily="Arial, sans-serif">
                  {(DAY_LABEL[m.day] || m.day) + " · " + m.time + " · Cancha " + m.court}
                </text>
              )}
            </g>
          );
        });
      })}
    </svg>
  );
}
