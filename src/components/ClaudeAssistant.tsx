import { useMemo, useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, CopyButton, Field, useUI } from './ui';
import { Icon } from './Icon';
import { buildClaudePrompt, CLAUDE_URL } from '../lib/prompts';
import { extractPlaceholders, placeholderLabel } from '../lib/templates';
import { parseDocument, parseKeywords, parsePublications, type ParsedKeyword, type ParsedPublication } from '../lib/parseResponse';
import { CHANNEL_LABELS, FORMAT_LABELS, INTENT_LABELS, NOTE_KIND_LABELS, WORKSPACE_LABELS } from '../lib/labels';
import { NOTE_KINDS, type NoteKind, type WorkspaceId } from '../lib/types';
import { formatShort } from '../lib/dates';

const LONG_FIELDS = /contenu|données|texte|éléments|observations|contexte|temps_forts|concurrents/i;

export function ClaudeAssistant({
  workspace,
  defaultTemplateId,
  presetValues = {},
  compact,
  defaultCampaignId = '',
}: {
  workspace?: WorkspaceId;
  defaultTemplateId?: string;
  presetValues?: Record<string, string>;
  compact?: boolean;
  defaultCampaignId?: string;
}) {
  const state = useAppState();
  const actions = useActions();
  const { toast } = useUI();
  const templates = state.templates.filter((t) => t.kind === 'prompt' && (!workspace || t.workspace === workspace));
  const [templateId, setTemplateId] = useState(defaultTemplateId ?? templates[0]?.id ?? '');
  const template = templates.find((t) => t.id === templateId) ?? templates[0];
  const [values, setValues] = useState<Record<string, string>>(presetValues);
  const [campaignId, setCampaignId] = useState(defaultCampaignId);
  const [extra, setExtra] = useState('');
  const [response, setResponse] = useState('');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pubs, setPubs] = useState<ParsedPublication[] | null>(null);
  const [keywords, setKeywords] = useState<ParsedKeyword[] | null>(null);
  const [doc, setDoc] = useState<{ title: string; content: string } | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importCampaign, setImportCampaign] = useState('');
  const [importStatus, setImportStatus] = useState<'brouillon' | 'idee'>('brouillon');
  const [noteKind, setNoteKind] = useState<NoteKind>('plan');

  const campaign = state.campaigns.find((c) => c.id === campaignId) ?? null;
  const fields = useMemo(() => (template ? extractPlaceholders(template.body) : []), [template]);
  const prompt = useMemo(
    () => (template ? buildClaudePrompt({ brand: state.brand, template, values: { ...values, ...(campaign ? { campagne: values.campagne || campaign.name } : {}) }, campaign, extra }) : ''),
    [template, values, campaign, extra, state.brand],
  );

  if (!template) {
    return <p className="muted">Aucun modèle de prompt pour cet espace. Créez-en un dans « Modèles ».</p>;
  }

  const resetResult = () => {
    setPubs(null);
    setKeywords(null);
    setDoc(null);
    setWarnings([]);
  };

  const analyse = () => {
    resetResult();
    const id = actions.saveSession({ id: sessionId ?? undefined, workspace: template.workspace, templateId: template.id, title: template.name, prompt, response, importedCount: 0 });
    setSessionId(id);
    if (template.output === 'publications') {
      const r = parsePublications(response);
      setPubs(r.items);
      setWarnings(r.warnings);
      setSelected(new Set(r.items.map((_, i) => i)));
      setImportCampaign(campaignId);
    } else if (template.output === 'mots-cles') {
      const r = parseKeywords(response);
      setKeywords(r.items);
      setWarnings(r.warnings);
      setSelected(new Set(r.items.map((_, i) => i)));
    } else {
      setDoc(parseDocument(response));
    }
  };

  const markImported = (n: number) => {
    if (sessionId) actions.saveSession({ id: sessionId, workspace: template.workspace, templateId: template.id, title: template.name, prompt, response, importedCount: n });
  };

  const importPubs = () => {
    if (!pubs) return;
    const chosen = pubs.filter((_, i) => selected.has(i));
    actions.addPublications(
      chosen.map((p) => ({
        ...p,
        workspace: template.workspace === 'strategy' || template.workspace === 'analytics' ? 'social' : template.workspace,
        campaignId: importCampaign || null,
        status: importStatus,
        source: 'claude' as const,
      })),
    );
    markImported(chosen.length);
    toast(`${chosen.length} publication${chosen.length > 1 ? 's' : ''} importée${chosen.length > 1 ? 's' : ''} en ${importStatus === 'idee' ? 'idée' : 'brouillon'}`);
    setPubs(null);
    setResponse('');
    setStep(1);
  };

  const importKeywords = () => {
    if (!keywords) return;
    const chosen = keywords.filter((_, i) => selected.has(i));
    actions.addKeywords(chosen);
    markImported(chosen.length);
    toast(`${chosen.length} mot${chosen.length > 1 ? 's' : ''}-clé${chosen.length > 1 ? 's' : ''} ajouté${chosen.length > 1 ? 's' : ''} au suivi SEO (doublons ignorés)`);
    setKeywords(null);
    setResponse('');
    setStep(1);
  };

  const saveDocAsNote = () => {
    if (!doc) return;
    actions.saveNote({ title: doc.title, kind: noteKind, content: doc.content });
    markImported(1);
    toast('Document enregistré dans Stratégie');
    setDoc(null);
    setResponse('');
    setStep(1);
  };

  const saveAsPublication = (title: string, body: string) => {
    actions.addPublication({
      title,
      body,
      workspace: template.workspace,
      channel: template.channel ?? 'instagram',
      format: template.format ?? (template.output === 'document' ? 'document' : 'post'),
      campaignId: campaignId || null,
      source: 'claude',
    });
    markImported(1);
    toast('Réponse enregistrée comme publication (brouillon)');
    resetResult();
    setResponse('');
    setStep(1);
  };

  const toggle = (i: number) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });

  return (
    <div className={`assistant${compact ? ' assistant-compact' : ''}`}>
      <ol className="steps" aria-label="Étapes">
        {(['Préparer', 'Copier dans Claude', 'Coller la réponse'] as const).map((l, i) => (
          <li key={l} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}>
            <button type="button" onClick={() => setStep((i + 1) as 1 | 2 | 3)}>
              <span className="step-n">{step > i + 1 ? <Icon name="check" size={13} /> : i + 1}</span>
              {l}
            </button>
          </li>
        ))}
      </ol>

      {step === 1 && (
        <div className="stack">
          <div className="row2">
            <Field label="Modèle de prompt">
              <select
                className="input"
                value={template.id}
                onChange={(e) => {
                  setTemplateId(e.target.value);
                  resetResult();
                }}
              >
                {(workspace ? [workspace] : (['strategy', 'social', 'creative', 'calendar', 'seo', 'analytics'] as WorkspaceId[])).map((w) => (
                  <optgroup key={w} label={WORKSPACE_LABELS[w]}>
                    {templates
                      .filter((t) => t.workspace === w)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </Field>
            <Field label="Campagne (contexte facultatif)">
              <select className="input" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}>
                <option value="">Aucune</option>
                {state.campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {template.description && <p className="small muted">{template.description}</p>}
          <div className="fields-grid">
            {fields.map((f) => (
              <Field key={f} label={placeholderLabel(f)} className={LONG_FIELDS.test(f) ? 'span-2' : ''}>
                {LONG_FIELDS.test(f) ? (
                  <textarea className="input" rows={4} value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
                ) : (
                  <input className="input" value={values[f] ?? ''} onChange={(e) => setValues({ ...values, [f]: e.target.value })} />
                )}
              </Field>
            ))}
          </div>
          <Field label="Précisions supplémentaires (facultatif)">
            <textarea className="input" rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Ex. éviter le mot « digital », mentionner la rentrée…" />
          </Field>
          <div className="inline-actions">
            <Button variant="primary" icon="right" onClick={() => setStep(2)}>
              Préparer le prompt
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack">
          <p className="small">
            Copiez ce prompt, collez-le dans une conversation <strong>claude.ai</strong> (votre abonnement Pro suffit, aucune clé API), puis copiez toute la réponse de Claude avec son bouton « Copier ».
          </p>
          <textarea className="input mono" rows={compact ? 8 : 12} readOnly value={prompt} aria-label="Prompt pour Claude" onFocus={(e) => e.currentTarget.select()} />
          <div className="inline-actions">
            <CopyButton text={prompt} label="Copier le prompt" variant="primary" />
            <a className="btn btn-secondary" href={CLAUDE_URL} target="_blank" rel="noopener noreferrer">
              <Icon name="external" size={17} /> <span>Ouvrir Claude</span>
            </a>
            <Button icon="right" onClick={() => setStep(3)}>
              J’ai la réponse
            </Button>
          </div>
          <p className="small muted">{[...prompt].length.toLocaleString('fr-FR')} caractères. Rien n’est envoyé par cette application : c’est vous qui collez le texte.</p>
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <Field label="Réponse de Claude">
            <textarea
              className="input"
              rows={compact ? 8 : 10}
              value={response}
              onChange={(e) => {
                setResponse(e.target.value);
                resetResult();
              }}
              placeholder="Collez ici la réponse complète, bloc JSON compris."
            />
          </Field>
          <div className="inline-actions">
            <Button variant="primary" icon="sparkles" onClick={analyse} disabled={!response.trim()}>
              Analyser la réponse
            </Button>
          </div>

          {warnings.length > 0 && (
            <ul className="warnings">
              {warnings.map((w, i) => (
                <li key={i}>
                  <Icon name="alert" size={14} /> {w}
                </li>
              ))}
            </ul>
          )}

          {pubs && pubs.length > 0 && (
            <div className="import-box">
              <div className="import-head">
                <strong>
                  {pubs.length} contenu{pubs.length > 1 ? 's' : ''} détecté{pubs.length > 1 ? 's' : ''}
                </strong>
                <button type="button" className="link" onClick={() => setSelected(selected.size === pubs.length ? new Set() : new Set(pubs.map((_, i) => i)))}>
                  {selected.size === pubs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </button>
              </div>
              <ul className="import-list">
                {pubs.map((p, i) => (
                  <li key={i}>
                    <label>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                      <span>
                        <strong>{p.title}</strong>
                        <span className="muted small">
                          {CHANNEL_LABELS[p.channel]} · {FORMAT_LABELS[p.format]}
                          {p.scheduledDate && ` · ${formatShort(p.scheduledDate)}${p.scheduledTime ? ` ${p.scheduledTime}` : ''}`}
                        </span>
                        <span className="small clamp">{p.hook || p.body}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="row2">
                <Field label="Rattacher à la campagne">
                  <select className="input" value={importCampaign} onChange={(e) => setImportCampaign(e.target.value)}>
                    <option value="">Aucune</option>
                    {state.campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Statut à l’import">
                  <select className="input" value={importStatus} onChange={(e) => setImportStatus(e.target.value as 'brouillon' | 'idee')}>
                    <option value="brouillon">Brouillon</option>
                    <option value="idee">Idée</option>
                  </select>
                </Field>
              </div>
              <Button variant="primary" icon="download" onClick={importPubs} disabled={!selected.size}>
                Importer {selected.size} publication{selected.size > 1 ? 's' : ''}
              </Button>
            </div>
          )}

          {pubs && pubs.length === 0 && (
            <div className="import-box">
              <p className="small">Le format attendu n’a pas été reconnu. Vous pouvez demander à Claude : « Redonne uniquement le bloc JSON demandé », ou enregistrer la réponse telle quelle.</p>
              <Button onClick={() => saveAsPublication(template.name, response)}>Enregistrer la réponse comme une publication</Button>
            </div>
          )}

          {keywords && keywords.length > 0 && (
            <div className="import-box">
              <strong>{keywords.length} mots-clés détectés</strong>
              <ul className="import-list">
                {keywords.map((k, i) => (
                  <li key={i}>
                    <label>
                      <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} />
                      <span>
                        <strong>{k.keyword}</strong>
                        <span className="muted small">
                          {INTENT_LABELS[k.intent]} · priorité {k.priority} {k.targetUrl && `· ${k.targetUrl}`}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <Button variant="primary" onClick={importKeywords} disabled={!selected.size}>
                Ajouter {selected.size} mot{selected.size > 1 ? 's' : ''}-clé{selected.size > 1 ? 's' : ''} au suivi
              </Button>
            </div>
          )}

          {doc && (
            <div className="import-box">
              <Field label="Titre du document">
                <input className="input" value={doc.title} onChange={(e) => setDoc({ ...doc, title: e.target.value })} />
              </Field>
              <div className="doc-preview">{doc.content.slice(0, 1200)}{doc.content.length > 1200 && '…'}</div>
              <div className="inline-actions wrap">
                <select className="input input-inline" value={noteKind} onChange={(e) => setNoteKind(e.target.value as NoteKind)} aria-label="Type de document">
                  {NOTE_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {NOTE_KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <Button variant="primary" onClick={saveDocAsNote}>
                  Enregistrer dans Stratégie
                </Button>
                <Button onClick={() => saveAsPublication(doc.title, doc.content)}>Enregistrer comme publication</Button>
                <CopyButton text={doc.content} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
