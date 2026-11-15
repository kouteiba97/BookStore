/**
 * Which books to post next — pure, so it can be tested.
 *
 * Preference: books added in the last two weeks (new arrivals) first, then
 * books with a description (better captions), with some randomness so the
 * Page does not walk the catalogue in a predictable order. Two consecutive
 * posts avoid the same category when there is any alternative.
 */
export interface Candidate {
  id: string;
  categoryId: string;
  createdAt: Date;
  hasDescription: boolean;
}

const NEW_ARRIVAL_MS = 14 * 24 * 3_600_000;
const LOOKAHEAD = 12;

export function pickBooks(
  candidates: Candidate[],
  count: number,
  now: Date,
  random: () => number = Math.random,
  previousCategory: string | null = null,
): Candidate[] {
  const scored = candidates
    .map((c) => ({
      c,
      score:
        (now.getTime() - c.createdAt.getTime() < NEW_ARRIVAL_MS ? 3 : 0) +
        (c.hasDescription ? 2 : 0) +
        random() * 1.5,
    }))
    .sort((a, b) => b.score - a.score)
    .map((s) => s.c);

  const picked: Candidate[] = [];
  let lastCategory = previousCategory;
  while (picked.length < count && scored.length) {
    const window = Math.min(LOOKAHEAD, scored.length);
    let index = 0;
    for (let i = 0; i < window; i++) {
      if (scored[i].categoryId !== lastCategory) {
        index = i;
        break;
      }
    }
    const [next] = scored.splice(index, 1);
    picked.push(next);
    lastCategory = next.categoryId;
  }
  return picked;
}
