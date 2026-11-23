import { useSyncExternalStore } from 'react';

/** Hash routing: works on any static host without server rewrites. */

function current(): string {
  return decodeURIComponent(window.location.hash.replace(/^#\/?/, '')).replace(/\/$/, '');
}

function subscribe(fn: () => void) {
  window.addEventListener('hashchange', fn);
  return () => window.removeEventListener('hashchange', fn);
}

export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, current, () => '');
  return path ? path.split('/') : [];
}

export function navigate(path: string) {
  const target = `#/${path.replace(/^\/+/, '')}`;
  if (window.location.hash !== target) window.location.hash = target;
  window.scrollTo?.({ top: 0 });
}

export function href(path: string) {
  return `#/${path.replace(/^\/+/, '')}`;
}

export const NAV = [
  { path: '', label: 'Tableau de bord', icon: 'home', group: 'main' },
  { path: 'strategie', label: 'Stratégie', icon: 'target', group: 'workspaces' },
  { path: 'reseaux', label: 'Réseaux sociaux', icon: 'social', group: 'workspaces' },
  { path: 'creation', label: 'Création', icon: 'palette', group: 'workspaces' },
  { path: 'calendrier', label: 'Calendrier', icon: 'calendar', group: 'workspaces' },
  { path: 'seo', label: 'SEO & GEO', icon: 'search', group: 'workspaces' },
  { path: 'analyses', label: 'Analyses', icon: 'chart', group: 'workspaces' },
  { path: 'campagnes', label: 'Campagnes', icon: 'megaphone', group: 'manage' },
  { path: 'publications', label: 'Publications', icon: 'list', group: 'manage' },
  { path: 'validation', label: 'Validation', icon: 'approve', group: 'manage' },
  { path: 'modeles', label: 'Modèles', icon: 'template', group: 'manage' },
  { path: 'claude', label: 'Atelier Claude', icon: 'sparkles', group: 'tools' },
  { path: 'marque', label: 'Marque', icon: 'settings', group: 'tools' },
  { path: 'donnees', label: 'Données & sauvegardes', icon: 'database', group: 'tools' },
] as const;
