import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useActions, useAppState, useStoreApi, makePublication, type NewPublication } from '../state/store';
import { Button, CopyButton, Field, Modal, StatusBadge, useUI } from './ui';
import { Icon } from './Icon';
import { CHANNEL_LABELS, FORMAT_LABELS, STATUS_LABELS, WORKSPACE_LABELS } from '../lib/labels';
import { CHANNELS, FORMATS, WORKSPACES, type Publication, type PubStatus } from '../lib/types';
import { checkPublication, composeForPosting } from '../lib/qa';
import { TRANSITIONS, WorkflowError, type Transition } from '../lib/workflow';
import { buildRevisionPrompt, CLAUDE_URL } from '../lib/prompts';
import { parseRevision } from '../lib/parseResponse';
import { formatDateTime, today } from '../lib/dates';
import { downloadFile, slug } from '../lib/download';

interface EditorCtx {
  openPublication: (id: string) => void;
  newPublication: (defaults?: Partial<NewPublication>) => void;
}

const Ctx = createContext<EditorCtx | null>(null);

export function useEditor(): EditorCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('EditorProvider manquant');
  return ctx;
}

export function EditorProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<{ id: string } | { draft: Publication } | null>(null);
  const openPublication = useCallback((id: string) => setTarget({ id }), []);
  const newPublication = useCallback(
    (defaults: Partial<NewPublication> = {}) => setTarget({ draft: makePublication({ title: '', ...defaults }) }),
    [],
  );
  const value = useMemo(() => ({ openPublication, newPublication }), [openPublication, newPublication]);
  return (
    <Ctx.Provider value={value}>
      {children}
      {target && (
        <PublicationEditor
          key={'id' in target ? target.id : target.draft.id}
          id={'id' in target ? target.id : null}
          initialDraft={'draft' in target ? target.draft : null}
          onClose={() => setTarget(null)}
          onCreated={(id) => setTarget({ id })}
        />
      )}
    </Ctx.Provider>
  );
}

