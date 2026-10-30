import { useSyncExternalStore } from 'react';

const NAV_EVENT = 'sevasetu:navigate';

export function navigate(path: string) {
  if (window.location.pathname + window.location.search + window.location.hash === path) return;
  window.history.pushState({}, '', path);
  window.dispatchEvent(new Event(NAV_EVENT));
  if (!path.includes('#')) window.scrollTo({ top: 0, behavior: 'auto' });
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback);
  window.addEventListener(NAV_EVENT, callback);
  return () => {
    window.removeEventListener('popstate', callback);
    window.removeEventListener(NAV_EVENT, callback);
  };
}

export function useLocation(): { pathname: string; hash: string } {
  const href = useSyncExternalStore(
    subscribe,
    () => window.location.pathname + window.location.hash,
    () => '/'
  );
  const hashIndex = href.indexOf('#');
  return hashIndex === -1
    ? { pathname: href, hash: '' }
    : { pathname: href.slice(0, hashIndex), hash: href.slice(hashIndex) };
}
