import { useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, CopyButton, Empty, Field, Modal, PageHeader, Progress, Tabs, useUI } from '../components/ui';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { CHANNEL_LABELS, METRIC_LABELS, NOTE_KIND_LABELS, WORKSPACE_DESCRIPTIONS } from '../lib/labels';
import { CHANNELS, METRIC_KEYS, NOTE_KINDS, type Goal, type NoteKind, type StrategyNote } from '../lib/types';
import { addDays, formatDateTime, formatShort, today } from '../lib/dates';
import { formatNumber, goalProgress } from '../lib/metrics';
import { downloadFile, slug } from '../lib/download';
import { href } from '../router';

export function StrategyView() {
  const [tab, setTab] = useState<'docs' | 'goals' | 'claude'>('docs');
  const state = useAppState();
  return (
    <div className="page">
      <PageHeader eyebrow="Espace marketing" title="Stratégie" description={WORKSPACE_DESCRIPTIONS.strategy} />
      <Tabs
        label="Sections de la stratégie"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'docs', label: 'Documents', count: state.strategy.notes.length },
          { id: 'goals', label: 'Objectifs', count: state.strategy.goals.length },
          { id: 'claude', label: 'Avec Claude' },
        ]}
      />
      {tab === 'docs' && <Notes />}
      {tab === 'goals' && <Goals />}
      {tab === 'claude' && (
        <section className="panel">
          <ClaudeAssistant workspace="strategy" />
        </section>
      )}
    </div>
  );
}

