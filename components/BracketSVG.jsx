"use client";
import { bracketDimensions } from "../lib/bracketLayout";
import BracketGroup from "./BracketGroup";

export default function BracketSVG({ matches, title }) {
  const { width, height } = bracketDimensions(matches);
  if (width === 0) return null;
  return (
    <svg viewBox={"0 0 " + width + " " + height} width="100%" style={{ minWidth: width }} xmlns="http://www.w3.org/2000/svg">
      <BracketGroup matches={matches} title={title} x={0} y={0} />
    </svg>
  );
}
