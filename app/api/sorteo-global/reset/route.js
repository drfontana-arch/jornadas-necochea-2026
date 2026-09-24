import { NextResponse } from "next/server";
import {
  categoriesInScope, countMatchesForCategories, resetSorteo,
  listAllMatches, getIndividualDisciplineBusyMatches, getRosterByMatchId, listRestrictions,
} from "../../../../lib/db";
import { computeConflicts, computeRestrictionViolations } from "../../../../lib/sorteoLogic";

export const dynamic = "force-dynamic";

// Interpreta el alcance elegido (una categoría / una disciplina / todo) a
// partir de query params (GET) o del body (POST).
function resolveScope(source) {
  const get = (k) => (source instanceof URLSearchParams ? source.get(k) : source[k]) || null;
  const scope = get("scope");
  if (scope === "categoria") {
    const categoryId = get("categoryId");
    if (!categoryId) throw new Error("Elegí la categoría a resetear.");
    return { disciplineId: null, categoryId };
  }
  if (scope === "disciplina") {
    const disciplineId = get("disciplineId");
    if (!disciplineId) throw new Error("Elegí la disciplina a resetear.");
    return { disciplineId, categoryId: null };
  }
  if (scope === "total") return { disciplineId: null, categoryId: null };
  throw new Error("Alcance inválido.");
}

// Vista previa: cuánto se va a borrar, y qué incompatibilidades horarias
// hay AHORA MISMO dentro de ese alcance -- para decidir si vale la pena
// resetear (y perder el fixture ya sorteado de esas categorías) o si
// conviene dejarlo así y resolver la incompatibilidad puntual a mano.
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const { disciplineId, categoryId } = resolveScope(searchParams);

    const cats = await categoriesInScope({ disciplineId, categoryId });
    const categoryIds = new Set(cats.map((c) => c.id));
    const matchesCount = await countMatchesForCategories([...categoryIds]);

    const allMatches = await listAllMatches();
    const individualBusy = await getIndividualDisciplineBusyMatches();
    const withIndividual = allMatches.concat(individualBusy);
    const rosterByMatchId = await getRosterByMatchId();
    const conflicts = computeConflicts(withIndividual, 10, rosterByMatchId).filter(
      (c) => categoryIds.has(c.m1.key) || categoryIds.has(c.m2.key)
    );
    const restrictions = await listRestrictions();
    const violations = computeRestrictionViolations(withIndividual, restrictions).filter((v) =>
      categoryIds.has(v.match.key)
    );

    return NextResponse.json({ categoriesCount: cats.length, matchesCount, conflicts, violations });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    const { disciplineId, categoryId } = resolveScope(body);
    const result = await resetSorteo({ disciplineId, categoryId });
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