function Notes() {
  const state = useAppState();
  const actions = useActions();
  const { confirm, toast } = useUI();
  const [kind, setKind] = useState<NoteKind | 'tous'>('tous');
  const [editing, setEditing] = useState<Partial<StrategyNote> | null>(null);
  const notes = state.strategy.notes.filter((n) => kind === 'tous' || n.kind === kind);

  return (
    <>
      <section className="panel brand-summary">
        <div>
          <div className="eyebrow">Positionnement actuel</div>
          <p className="lede">{state.brand.baseline}</p>
          <p className="small muted">{state.brand.audiences}</p>
        </div>
        <a className="btn btn-secondary btn-sm" href={href('marque')}>Modifier la marque</a>
      </section>
      <div className="toolbar">
        <select className="input input-inline" value={kind} onChange={(e) => setKind(e.target.value as NoteKind | 'tous')} aria-label="Type de document">
          <option value="tous">Tous les documents</option>
          {NOTE_KINDS.map((k) => <option key={k} value={k}>{NOTE_KIND_LABELS[k]}</option>)}
        </select>
        <Button variant="primary" icon="plus" onClick={() => setEditing({ kind: kind === 'tous' ? 'plan' : kind, title: '', content: '' })}>
          Nouveau document
        </Button>
      </div>
      {notes.length ? (
        <div className="note-grid">
          {notes.map((n) => (
            <article key={n.id} className="note-card">
              <span className="chip">{NOTE_KIND_LABELS[n.kind]}</span>
              <h3>{n.title}</h3>
              <p className="clamp-4">{n.content}</p>
              <div className="row-between">
                <span className="small muted">{formatDateTime(n.updatedAt)}</span>
                <div className="inline-actions">
                  <Button small variant="ghost" icon="edit" aria-label={`Modifier ${n.title}`} onClick={() => setEditing(n)} />
                  <Button small variant="ghost" icon="download" aria-label={`Exporter ${n.title}`} onClick={() => downloadFile(`${slug(n.title)}.md`, `# ${n.title}\n\n${n.content}\n`, 'text/markdown;charset=utf-8')} />
                  <Button
                    small
                    variant="ghost"
                    icon="trash"
                    aria-label={`Supprimer ${n.title}`}
                    onClick={async () => {
                      if (await confirm({ title: 'Supprimer le document', message: `« ${n.title} » sera supprimé.`, danger: true, confirmLabel: 'Supprimer' })) {
                        actions.deleteNote(n.id);
                        toast('Document supprimé');
                      }
                    }}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Aucun document stratégique" icon="target">
          Rédigez un positionnement, des personas ou un plan, ou faites-les préparer par Claude dans l’onglet « Avec Claude ».
        </Empty>
      )}
      {editing && (
        <Modal
          title={editing.id ? 'Modifier le document' : 'Nouveau document'}
          open
          wide
          onClose={() => setEditing(null)}
          footer={
            <>
              {editing.content && <CopyButton text={editing.content} />}
              <Button onClick={() => setEditing(null)}>Annuler</Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (!editing.title?.trim()) return toast('Donnez un titre au document.', 'error');
                  actions.saveNote({ ...editing, title: editing.title.trim(), kind: editing.kind ?? 'autre', content: editing.content ?? '' });
                  toast('Document enregistré');
                  setEditing(null);
                }}
              >
                Enregistrer
              </Button>
            </>
          }
        >
          <div className="stack">
            <div className="row2">
              <Field label="Titre">
                <input className="input" value={editing.title ?? ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} autoFocus />
              </Field>
              <Field label="Type">
                <select className="input" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as NoteKind })}>
                  {NOTE_KINDS.map((k) => <option key={k} value={k}>{NOTE_KIND_LABELS[k]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Contenu (Markdown accepté)">
              <textarea className="input" rows={16} value={editing.content ?? ''} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
    </>
  );
}

function Goals() {
  const state = useAppState();
  const actions = useActions();
  const { toast, confirm } = useUI();
  const blank = (): Omit<Goal, 'id'> & { id?: string } => ({
    label: '',
    metric: 'enquiries',
    target: 10,
    startDate: today(),
    endDate: addDays(today(), 30),
    channel: 'tous',
    campaignId: null,
  });
  const [editing, setEditing] = useState<(Omit<Goal, 'id'> & { id?: string }) | null>(null);

  return (
    <>
      <div className="toolbar">
        <p className="small muted">La progression se calcule à partir des statistiques saisies dans « Analyses ».</p>
        <Button variant="primary" icon="plus" onClick={() => setEditing(blank())}>Nouvel objectif</Button>
      </div>
      {state.strategy.goals.length ? (
        <div className="goal-list">
          {state.strategy.goals.map((g) => {
            const { current, ratio } = goalProgress(g, state.performance);
            const campaign = state.campaigns.find((c) => c.id === g.campaignId);
            return (
              <article key={g.id} className="goal">
                <div className="row-between">
                  <strong>{g.label || METRIC_LABELS[g.metric]}</strong>
                  <div className="inline-actions">
                    <Button small variant="ghost" icon="edit" aria-label="Modifier l’objectif" onClick={() => setEditing(g)} />
                    <Button
                      small
                      variant="ghost"
                      icon="trash"
                      aria-label="Supprimer l’objectif"
                      onClick={async () => {
                        if (await confirm({ title: 'Supprimer l’objectif', message: 'Cet objectif sera supprimé.', danger: true, confirmLabel: 'Supprimer' })) actions.deleteGoal(g.id);
                      }}
                    />
                  </div>
                </div>
                <span className="small muted">
                  {METRIC_LABELS[g.metric]} · {g.channel === 'tous' ? 'tous canaux' : CHANNEL_LABELS[g.channel]} · {formatShort(g.startDate)} → {formatShort(g.endDate)}
                  {campaign && ` · ${campaign.name}`}
                </span>
                <Progress value={ratio} label={g.label} />
                <span className="small">
                  <strong>{formatNumber(current)}</strong> / {formatNumber(g.target)} ({Math.round(ratio * 100)} %)
                </span>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty title="Aucun objectif" icon="target">Fixez des objectifs mesurables : demandes de contact, clics, abonnés…</Empty>
      )}
      {editing && (
        <Modal
          title={editing.id ? 'Modifier l’objectif' : 'Nouvel objectif'}
          open
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Annuler</Button>
              <Button
                variant="primary"
                onClick={() => {
                  if (editing.endDate < editing.startDate) return toast('La date de fin précède la date de début.', 'error');
                  if (!(editing.target > 0)) return toast('La cible doit être supérieure à zéro.', 'error');
                  actions.saveGoal(editing);
                  toast('Objectif enregistré');
                  setEditing(null);
                }}
              >
                Enregistrer
              </Button>
            </>
          }
        >
          <div className="stack">
            <Field label="Intitulé">
              <input className="input" value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Ex. 10 demandes de devis en décembre" />
            </Field>
            <div className="row2">
              <Field label="Indicateur">
                <select className="input" value={editing.metric} onChange={(e) => setEditing({ ...editing, metric: e.target.value as Goal['metric'] })}>
                  {METRIC_KEYS.map((k) => <option key={k} value={k}>{METRIC_LABELS[k]}</option>)}
                </select>
              </Field>
              <Field label="Cible">
                <input className="input" type="number" min={1} value={editing.target} onChange={(e) => setEditing({ ...editing, target: Number(e.target.value) })} />
              </Field>
            </div>
            <div className="row2">
              <Field label="Début">
                <input className="input" type="date" value={editing.startDate} onChange={(e) => setEditing({ ...editing, startDate: e.target.value })} />
              </Field>
              <Field label="Fin">
                <input className="input" type="date" value={editing.endDate} onChange={(e) => setEditing({ ...editing, endDate: e.target.value })} />
              </Field>
            </div>
            <div className="row2">
              <Field label="Canal">
                <select className="input" value={editing.channel} onChange={(e) => setEditing({ ...editing, channel: e.target.value as Goal['channel'] })}>
                  <option value="tous">Tous</option>
                  {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </select>
              </Field>
              <Field label="Campagne">
                <select className="input" value={editing.campaignId ?? ''} onChange={(e) => setEditing({ ...editing, campaignId: e.target.value || null })}>
                  <option value="">Toutes</option>
                  {state.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
