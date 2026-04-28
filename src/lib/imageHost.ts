import { config } from '@/api/config';

const ALLOWED_HOSTS = (() => {
  try {
    return new Set([new URL(config.apiBaseUrl).host, 'cdn.leonardo.ai']);
  } catch {
    return new Set<string>();
  }
})();

export function isAllowedImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    return ALLOWED_HOSTS.has(new URL(url).host);
  } catch {
    return false;
  }
}
