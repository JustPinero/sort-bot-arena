export type WeightClass =
  | 'HEAVYWEIGHT'
  | 'CRUISERWEIGHT'
  | 'MIDDLEWEIGHT'
  | 'LIGHTWEIGHT'
  | 'UNRANKED';

const MAPPING: Record<string, WeightClass> = {
  binary: 'HEAVYWEIGHT',
  go: 'CRUISERWEIGHT',
  golang: 'CRUISERWEIGHT',
  node: 'MIDDLEWEIGHT',
  nodejs: 'MIDDLEWEIGHT',
  javascript: 'MIDDLEWEIGHT',
  python: 'LIGHTWEIGHT',
  python3: 'LIGHTWEIGHT',
};

export function weightClass(language: string): WeightClass {
  return MAPPING[language.toLowerCase()] ?? 'UNRANKED';
}
