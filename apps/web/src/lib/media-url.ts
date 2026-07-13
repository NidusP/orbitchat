import { API_BASE } from '@/lib/api/client';

/** Resolve relative `/api/v1/media/...` paths to absolute URLs for `<img src>`. */
export function resolveMediaUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('/')) {
    return `${API_BASE}${url}`;
  }

  return url;
}
