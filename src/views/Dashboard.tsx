import { useState } from 'react';
import { useAppState } from '../state/store';
import { DEFAULT_BRAND } from '../lib/defaults';
import { useEditor } from '../components/PublicationEditor';
import { Button, CampaignBadge, PageHeader, Progress } from '../components/ui';
import { Icon } from '../components/Icon';
import { PublicationCard, sortPublications } from '../components/PublicationViews';
import { href, navigate } from '../router';
import { addDays, formatLong, today } from '../lib/dates';
import { WORKSPACE_DESCRIPTIONS, WORKSPACE_LABELS } from '../lib/labels';
import { WORKSPACES } from '../lib/types';
import { isOverdue } from '../lib/workflow';

const WS_PATH = { strategy: 'strategie', social: 'reseaux', creative: 'creation', calendar: 'calendrier', seo: 'seo', analytics: 'analyses' } as const;
const WS_ICON = { strategy: 'target', social: 'social', creative: 'palette', calendar: 'calendar', seo: 'search', analytics: 'chart' } as const;

export function Dashboard() {
  const state = useAppState();
  const { newPublication } = useEditor();
  const t = today();
  const week = addDays(t, 7);
  const pubs = state.publications;
  const upcoming = sortPublications(pubs.filter((p) => p.scheduledDate && p.scheduledDate >= t && p.scheduledDate <= week && !['publie', 'archive'].includes(p.status)));
  const review = pubs.filter((p) => p.status === 'relecture');
  const corrections = pubs.filter((p) => p.status === 'corrections');
  const overdue = pubs.filter((p) => isOverdue(p, t));
  const publishedMonth = pubs.filter((p) => p.status === 'publie' && p.publishedAt?.slice(0, 7) === t.slice(0, 7));
  const active = state.campaigns.filter((c) => c.status === 'active' || c.status === 'planifiee');

  const onboarding = [
    { done: JSON.stringify(state.brand) !== JSON.stringify(DEFAULT_BRAND), label: 'Vérifier le profil de marque', path: 'marque' },
    { done: state.campaigns.length > 0, label: 'Créer une première campagne', path: 'campagnes' },
    { done: pubs.some((p) => p.source === 'claude'), label: 'Importer des publications rédigées avec Claude', path: 'claude' },
    { done: !!state.meta.lastBackupAt, label: 'Exporter une première sauvegarde', path: 'donnees' },
  ];
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('vitrine-marketing:onboarding-hidden') === '1';
    } catch {
      return false;
    }
  });
  const showOnboarding = !hidden && onboarding.some((o) => !o.done);
  const hideOnboarding = () => {
    setHidden(true);
    try {
      localStorage.setItem('vitrine-marketing:onboarding-hidden', '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow={formatLong(t)}
        title="Tableau de bord"
        description="Vue d’ensemble de votre marketing : ce qui sort cette semaine, ce qui attend votre validation et l’avancement des campagnes."
        actions={
          <>
            <Button icon="sparkles" onClick={() => navigate('claude')}>Atelier Claude</Button>
            <Button variant="primary" icon="plus" onClick={() => newPublication({ workspace: 'social' })}>Nouvelle publication</Button>
          </>
        }
      />

      <div className="stats">
        <a className="stat" href={href('validation')}>
          <span className="stat-value">{review.length}</span>
          <span className="stat-label">à valider</span>
        </a>
        <a className="stat" href={href('calendrier')}>
          <span className="stat-value">{upcoming.length}</span>
          <span className="stat-label">prévues sous 7 jours</span>
        </a>
        <a className={`stat${overdue.length ? ' stat-alert' : ''}`} href={href('publications')}>
          <span className="stat-value">{overdue.length}</span>
          <span className="stat-label">en retard</span>
        </a>
        <a className="stat" href={href('analyses')}>
          <span className="stat-value">{publishedMonth.length}</span>
          <span className="stat-label">publiées ce mois-ci</span>
        </a>
      </div>

      {showOnboarding && (
        <section className="panel">
          <div className="panel-head">
            <h2>Pour bien démarrer</h2>
            <button type="button" className="link" onClick={hideOnboarding}>Masquer</button>
          </div>
          <ol className="onboarding">
            {onboarding.map((o) => (
              <li key={o.label} className={o.done ? 'done' : ''}>
                <Icon name={o.done ? 'check' : 'right'} size={16} />
                <a href={href(o.path)}>{o.label}</a>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="two-col">
        <section className="panel">
          <div className="panel-head">
            <h2>Cette semaine</h2>
            <a className="link" href={href('calendrier')}>Calendrier</a>
          </div>
          {upcoming.length ? (
            <div className="stack-sm">{upcoming.slice(0, 6).map((p) => <PublicationCard key={p.id} pub={p} />)}</div>
          ) : (
            <p className="muted">Rien de planifié dans les 7 prochains jours.</p>
          )}
          {overdue.length > 0 && (
            <>
              <h3 className="danger">En retard</h3>
              <div className="stack-sm">{overdue.slice(0, 4).map((p) => <PublicationCard key={p.id} pub={p} />)}</div>
            </>
          )}
        </section>
        <section className="panel">
          <div className="panel-head">
            <h2>À valider</h2>
            <a className="link" href={href('validation')}>Circuit de validation</a>
          </div>
          {review.length || corrections.length ? (
            <div className="stack-sm">
              {[...review, ...corrections].slice(0, 6).map((p) => <PublicationCard key={p.id} pub={p} />)}
            </div>
          ) : (
            <p className="muted">Aucune publication en attente.</p>
          )}
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <h2>Campagnes en cours</h2>
          <a className="link" href={href('campagnes')}>Toutes les campagnes</a>
        </div>
        {active.length ? (
          <div className="campaign-mini-grid">
            {active.map((c) => {
              const list = pubs.filter((p) => p.campaignId === c.id && p.status !== 'archive');
              const done = list.filter((p) => p.status === 'publie').length;
              return (
                <a key={c.id} className="campaign-mini" href={href(`campagnes/${c.id}`)} style={{ borderTopColor: c.color }}>
                  <div className="row-between">
                    <strong>{c.name}</strong>
                    <CampaignBadge status={c.status} />
                  </div>
                  <span className="small muted">{done} / {list.length} publiées</span>
                  <Progress value={list.length ? done / list.length : 0} label={`Avancement de ${c.name}`} />
                </a>
              );
            })}
          </div>
        ) : (
          <p className="muted">Aucune campagne active. <a className="link" href={href('campagnes')}>Créer une campagne</a></p>
        )}
      </section>

      <h2 className="section-title">Espaces marketing</h2>
      <div className="workspace-grid">
        {WORKSPACES.map((w) => (
          <a key={w} className="workspace-card" href={href(WS_PATH[w])}>
            <Icon name={WS_ICON[w]} size={24} />
            <strong>{WORKSPACE_LABELS[w]}</strong>
            <span>{WORKSPACE_DESCRIPTIONS[w]}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
