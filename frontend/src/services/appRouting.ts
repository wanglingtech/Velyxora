import { getToolById } from '../registry/tools';

export type AppRoute = { view: string; param?: string; authMode?: 'login' | 'register' };
const PATH_TO_VIEW: Record<string, AppRoute> = {
  '/': { view: 'home' },
  '/login': { view: 'auth', authMode: 'login' },
  '/register': { view: 'auth', authMode: 'register' },
  '/account': { view: 'account' },
  '/admin': { view: 'admin' },
  '/history': { view: 'history' },
  '/favorites': { view: 'favorites' },
  '/settings': { view: 'settings' },
  '/media-downloader': { view: 'media-downloader' },
  '/complaints': { view: 'complaints' },
  '/suggestions': { view: 'suggestions' },
  '/support': { view: 'support' },
  '/about': { view: 'about' },
  '/privacy': { view: 'privacy' },
  '/terms': { view: 'terms' },
};

export function routeFromPath(pathname: string): AppRoute {
  const normalized = pathname !== '/' ? pathname.replace(/\/+$/, '') : '/';
  if (PATH_TO_VIEW[normalized]) return PATH_TO_VIEW[normalized];
  const short = normalized.match(/^\/s\/([A-Za-z0-9_-]{6,16})$/);
  if (short) return { view: 'short-link', param: short[1] };
  const tool = normalized.match(/^\/tools\/([a-z0-9-]+)$/);
  if (tool) return { view: 'tool', param: tool[1] };
  const category = normalized.match(/^\/category\/([a-z0-9-]+)$/);
  if (category) return { view: 'category', param: category[1] };
  return { view: 'not-found' };
}

export function pathForView(view: string, param?: string): string {
  if (view === 'tool' && param) return `/tools/${encodeURIComponent(param)}`;
  if (view === 'category' && param) return `/category/${encodeURIComponent(param)}`;
  const entry = Object.entries(PATH_TO_VIEW).find(([, route]) => route.view === view && route.authMode !== 'register');
  return entry?.[0] || '/';
}

/**
 * Validates a return destination after authentication. Only same-application
 * absolute paths that resolve to a real view are accepted, which prevents open
 * redirects. Query/fragment are stripped and invalid values return null so the
 * caller can fall back to a safe existing route.
 */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 300) return null;
  // Absolute internal path only: reject schemes, protocol-relative and
  // backslash/control-character tricks browsers may normalize to '//host'.
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return null;
  if (trimmed.includes('\\')) return null;
  for (const char of trimmed) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return null;
  }
  const path = trimmed.split('#')[0].split('?')[0];
  const route = routeFromPath(path);
  if (route.view === 'not-found' || route.view === 'auth') return null;
  if (route.view === 'tool' && (!route.param || !getToolById(route.param))) return null;
  return path;
}
