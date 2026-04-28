export function cornerColor(botId: string): string {
  let hash = 0;
  for (let i = 0; i < botId.length; i++) {
    hash = (hash << 5) - hash + botId.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % 8;
  return `var(--corner-${idx + 1})`;
}
