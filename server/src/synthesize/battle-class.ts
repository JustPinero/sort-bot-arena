// Slice 5 — derive a battle's weight class label from the input
// size_classes of the inputs the user picked.
//
// Mapping from sort-bot-api `size_class` to a numeric rank:
//   small  = 1
//   medium = 2
//   large  = 3
//
// The label is the arithmetic mean of those ranks rounded to nearest
// integer:
//   1 → 'sparring'
//   2 → 'exhibition'
//   3 → 'title_fight'
//
// If the caller can't supply size_classes (e.g. the battle was started
// with `count: N` and the upstream API picks the inputs after the fact),
// pass an empty array and we return null.

export type WeightClass = 'sparring' | 'exhibition' | 'title_fight';
export type SizeClass = 'small' | 'medium' | 'large';

const RANK: Record<SizeClass, number> = {
  small: 1,
  medium: 2,
  large: 3,
};

const LABELS: Record<1 | 2 | 3, WeightClass> = {
  1: 'sparring',
  2: 'exhibition',
  3: 'title_fight',
};

export function weightClassFor(sizeClasses: ReadonlyArray<SizeClass>): WeightClass | null {
  if (sizeClasses.length === 0) return null;
  const sum = sizeClasses.reduce((acc, sc) => acc + RANK[sc], 0);
  const mean = sum / sizeClasses.length;
  const rounded = Math.round(mean) as 1 | 2 | 3;
  return LABELS[rounded] ?? null;
}
