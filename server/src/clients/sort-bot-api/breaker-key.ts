const ID_SEGMENT = /^[A-Za-z]+_[A-Za-z0-9_-]+$|^[0-9]+$|^[A-Fa-f0-9-]{16,}$/;

export function breakerKeyFor(method: string, path: string): string {
  const cleanPath = path.split('?')[0] ?? path;
  const segments = cleanPath.split('/').map((seg) => (ID_SEGMENT.test(seg) ? ':id' : seg));
  return `${method.toUpperCase()} ${segments.join('/')}`;
}
