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
