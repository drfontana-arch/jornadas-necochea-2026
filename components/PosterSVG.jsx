"use client";
import { bracketDimensions, SHOW_SCHEDULE_IN_POSTER } from "../lib/bracketLayout";
import { logoMarkupWithSuffix, LOGO_VIEWBOX_WIDTH, LOGO_VIEWBOX_HEIGHT } from "../lib/posterLogo";
import BracketGroup from "./BracketGroup";

const NAVY = "#1B3D6D";
const NAVY_DARK = "#0F274A";
const LIGHT = "#EEF2F8";
const BORDER = "#DDE3EC";
const DAY_LABEL = { "2026-10-09": "Vie 09/10", "2026-10-10": "Sáb 10/10", "2026-10-11": "Dom 11/10" };

function groupLetter(i) { return String.fromCharCode(65 + i); }

export default function PosterSVG({ category, matches, forwardedRef }) {
  const marginX = 50;

  // El ancho de las llaves se calcula ANTES que el ancho total del
  // póster -- con muchos equipos (muchas rondas) la llave puede necesitar
  // más de los 1400px de base. Si no, al centrarla la ronda 1 quedaba con
  // coordenada negativa: literalmente fuera de la hoja, ilegible.
  const hasPlayoff = matches.playoffMatches && matches.playoffMatches.length > 0;
  const hasDraw = matches.drawMatches && matches.drawMatches.length > 0;
  const playoffDim = hasPlayoff ? bracketDimensions(matches.playoffMatches) : { width: 0, height: 0 };
  const drawDim = hasDraw ? bracketDimensions(matches.drawMatches) : { width: 0, height: 0 };
  const widestBracket = Math.max(playoffDim.width, drawDim.width);
  const width = Math.max(1400, widestBracket + marginX * 2);

  const contentWidth = width - marginX * 2;
  let cursorY = 190; // alto del header

  const groups = category.groups || [];
  const hasGroups = matches.groupMatches && matches.groupMatches.length > 0;
  let groupsTitleY = 0, groupBoxesY = 0, groupBoxHeight = 0, groupsTableHeaderY = 0, groupsTableY = 0;
  const sortedGroupMatches = hasGroups
    ? matches.groupMatches.slice().sort((a, b) => (a.day || "").localeCompare(b.day || "") || (a.time || "").localeCompare(b.time || ""))
    : [];

  if (hasGroups) {
    groupsTitleY = cursorY + 30;
    cursorY += 50;
    groupBoxesY = cursorY;
    const maxTeams = Math.max(...groups.map((g) => g.length), 1);
    groupBoxHeight = 40 + maxTeams * 26;
    const numRows = Math.ceil(groups.length / 2);
    cursorY += numRows * (groupBoxHeight + 20) + 20;

    groupsTableHeaderY = cursorY;
    cursorY += 34;
    groupsTableY = cursorY;
    cursorY += sortedGroupMatches.length * 28 + 30;
  }

  let playoffY = null;
  if (hasPlayoff) {
    cursorY += 10;
    playoffY = cursorY;
    cursorY += playoffDim.height + 30;
  }

  let drawY = null;
  if (hasDraw) {
    drawY = cursorY;
    cursorY += drawDim.height + 30;
  }

  let emptyMsgY = null;
  if (!hasGroups && playoffY === null && drawY === null) {
    emptyMsgY = cursorY + 60;
    cursorY += 100;
  }

  const totalHeight = cursorY + 40;
  const title = `${category.disciplines.name} — ${category.name}`;

  // Marca de agua: el logo centrado en la hoja, bien grande y bien tenue,
  // detrás de todo lo demás. Logo chico del encabezado: arriba a la
  // izquierda, junto al título, a color normal.
  const watermarkWidth = width * 0.7;
  const watermarkScale = watermarkWidth / LOGO_VIEWBOX_WIDTH;
  const watermarkHeight = LOGO_VIEWBOX_HEIGHT * watermarkScale;
  const watermarkX = (width - watermarkWidth) / 2;
  const watermarkY = (totalHeight - watermarkHeight) / 2;

  const headerLogoWidth = 150;
  const headerLogoScale = headerLogoWidth / LOGO_VIEWBOX_WIDTH;
  const headerLogoHeight = LOGO_VIEWBOX_HEIGHT * headerLogoScale;
  const headerLogoX = marginX;
  const headerLogoY = (150 - headerLogoHeight) / 2;

  return (
    <svg
      ref={forwardedRef}
      viewBox={`0 0 ${width} ${totalHeight}`}
      width="100%"
      style={{ minWidth: width, background: "#FFFFFF" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x={0} y={0} width={width} height={totalHeight} fill="#FFFFFF" />

      {/* Marca de agua: el logo oficial, grande y tenue, detrás de todo. */}
      <g
        transform={`translate(${watermarkX}, ${watermarkY}) scale(${watermarkScale})`}
        opacity={0.06}
        dangerouslySetInnerHTML={{ __html: logoMarkupWithSuffix("wm") }}
      />

      {/* Logo chico en el encabezado, a color normal. */}
      <g
        transform={`translate(${headerLogoX}, ${headerLogoY}) scale(${headerLogoScale})`}
        dangerouslySetInnerHTML={{ __html: logoMarkupWithSuffix("h") }}
      />

      <text x={width / 2} y={40} textAnchor="middle" fontSize="13" fontWeight="700" letterSpacing="2" fill={NAVY} fontFamily="Arial, sans-serif">
        COLEGIO DE MAGISTRADOS Y FUNCIONARIOS · PROVINCIA DE BUENOS AIRES
      </text>
      <text x={width / 2} y={82} textAnchor="middle" fontSize="30" fontWeight="700" fill={NAVY_DARK} fontFamily="Georgia, serif">
        Jornadas Deportivas Interdepartamentales — Necochea 2026
      </text>
      <text x={width / 2} y={118} textAnchor="middle" fontSize="22" fontWeight="700" fill={NAVY} fontFamily="Arial, sans-serif">
        {title}
      </text>
      <line x1={marginX} y1={150} x2={width - marginX} y2={150} stroke={NAVY} strokeWidth="3" />

      {hasGroups && (
        <g>
          <text x={marginX} y={groupsTitleY} fontSize="19" fontWeight="700" fill={NAVY} fontFamily="Arial, sans-serif">Fase de grupos</text>
          {groups.map((g, gi) => {
            const col = gi % 2;
            const row = Math.floor(gi / 2);
            const boxW = (contentWidth - 20) / 2;
            const bx = marginX + col * (boxW + 20);
            const by = groupBoxesY + row * (groupBoxHeight + 20);
            return (
              <g key={gi}>
                <rect x={bx} y={by} width={boxW} height={groupBoxHeight} fill="none" stroke={NAVY} strokeWidth="1.5" rx={4} />
                <rect x={bx} y={by} width={boxW} height={36} fill={NAVY} rx={4} />
                <rect x={bx} y={by + 18} width={boxW} height={18} fill={NAVY} />
                <text x={bx + 14} y={by + 24} fontSize="15" fontWeight="700" fill="#FFFFFF" fontFamily="Arial, sans-serif">
                  Grupo {groupLetter(gi)}
                </text>
                {g.map((t, ti) => (
                  <g key={t}>
                    <line x1={bx} y1={by + 36 + ti * 26} x2={bx + boxW} y2={by + 36 + ti * 26} stroke={BORDER} strokeWidth="1" />
                    <text x={bx + 14} y={by + 36 + ti * 26 + 18} fontSize="14" fill={NAVY_DARK} fontFamily="Arial, sans-serif">{t}</text>
                  </g>
                ))}
              </g>
            );
          })}

          <rect x={marginX} y={groupsTableHeaderY} width={contentWidth} height={30} fill={LIGHT} />
          <text x={marginX + 8} y={groupsTableHeaderY + 20} fontSize="13" fontWeight="700" fill={NAVY} fontFamily="Arial, sans-serif">GRUPO</text>
          <text x={marginX + 160} y={groupsTableHeaderY + 20} fontSize="13" fontWeight="700" fill={NAVY} fontFamily="Arial, sans-serif">PARTIDO</text>
          {SHOW_SCHEDULE_IN_POSTER && (
            <>
              <text x={marginX + contentWidth - 330} y={groupsTableHeaderY + 20} fontSize="13" fontWeight="700" fill={NAVY} fontFamily="Arial, sans-serif">DÍA</text>
              <text x={marginX + contentWidth - 220} y={groupsTableHeaderY + 20} fontSize="13" fontWeight="700" fill={NAVY} fontFamily="Arial, sans-serif">HORA</text>
              <text x={marginX + contentWidth - 110} y={groupsTableHeaderY + 20} fontSize="13" fontWeight="700" fill={NAVY} fontFamily="Arial, sans-serif">CANCHA</text>
            </>
          )}
          {sortedGroupMatches.map((m, i) => {
            const ry = groupsTableY + i * 28;
            return (
              <g key={m.id}>
                <line x1={marginX} y1={ry} x2={marginX + contentWidth} y2={ry} stroke={BORDER} strokeWidth="1" />
                <text x={marginX + 8} y={ry + 19} fontSize="13" fill={NAVY_DARK} fontFamily="Arial, sans-serif">{m.groupLabel}</text>
                <text x={marginX + 160} y={ry + 19} fontSize="13" fill={NAVY_DARK} fontFamily="Arial, sans-serif">{(m.teamA || "?") + " vs " + (m.teamB || "?")}</text>
                {SHOW_SCHEDULE_IN_POSTER && (
                  <>
                    <text x={marginX + contentWidth - 330} y={ry + 19} fontSize="13" fill={NAVY_DARK} fontFamily="Arial, sans-serif">{DAY_LABEL[m.day] || m.day || "—"}</text>
                    <text x={marginX + contentWidth - 220} y={ry + 19} fontSize="13" fill={NAVY_DARK} fontFamily="Arial, sans-serif">{m.time || "—"}</text>
                    <text x={marginX + contentWidth - 110} y={ry + 19} fontSize="13" fill={NAVY_DARK} fontFamily="Arial, sans-serif">{m.court || "—"}</text>
                  </>
                )}
              </g>
            );
          })}
        </g>
      )}

      {playoffY !== null && <BracketGroup matches={matches.playoffMatches} title="PLAYOFF" x={(width - playoffDim.width) / 2} y={playoffY} />}
      {drawY !== null && <BracketGroup matches={matches.drawMatches} title="LLAVE" x={(width - drawDim.width) / 2} y={drawY} />}

      {emptyMsgY && (
        <text x={width / 2} y={emptyMsgY} textAnchor="middle" fontSize="16" fill="#5A6B85" fontFamily="Arial, sans-serif">
          Esta categoría todavía no tiene sorteo cargado.
        </text>
      )}
    </svg>
  );
}
