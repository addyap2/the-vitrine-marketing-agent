import { useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { useEditor } from '../components/PublicationEditor';
import { Button, ChannelTag, Empty, PageHeader, StatusBadge, Tabs, useUI } from '../components/ui';
import { Icon } from '../components/Icon';
import { FORMAT_LABELS } from '../lib/labels';
import { checkPublication, composeForPosting } from '../lib/qa';
import { WorkflowError } from '../lib/workflow';
import { formatShort } from '../lib/dates';
import type { Publication } from '../lib/types';

function ReviewCard({ pub }: { pub: Publication }) {
  const state = useAppState();
  const actions = useActions();
  const { openPublication } = useEditor();
  const { toast } = useUI();
  const [comment, setComment] = useState('');
  const [asking, setAsking] = useState(false);
  const qa = checkPublication(pub);
  const campaign = state.campaigns.find((c) => c.id === pub.campaignId);
  const lastCorrection = [...pub.history].reverse().find((h) => h.to === 'corrections' && h.comment);

  const act = (to: 'approuve' | 'corrections' | 'relecture') => {
    try {
      actions.transition(pub.id, to, { comment: to === 'corrections' ? comment : undefined });
      toast(to === 'approuve' ? 'Publication approuvée' : to === 'corrections' ? 'Corrections demandées' : 'Renvoyée en relecture');
      setAsking(false);
      setComment('');
    } catch (e) {
      toast(e instanceof WorkflowError ? e.message : 'Action impossible', 'error');
    }
  };

  return (
    <article className="review-card">
      <header className="row-between wrap">
        <div className="inline-actions wrap">
          <ChannelTag channel={pub.channel} />
          <span className="small muted">{FORMAT_LABELS[pub.format]}</span>
          <StatusBadge status={pub.status} />
          {campaign && <span className="small muted">· {campaign.name}</span>}
        </div>
        <span className="small muted">{pub.scheduledDate ? `Prévue le ${formatShort(pub.scheduledDate)}${pub.scheduledTime ? ` à ${pub.scheduledTime}` : ''}` : 'Non planifiée'}</span>
      </header>
      <h3>{pub.title}</h3>
      <div className="preview">{composeForPosting(pub) || <span className="muted">Pas de texte.</span>}</div>
      {pub.visualBrief && (
        <details>
          <summary className="small">Brief visuel</summary>
          <div className="preview small">{pub.visualBrief}</div>
        </details>
      )}
      {lastCorrection && pub.status === 'corrections' && (
        <p className="small warn">
          <Icon name="alert" size={14} /> Corrections demandées : {lastCorrection.comment}
        </p>
      )}
      <div className="qa-inline">
        {qa.errors + qa.warnings === 0 ? (
          <span className="ok small"><Icon name="check" size={14} /> Contrôle qualité sans remarque</span>
        ) : (
          qa.checks
            .filter((c) => c.level !== 'ok')
            .map((c) => (
              <span key={c.label} className={`small ${c.level === 'error' ? 'danger' : 'warn'}`} title={c.detail}>
                <Icon name={c.level === 'error' ? 'x' : 'alert'} size={13} /> {c.label}
              </span>
            ))
        )}
      </div>
      {asking && (
        <div className="inline-form">
          <input className="input" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Ce qu’il faut corriger…" aria-label="Corrections demandées" autoFocus />
          <Button variant="danger" onClick={() => act('corrections')} disabled={!comment.trim()}>Envoyer</Button>
        </div>
      )}
      <footer className="inline-actions wrap">
        {pub.status === 'relecture' ? (
          <>
            <Button variant="primary" icon="check" onClick={() => act('approuve')} disabled={qa.errors > 0} title={qa.errors > 0 ? 'Corrigez les erreurs bloquantes avant d’approuver' : undefined}>
              Approuver
            </Button>
            <Button onClick={() => setAsking((v) => !v)}>Demander des corrections</Button>
          </>
        ) : (
          <Button variant="primary" onClick={() => act('relecture')}>Renvoyer en relecture</Button>
        )}
        <Button variant="ghost" icon="edit" onClick={() => openPublication(pub.id)}>Ouvrir</Button>
      </footer>
    </article>
  );
}

export function ApprovalView() {
  const state = useAppState();
  const [tab, setTab] = useState<'relecture' | 'corrections' | 'approuve'>('relecture');
  const { openPublication } = useEditor();
  const by = (s: Publication['status']) => state.publications.filter((p) => p.status === s).sort((a, b) => (a.scheduledDate ?? '9').localeCompare(b.scheduledDate ?? '9'));
  const review = by('relecture');
  const corrections = by('corrections');
  const approved = [...by('approuve'), ...by('programme')];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Pilotage"
        title="Validation"
        description="Rien ne part sans relecture humaine : brouillon → relecture → approuvé → programmé → publié. Modifier un texte approuvé le renvoie en relecture."
      />
      <Tabs
        label="Étapes de validation"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'relecture', label: 'À relire', count: review.length },
          { id: 'corrections', label: 'À corriger', count: corrections.length },
          { id: 'approuve', label: 'Approuvées', count: approved.length },
        ]}
      />
      {tab === 'relecture' &&
        (review.length ? <div className="review-list">{review.map((p) => <ReviewCard key={p.id} pub={p} />)}</div> : <Empty title="Rien à relire" icon="approve">Les publications envoyées en relecture apparaîtront ici.</Empty>)}
      {tab === 'corrections' &&
        (corrections.length ? <div className="review-list">{corrections.map((p) => <ReviewCard key={p.id} pub={p} />)}</div> : <Empty title="Aucune correction en attente" icon="check" />)}
      {tab === 'approuve' &&
        (approved.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Publication</th><th>Canal</th><th>Statut</th><th>Date</th></tr>
              </thead>
              <tbody>
                {approved.map((p) => (
                  <tr key={p.id} className="clickable" onClick={() => openPublication(p.id)}>
                    <td><button type="button" className="link" onClick={() => openPublication(p.id)}>{p.title}</button></td>
                    <td><ChannelTag channel={p.channel} /></td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>{p.scheduledDate ? formatShort(p.scheduledDate) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Aucune publication approuvée" icon="approve" />
        ))}
    </div>
  );
}
