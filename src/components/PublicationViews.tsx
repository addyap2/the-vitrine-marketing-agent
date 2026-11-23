import { useMemo, useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { useEditor } from './PublicationEditor';
import { Button, ChannelTag, Empty, StatusBadge, useUI } from './ui';
import { Icon } from './Icon';
import { CHANNEL_LABELS, FORMAT_LABELS, STATUS_LABELS } from '../lib/labels';
import { CHANNELS, PUB_STATUSES, type Channel, type Publication, type PubStatus, type WorkspaceId } from '../lib/types';
import { BOARD_COLUMNS, canTransition, isOverdue, WorkflowError } from '../lib/workflow';
import { formatShort } from '../lib/dates';

export interface PubFilter {
  q: string;
  status: PubStatus | 'tous' | 'actifs';
  channel: Channel | 'tous';
  campaignId: string | 'tous';
}

export const DEFAULT_FILTER: PubFilter = { q: '', status: 'actifs', channel: 'tous', campaignId: 'tous' };

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function filterPublications(pubs: Publication[], f: PubFilter): Publication[] {
  const q = norm(f.q.trim());
  return pubs.filter(
    (p) =>
      (f.status === 'tous' || (f.status === 'actifs' ? p.status !== 'archive' : p.status === f.status)) &&
      (f.channel === 'tous' || p.channel === f.channel) &&
      (f.campaignId === 'tous' || (f.campaignId === 'aucune' ? !p.campaignId : p.campaignId === f.campaignId)) &&
      (!q || norm([p.title, p.hook, p.body, p.cta, p.hashtags, p.notes, p.visualBrief].join(' ')).includes(q)),
  );
}

export function sortPublications(pubs: Publication[]): Publication[] {
  return [...pubs].sort((a, b) => {
    const da = a.scheduledDate ?? '9999';
    const db = b.scheduledDate ?? '9999';
    return da === db ? b.updatedAt.localeCompare(a.updatedAt) : da.localeCompare(db);
  });
}

export function FilterBar({ value, onChange, hideStatus }: { value: PubFilter; onChange: (f: PubFilter) => void; hideStatus?: boolean }) {
  const { campaigns } = useAppState();
  return (
    <div className="filters" role="search">
      <div className="search-input">
        <Icon name="search" size={16} />
        <input className="input" type="search" placeholder="Rechercher…" value={value.q} onChange={(e) => onChange({ ...value, q: e.target.value })} aria-label="Rechercher dans les publications" />
      </div>
      {!hideStatus && (
        <select className="input" value={value.status} onChange={(e) => onChange({ ...value, status: e.target.value as PubFilter['status'] })} aria-label="Filtrer par statut">
          <option value="actifs">Tous sauf archivés</option>
          <option value="tous">Tous les statuts</option>
          {PUB_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      )}
      <select className="input" value={value.channel} onChange={(e) => onChange({ ...value, channel: e.target.value as PubFilter['channel'] })} aria-label="Filtrer par canal">
        <option value="tous">Tous les canaux</option>
        {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
      </select>
      <select className="input" value={value.campaignId} onChange={(e) => onChange({ ...value, campaignId: e.target.value })} aria-label="Filtrer par campagne">
        <option value="tous">Toutes les campagnes</option>
        <option value="aucune">Sans campagne</option>
        {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
    </div>
  );
}

export function PublicationCard({ pub, compact }: { pub: Publication; compact?: boolean }) {
  const { campaigns } = useAppState();
  const { openPublication } = useEditor();
  const campaign = campaigns.find((c) => c.id === pub.campaignId);
  const overdue = isOverdue(pub);
  return (
    <button type="button" className={`pub-card${overdue ? ' overdue' : ''}`} onClick={() => openPublication(pub.id)} style={campaign ? { borderLeftColor: campaign.color } : undefined}>
      <div className="pub-card-top">
        <ChannelTag channel={pub.channel} />
        <span className="muted small">{FORMAT_LABELS[pub.format]}</span>
        {!compact && <StatusBadge status={pub.status} />}
      </div>
      <strong className="pub-title">{pub.title}</strong>
      {!compact && (pub.hook || pub.body) && <span className="pub-excerpt">{pub.hook || pub.body}</span>}
      <div className="pub-meta">
        {pub.scheduledDate ? (
          <span className={overdue ? 'danger' : ''}>
            <Icon name="clock" size={13} /> {formatShort(pub.scheduledDate)}
            {pub.scheduledTime && ` · ${pub.scheduledTime}`}
            {overdue && ' · en retard'}
          </span>
        ) : (
          <span className="muted">Non planifiée</span>
        )}
        {campaign && <span className="muted clamp">{campaign.name}</span>}
        {pub.source === 'claude' && <span className="muted" title="Créée depuis une réponse de Claude"><Icon name="sparkles" size={13} /></span>}
      </div>
    </button>
  );
}

export function PublicationList({ pubs, empty }: { pubs: Publication[]; empty?: React.ReactNode }) {
  if (!pubs.length) return <>{empty ?? <Empty title="Aucune publication" icon="list">Ajustez les filtres ou créez une publication.</Empty>}</>;
  return (
    <div className="pub-grid">
      {sortPublications(pubs).map((p) => (
        <PublicationCard key={p.id} pub={p} />
      ))}
    </div>
  );
}

/** Kanban board by status; cards can be dragged to an allowed next status (desktop) or opened to change status. */
export function PublicationBoard({ pubs }: { pubs: Publication[] }) {
  const actions = useActions();
  const { toast } = useUI();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<PubStatus | null>(null);
  const byStatus = useMemo(() => {
    const m = new Map<PubStatus, Publication[]>(BOARD_COLUMNS.map((s) => [s, []]));
    for (const p of sortPublications(pubs)) m.get(p.status)?.push(p);
    return m;
  }, [pubs]);
  const dragged = pubs.find((p) => p.id === dragId);

  const drop = (to: PubStatus) => {
    setOver(null);
    if (!dragged || dragged.status === to) return;
    if (!canTransition(dragged.status, to)) {
      toast(`Impossible de passer directement de « ${STATUS_LABELS[dragged.status]} » à « ${STATUS_LABELS[to]} ». Ouvrez la publication.`, 'error');
      return;
    }
    if (to === 'corrections' || to === 'programme' || to === 'publie') {
      toast('Ouvrez la publication pour compléter cette étape (commentaire, date ou lien).', 'info');
      return;
    }
    try {
      actions.transition(dragged.id, to);
      toast(`Statut : ${STATUS_LABELS[to]}`);
    } catch (e) {
      toast(e instanceof WorkflowError ? e.message : 'Action impossible', 'error');
    }
  };

  return (
    <div className="board" aria-label="Tableau par statut">
      {BOARD_COLUMNS.map((s) => (
        <section
          key={s}
          className={`board-col${over === s ? ' drop-over' : ''}${dragged && canTransition(dragged.status, s) ? ' drop-ok' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(s);
          }}
          onDragLeave={() => setOver(null)}
          onDrop={() => drop(s)}
          aria-label={STATUS_LABELS[s]}
        >
          <header>
            <StatusBadge status={s} />
            <span className="muted small">{byStatus.get(s)?.length}</span>
          </header>
          <div className="board-cards">
            {byStatus.get(s)?.map((p) => (
              <div key={p.id} draggable onDragStart={() => setDragId(p.id)} onDragEnd={() => setDragId(null)}>
                <PublicationCard pub={p} compact />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function NewPublicationButton({ workspace, label = 'Nouvelle publication', defaults }: { workspace: WorkspaceId; label?: string; defaults?: Partial<Publication> }) {
  const { newPublication } = useEditor();
  return (
    <Button variant="primary" icon="plus" onClick={() => newPublication({ workspace, ...defaults })}>
      {label}
    </Button>
  );
}
