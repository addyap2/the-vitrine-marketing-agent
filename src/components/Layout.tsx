import { useEffect, useState, type ReactNode } from 'react';
import { NAV, href, navigate } from '../router';
import { Icon } from './Icon';
import { Button } from './ui';
import { useAppState, useStoreStatus } from '../state/store';
import { diffDays, today } from '../lib/dates';

const GROUPS: { id: string; label: string | null }[] = [
  { id: 'main', label: null },
  { id: 'workspaces', label: 'Espaces marketing' },
  { id: 'manage', label: 'Pilotage' },
  { id: 'tools', label: 'Outils' },
];

function Brand() {
  return (
    <a className="brand" href={href('')} aria-label="The Vitrine Marketing — accueil">
      <span className="brand-mark" aria-hidden="true">V</span>
      <span>
        <span className="brand-name">The Vitrine</span>
        <span className="brand-sub">Marketing</span>
      </span>
    </a>
  );
}

export function Layout({ route, children, notice }: { route: string; children: ReactNode; notice: string | null }) {
  const state = useAppState();
  const { saveError } = useStoreStatus();
  const [drawer, setDrawer] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const reviewCount = state.publications.filter((p) => p.status === 'relecture').length;

  useEffect(() => setDrawer(false), [route]);
  useEffect(() => {
    document.body.classList.toggle('no-scroll', drawer);
  }, [drawer]);

  const backupDue =
    state.meta.lastChangeAt &&
    (!state.meta.lastBackupAt || state.meta.lastChangeAt > state.meta.lastBackupAt) &&
    (!state.meta.lastBackupAt || diffDays(state.meta.lastBackupAt.slice(0, 10), today()) >= 7) &&
    state.publications.length + state.campaigns.length > 0;

  const nav = (
    <nav className="nav" aria-label="Navigation principale">
      {GROUPS.map((g) => (
        <div key={g.id} className="nav-group">
          {g.label && <div className="nav-label">{g.label}</div>}
          {NAV.filter((n) => n.group === g.id).map((n) => {
            const active = n.path === '' ? route === '' : route === n.path || route.startsWith(`${n.path}/`);
            return (
              <a key={n.path} href={href(n.path)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
                <Icon name={n.icon} />
                <span>{n.label}</span>
                {n.path === 'validation' && reviewCount > 0 && <span className="nav-count" aria-label={`${reviewCount} en attente`}>{reviewCount}</span>}
              </a>
            );
          })}
        </div>
      ))}
    </nav>
  );

  return (
    <div className="shell">
      <a className="skip" href="#contenu">Aller au contenu</a>
      <aside className="sidebar">
        <Brand />
        {nav}
        <p className="sidebar-foot">Données stockées dans ce navigateur. Aucune publication automatique.</p>
      </aside>

      <header className="topbar">
        <Brand />
        <Button variant="ghost" icon="menu" aria-label="Ouvrir le menu" aria-expanded={drawer} onClick={() => setDrawer(true)} />
      </header>

      {drawer && (
        <div className="drawer-backdrop" onClick={() => setDrawer(false)}>
          <aside className="drawer" onClick={(e) => e.stopPropagation()} aria-label="Menu">
            <div className="drawer-head">
              <Brand />
              <Button variant="ghost" icon="x" aria-label="Fermer le menu" onClick={() => setDrawer(false)} />
            </div>
            {nav}
          </aside>
        </div>
      )}

      <main className="main" id="contenu" tabIndex={-1}>
        {saveError && (
          <div className="banner banner-error" role="alert">
            <Icon name="alert" />
            <span>{saveError}</span>
            <Button small onClick={() => navigate('donnees')}>Exporter une sauvegarde</Button>
          </div>
        )}
        {notice && dismissed !== notice && (
          <div className="banner banner-info" role="status">
            <Icon name="info" />
            <span>{notice}</span>
            <Button small variant="ghost" icon="x" aria-label="Masquer" onClick={() => setDismissed(notice)} />
          </div>
        )}
        {backupDue && route !== 'donnees' && dismissed !== 'backup' && (
          <div className="banner banner-warn" role="status">
            <Icon name="database" />
            <span>
              {state.meta.lastBackupAt ? 'Votre dernière sauvegarde date de plus de 7 jours.' : 'Vous n’avez pas encore exporté de sauvegarde.'} Les données ne vivent que dans ce navigateur.
            </span>
            <Button small onClick={() => navigate('donnees')}>Sauvegarder</Button>
            <Button small variant="ghost" icon="x" aria-label="Plus tard" onClick={() => setDismissed('backup')} />
          </div>
        )}
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Navigation rapide">
        {[
          { path: '', label: 'Accueil', icon: 'home' },
          { path: 'reseaux', label: 'Réseaux', icon: 'social' },
          { path: 'calendrier', label: 'Calendrier', icon: 'calendar' },
          { path: 'validation', label: 'Validation', icon: 'approve' },
        ].map((n) => {
          const active = n.path === '' ? route === '' : route.startsWith(n.path);
          return (
            <a key={n.path} href={href(n.path)} className={active ? 'active' : ''} aria-current={active ? 'page' : undefined}>
              <span className="bn-icon">
                <Icon name={n.icon} size={20} />
                {n.path === 'validation' && reviewCount > 0 && <span className="dot" />}
              </span>
              <span>{n.label}</span>
            </a>
          );
        })}
        <button type="button" onClick={() => setDrawer(true)}>
          <span className="bn-icon"><Icon name="more" size={20} /></span>
          <span>Plus</span>
        </button>
      </nav>
    </div>
  );
}
