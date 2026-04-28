import { formatDistanceToNowStrict } from 'date-fns';

export function fmtRecord(wins: number, losses: number, draws = 0): string {
  return `${wins}-${losses}-${draws}`;
}

export function fmtTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  if (seconds < 60) return `${seconds.toFixed(3)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds - minutes * 60;
  const padded = remainder.toFixed(3).padStart(6, '0');
  return `${minutes}:${padded}`;
}

export function fmtRelativeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return formatDistanceToNowStrict(d, { addSuffix: true });
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