function PublicationEditor({
  id,
  initialDraft,
  onClose,
  onCreated,
}: {
  id: string | null;
  initialDraft: Publication | null;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const state = useAppState();
  const actions = useActions();
  const storeApi = useStoreApi();
  const { confirm, toast } = useUI();
  const stored = id ? state.publications.find((p) => p.id === id) : null;
  const [draft, setDraft] = useState<Publication | null>(stored ?? initialDraft);
  const [pending, setPending] = useState<Transition | null>(null);
  const [pendingComment, setPendingComment] = useState('');
  const [pendingDate, setPendingDate] = useState('');
  const [pendingTime, setPendingTime] = useState('');
  const [pendingUrl, setPendingUrl] = useState('');
  const [note, setNote] = useState('');
  const [tab, setTab] = useState<'qa' | 'claude' | 'history'>('qa');
  const [instruction, setInstruction] = useState('');
  const [revision, setRevision] = useState('');

  const isNew = !id;
  const dirty = useMemo(() => {
    if (!draft) return false;
    if (isNew) return !!(draft.title || draft.body || draft.hook);
    return JSON.stringify(draft) !== JSON.stringify(stored);
  }, [draft, stored, isNew]);

  const qa = useMemo(() => (draft ? checkPublication(draft) : null), [draft]);

  if (!draft) {
    return (
      <Modal title="Publication introuvable" open onClose={onClose}>
        <p>Cette publication a été supprimée.</p>
      </Modal>
    );
  }

  const set = <K extends keyof Publication>(k: K, v: Publication[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  const save = (): string | null => {
    if (!draft.title.trim()) {
      toast('Donnez un titre à la publication.', 'error');
      return null;
    }
    if (isNew) {
      const { id: _i, createdAt: _c, updatedAt: _u, history: _h, versions: _v, ...rest } = draft;
      const newId = actions.addPublication(rest);
      toast('Publication créée');
      onCreated(newId);
      return newId;
    }
    if (stored && dirty) {
      const wasApproved = stored.status === 'approuve' || stored.status === 'programme';
      actions.savePublication(draft);
      if (wasApproved && (draft.body !== stored.body || draft.hook !== stored.hook || draft.cta !== stored.cta || draft.hashtags !== stored.hashtags)) {
        toast('Texte modifié après approbation : la publication repasse en relecture.', 'info');
      } else toast('Modifications enregistrées');
      refresh(draft.id);
    }
    return draft.id;
  };

  const refresh = (pid: string) => {
    // Store updates are synchronous: read back the stored version after an action.
    const next = storeApi.getState().publications.find((p) => p.id === pid);
    if (next) setDraft(next);
  };

  const startTransition = (t: Transition) => {
    setPending(t);
    setPendingComment('');
    setPendingDate(draft.scheduledDate ?? '');
    setPendingTime(draft.scheduledTime ?? '');
    setPendingUrl(draft.publishedUrl);
    if (!t.needsComment && !t.needsDate && t.to !== 'publie') runTransition(t);
  };

  const runTransition = (t: Transition) => {
    const pid = save();
    if (!pid || isNew) return;
    try {
      actions.transition(pid, t.to, {
        comment: t.needsComment ? pendingComment : undefined,
        ...(t.needsDate || t.to === 'programme' ? { scheduledDate: pendingDate || null, scheduledTime: pendingTime || null } : {}),
        ...(t.to === 'publie' ? { publishedUrl: pendingUrl, publishedAt: pendingDate || undefined } : {}),
      });
      toast(`Statut : ${STATUS_LABELS[t.to]}`);
      setPending(null);
      refresh(pid);
    } catch (e) {
      toast(e instanceof WorkflowError ? e.message : 'Action impossible.', 'error');
    }
  };

  const close = async () => {
    if (dirty && !(await confirm({ title: 'Modifications non enregistrées', message: 'Fermer sans enregistrer ?', confirmLabel: 'Fermer sans enregistrer', danger: true }))) return;
    onClose();
  };

  const remove = async () => {
    if (isNew) return onClose();
    if (await confirm({ title: 'Supprimer la publication', message: `« ${draft.title} » sera supprimée définitivement de ce navigateur.`, confirmLabel: 'Supprimer', danger: true })) {
      actions.deletePublication(draft.id);
      toast('Publication supprimée');
      onClose();
    }
  };

  const applyRevision = () => {
    const parsed = parseRevision(revision);
    if (!parsed) {
      toast('Aucun bloc JSON reconnu. Collez toute la réponse de Claude.', 'error');
      return;
    }
    setDraft({ ...draft, ...parsed });
    setRevision('');
    toast('Proposition appliquée : relisez puis enregistrez (l’ancienne version est conservée).', 'info');
  };

  const campaigns = state.campaigns;
  const transitions = isNew ? [] : TRANSITIONS[stored?.status ?? draft.status];
  const posting = composeForPosting(draft);

  return (
    <Modal
      title={isNew ? 'Nouvelle publication' : draft.title || 'Publication'}
      open
      wide
      onClose={close}
      footer={
        <>
          {!isNew && <Button variant="ghost" icon="trash" onClick={remove} className="mr-auto">Supprimer</Button>}
          {!isNew && (
            <Button
              variant="ghost"
              icon="duplicate"
              onClick={() => {
                const nid = actions.duplicatePublication(draft.id);
                if (nid) {
                  toast('Copie créée');
                  onCreated(nid);
                }
              }}
            >
              Dupliquer
            </Button>
          )}
          <Button
            variant="ghost"
            icon="download"
            onClick={() => downloadFile(`${slug(draft.title)}.txt`, `${draft.title}\n${CHANNEL_LABELS[draft.channel]} · ${FORMAT_LABELS[draft.format]}\n\n${posting}\n\n--- Brief visuel ---\n${draft.visualBrief}\n\n--- Notes ---\n${draft.notes}\n`, 'text/plain;charset=utf-8')}
          >
            .txt
          </Button>
          <Button onClick={close}>Fermer</Button>
          <Button variant="primary" icon="check" onClick={() => save()} disabled={!dirty && !isNew}>
            {isNew ? 'Créer' : 'Enregistrer'}
          </Button>
        </>
      }
    >
      <div className="editor">
        <div className="editor-form">
          <Field label="Titre interne">
            <input className="input" value={draft.title} onChange={(e) => set('title', e.target.value)} placeholder="Ex. Carrousel — 5 erreurs qui font fuir les visiteurs" maxLength={500} autoFocus={isNew} />
          </Field>
          <div className="row3">
            <Field label="Espace">
              <select className="input" value={draft.workspace} onChange={(e) => set('workspace', e.target.value as Publication['workspace'])}>
                {WORKSPACES.map((w) => <option key={w} value={w}>{WORKSPACE_LABELS[w]}</option>)}
              </select>
            </Field>
            <Field label="Canal">
              <select className="input" value={draft.channel} onChange={(e) => set('channel', e.target.value as Publication['channel'])}>
                {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
              </select>
            </Field>
            <Field label="Format">
              <select className="input" value={draft.format} onChange={(e) => set('format', e.target.value as Publication['format'])}>
                {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
              </select>
            </Field>
          </div>
          <div className="row3">
            <Field label="Campagne">
              <select className="input" value={draft.campaignId ?? ''} onChange={(e) => set('campaignId', e.target.value || null)}>
                <option value="">Aucune</option>
                {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Date prévue">
              <input className="input" type="date" value={draft.scheduledDate ?? ''} onChange={(e) => set('scheduledDate', e.target.value || null)} />
            </Field>
            <Field label="Heure">
              <input className="input" type="time" value={draft.scheduledTime ?? ''} onChange={(e) => set('scheduledTime', e.target.value || null)} />
            </Field>
          </div>
          <Field label="Accroche (première ligne)" hint={`${[...draft.hook].length} caractères${draft.channel === 'instagram' ? ' · Instagram affiche environ 125 caractères avant « plus »' : ''}`}>
            <input className="input" value={draft.hook} onChange={(e) => set('hook', e.target.value)} maxLength={5000} />
          </Field>
          <Field label="Texte" hint={qa ? `${qa.characters} caractères au total · ${qa.words} mots` : undefined}>
            <textarea className="input" rows={9} value={draft.body} onChange={(e) => set('body', e.target.value)} maxLength={100000} />
          </Field>
          <Field label="Appel à l’action">
            <input className="input" value={draft.cta} onChange={(e) => set('cta', e.target.value)} placeholder={state.brand.defaultCta} maxLength={5000} />
          </Field>
          <Field
            label="Hashtags"
            hint={
              state.brand.hashtagSets.length > 0 && (
                <span className="inline-actions">
                  Ajouter :{' '}
                  {state.brand.hashtagSets.map((h) => (
                    <button key={h.name} type="button" className="link" onClick={() => set('hashtags', [draft.hashtags.trim(), h.tags].filter(Boolean).join(' '))}>
                      {h.name}
                    </button>
                  ))}
                </span>
              )
            }
          >
            <input className="input" value={draft.hashtags} onChange={(e) => set('hashtags', e.target.value)} maxLength={5000} />
          </Field>
          <Field label="Brief visuel / prompt image ou vidéo">
            <textarea className="input" rows={4} value={draft.visualBrief} onChange={(e) => set('visualBrief', e.target.value)} />
          </Field>
          <Field label="Notes internes">
            <textarea className="input" rows={3} value={draft.notes} onChange={(e) => set('notes', e.target.value)} />
          </Field>
          {(draft.status === 'publie' || draft.publishedUrl) && (
            <div className="row2">
              <Field label="Lien de la publication en ligne">
                <input className="input" type="url" value={draft.publishedUrl} onChange={(e) => set('publishedUrl', e.target.value)} placeholder="https://…" />
              </Field>
              <Field label="Publié le">
                <input className="input" type="date" value={draft.publishedAt ?? ''} onChange={(e) => set('publishedAt', e.target.value || null)} />
              </Field>
            </div>
          )}
        </div>

        <aside className="editor-side">
          <section className="side-card">
            <div className="side-status">
              <StatusBadge status={stored?.status ?? draft.status} />
              {dirty && <span className="muted small">Modifications non enregistrées</span>}
            </div>
            {isNew ? (
              <p className="small muted">Créez la publication pour accéder au circuit de validation.</p>
            ) : (
              <div className="transition-list">
                {transitions.map((t) => (
                  <Button key={t.to} small variant={t.tone === 'primary' ? 'primary' : t.tone === 'danger' ? 'danger' : 'secondary'} onClick={() => startTransition(t)}>
                    {t.label}
                  </Button>
                ))}
              </div>
            )}
            {pending && (
              <div className="pending-form">
                {pending.needsComment && (
                  <Field label="Corrections demandées">
                    <textarea className="input" rows={3} value={pendingComment} onChange={(e) => setPendingComment(e.target.value)} autoFocus />
                  </Field>
                )}
                {(pending.needsDate || pending.to === 'publie') && (
                  <div className="row2">
                    <Field label={pending.to === 'publie' ? 'Publié le' : 'Date'}>
                      <input className="input" type="date" value={pendingDate || (pending.to === 'publie' ? today() : '')} onChange={(e) => setPendingDate(e.target.value)} />
                    </Field>
                    {pending.needsDate && (
                      <Field label="Heure">
                        <input className="input" type="time" value={pendingTime} onChange={(e) => setPendingTime(e.target.value)} />
                      </Field>
                    )}
                  </div>
                )}
                {pending.to === 'publie' && (
                  <>
                    <Field label="Lien de la publication (facultatif)">
                      <input className="input" type="url" value={pendingUrl} onChange={(e) => setPendingUrl(e.target.value)} placeholder="https://…" />
                    </Field>
                    <p className="small muted">Confirmez seulement après avoir publié vous-même sur le réseau : l’application ne publie rien automatiquement.</p>
                  </>
                )}
                {pending.needsDate && <p className="small muted">« Programmé » place la publication au calendrier. Pour une mise en ligne automatique, programmez-la aussi dans Meta Business Suite ou l’outil du réseau.</p>}
                <div className="inline-actions">
                  <Button small onClick={() => setPending(null)}>Annuler</Button>
                  <Button small variant="primary" onClick={() => runTransition(pending)}>{pending.label}</Button>
                </div>
              </div>
            )}
          </section>

          <section className="side-card">
            <div className="side-title">
              <strong>Texte prêt à publier</strong>
              <CopyButton text={posting} small label="Copier" variant="primary" />
            </div>
            <div className="preview" aria-label="Aperçu du texte">
              {posting || <span className="muted">Le texte apparaîtra ici.</span>}
            </div>
          </section>

          <div className="tabs tabs-sm" role="tablist" aria-label="Outils de la publication">
            {(
              [
                ['qa', `Contrôle${qa && qa.errors + qa.warnings ? ` (${qa.errors + qa.warnings})` : ''}`],
                ['claude', 'Améliorer avec Claude'],
                ['history', 'Historique'],
              ] as const
            ).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                {l}
              </button>
            ))}
          </div>

          {tab === 'qa' && qa && (
            <ul className="checklist">
              {qa.checks.map((c) => (
                <li key={c.label} className={`check-${c.level}`}>
                  <Icon name={c.level === 'ok' ? 'check' : c.level === 'error' ? 'x' : 'alert'} size={15} />
                  <div>
                    <strong>{c.label}</strong>
                    {c.detail && <span>{c.detail}</span>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {tab === 'claude' && (
            <div className="side-card stack">
              <Field label="1. Ce que Claude doit améliorer">
                <textarea className="input" rows={2} value={instruction} onChange={(e) => setInstruction(e.target.value)} placeholder="Ex. Plus court, accroche plus forte, ton plus chaleureux" />
              </Field>
              <div className="inline-actions">
                <CopyButton small text={buildRevisionPrompt(state.brand, draft, instruction)} label="2. Copier le prompt" variant="primary" />
                <a className="btn btn-secondary btn-sm" href={CLAUDE_URL} target="_blank" rel="noopener noreferrer">
                  <Icon name="external" size={15} /> <span>Ouvrir Claude</span>
                </a>
              </div>
              <Field label="3. Collez la réponse complète de Claude">
                <textarea className="input" rows={4} value={revision} onChange={(e) => setRevision(e.target.value)} />
              </Field>
              <Button small variant="primary" onClick={applyRevision} disabled={!revision.trim()}>
                4. Appliquer la proposition
              </Button>
            </div>
          )}

          {tab === 'history' && (
            <div className="side-card stack">
              {!isNew && (
                <div className="inline-form">
                  <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ajouter un commentaire" aria-label="Commentaire" />
                  <Button
                    small
                    onClick={() => {
                      actions.comment(draft.id, note);
                      setNote('');
                      refresh(draft.id);
                    }}
                    disabled={!note.trim()}
                  >
                    Ajouter
                  </Button>
                </div>
              )}
              <ol className="history">
                {[...(stored ?? draft).history].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="muted small">{formatDateTime(h.at)}</span>
                    <span>
                      {h.action === 'statut' && h.to ? (
                        <>
                          {h.from ? `${STATUS_LABELS[h.from as PubStatus]} → ` : ''}
                          <strong>{STATUS_LABELS[h.to]}</strong>
                        </>
                      ) : h.action === 'creation' ? (
                        'Création'
                      ) : h.action === 'modification' ? (
                        'Texte modifié'
                      ) : (
                        'Commentaire'
                      )}
                      {h.comment && <em> — {h.comment}</em>}
                    </span>
                  </li>
                ))}
              </ol>
              {draft.versions.length > 0 && (
                <>
                  <strong className="small">Versions précédentes</strong>
                  <ul className="versions">
                    {draft.versions.map((v, i) => (
                      <li key={i}>
                        <span className="small">{formatDateTime(v.at)}</span>
                        <span className="muted small clamp">{v.hook || v.body.slice(0, 80)}</span>
                        <Button small variant="ghost" icon="history" onClick={() => setDraft({ ...draft, hook: v.hook, body: v.body, cta: v.cta, hashtags: v.hashtags })}>
                          Restaurer
                        </Button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </Modal>
  );
}
