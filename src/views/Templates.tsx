import { useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, Empty, Field, Modal, PageHeader, Tabs, useUI } from '../components/ui';
import { CHANNEL_LABELS, FORMAT_LABELS, WORKSPACE_LABELS } from '../lib/labels';
import { BUILTIN_CONTENT, BUILTIN_PROMPTS } from '../lib/defaults';
import { BRAND_PLACEHOLDERS, extractPlaceholders } from '../lib/templates';
import { CHANNELS, FORMATS, WORKSPACES, type PromptOutput, type Template, type TemplateKind } from '../lib/types';

const OUTPUT_LABELS: Record<PromptOutput, string> = {
  publications: 'Publications importables (JSON)',
  document: 'Document stratégique (Markdown)',
  'mots-cles': 'Mots-clés importables (JSON)',
  texte: 'Texte libre',
};

type Draft = Partial<Template> & Pick<Template, 'name' | 'kind' | 'workspace' | 'body'>;

export function TemplatesView() {
  const state = useAppState();
  const actions = useActions();
  const { confirm, toast } = useUI();
  const [kind, setKind] = useState<TemplateKind>('prompt');
  const [editing, setEditing] = useState<Draft | null>(null);
  const list = state.templates.filter((t) => t.kind === kind);
  const builtins = kind === 'prompt' ? BUILTIN_PROMPTS : BUILTIN_CONTENT;

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim() || !editing.body.trim()) return toast('Nom et contenu obligatoires.', 'error');
    actions.saveTemplate({ ...editing, name: editing.name.trim() });
    toast('Modèle enregistré');
    setEditing(null);
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="Pilotage"
        title="Modèles réutilisables"
        description="Prompts Claude et squelettes de contenu. Utilisez {{nom_du_champ}} pour créer des champs à remplir ; {{marque}}, {{site}}, {{cta}} et {{zone}} sont complétés automatiquement depuis le profil de marque."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setEditing({ name: '', kind, workspace: 'social', body: '', output: kind === 'prompt' ? 'publications' : 'texte', channel: null, format: null, description: '' })}>
            Nouveau modèle
          </Button>
        }
      />
      <Tabs
        label="Type de modèle"
        value={kind}
        onChange={setKind}
        items={[
          { id: 'prompt', label: 'Prompts Claude', count: state.templates.filter((t) => t.kind === 'prompt').length },
          { id: 'contenu', label: 'Modèles de contenu', count: state.templates.filter((t) => t.kind === 'contenu').length },
        ]}
      />
      {list.length ? (
        <div className="template-grid">
          {list.map((t) => (
            <article key={t.id} className="template-card">
              <div className="row-between">
                <span className="chip">{WORKSPACE_LABELS[t.workspace]}</span>
                {t.builtin && <span className="small muted">Fourni</span>}
              </div>
              <h3>{t.name}</h3>
              <p className="small muted clamp-2">{t.description}</p>
              <div className="small">
                {t.kind === 'prompt' ? OUTPUT_LABELS[t.output] : `${t.channel ? CHANNEL_LABELS[t.channel] : 'Tous canaux'} · ${t.format ? FORMAT_LABELS[t.format] : 'Libre'}`}
              </div>
              <div className="small muted">Champs : {extractPlaceholders(t.body).join(', ') || 'aucun'}</div>
              <div className="inline-actions">
                <Button small icon="edit" onClick={() => setEditing(t)}>Modifier</Button>
                <Button
                  small
                  variant="ghost"
                  icon="duplicate"
                  onClick={() => {
                    const { id: _id, builtin: _b, createdAt: _c, updatedAt: _u, ...rest } = t;
                    actions.saveTemplate({ ...rest, name: `${t.name} (copie)` });
                    toast('Copie créée');
                  }}
                >
                  Dupliquer
                </Button>
                {t.builtin && JSON.stringify(builtins.find((b) => b.id === t.id)?.body) !== JSON.stringify(t.body) && (
                  <Button
                    small
                    variant="ghost"
                    icon="history"
                    onClick={() => {
                      const orig = builtins.find((b) => b.id === t.id);
                      if (orig) {
                        actions.saveTemplate({ ...orig });
                        toast('Modèle d’origine restauré');
                      }
                    }}
                  >
                    Rétablir
                  </Button>
                )}
                <Button
                  small
                  variant="ghost"
                  icon="trash"
                  aria-label={`Supprimer ${t.name}`}
                  onClick={async () => {
                    if (await confirm({ title: 'Supprimer le modèle', message: t.builtin ? `« ${t.name} » est un modèle fourni : il reviendra au prochain import de sauvegarde ou rechargement.` : `« ${t.name} » sera supprimé.`, danger: true, confirmLabel: 'Supprimer' })) {
                      actions.deleteTemplate(t.id);
                      toast('Modèle supprimé');
                    }
                  }}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Aucun modèle" icon="template" />
      )}

      {editing && (
        <Modal title={editing.id ? 'Modifier le modèle' : 'Nouveau modèle'} open wide onClose={() => setEditing(null)} footer={<><Button onClick={() => setEditing(null)}>Annuler</Button><Button variant="primary" onClick={save}>Enregistrer</Button></>}>
          <div className="stack">
            <div className="row2">
              <Field label="Nom">
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} autoFocus />
              </Field>
              <Field label="Espace">
                <select className="input" value={editing.workspace} onChange={(e) => setEditing({ ...editing, workspace: e.target.value as Template['workspace'] })}>
                  {WORKSPACES.map((w) => <option key={w} value={w}>{WORKSPACE_LABELS[w]}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Description">
              <input className="input" value={editing.description ?? ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </Field>
            <div className="row3">
              {editing.kind === 'prompt' && (
                <Field label="Réponse attendue">
                  <select className="input" value={editing.output} onChange={(e) => setEditing({ ...editing, output: e.target.value as PromptOutput })}>
                    {Object.entries(OUTPUT_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Canal par défaut">
                <select className="input" value={editing.channel ?? ''} onChange={(e) => setEditing({ ...editing, channel: (e.target.value || null) as Template['channel'] })}>
                  <option value="">Aucun</option>
                  {CHANNELS.map((c) => <option key={c} value={c}>{CHANNEL_LABELS[c]}</option>)}
                </select>
              </Field>
              <Field label="Format par défaut">
                <select className="input" value={editing.format ?? ''} onChange={(e) => setEditing({ ...editing, format: (e.target.value || null) as Template['format'] })}>
                  <option value="">Aucun</option>
                  {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABELS[f]}</option>)}
                </select>
              </Field>
            </div>
            <Field
              label={editing.kind === 'prompt' ? 'Demande faite à Claude' : 'Contenu'}
              hint={
                <>
                  Champs détectés : {extractPlaceholders(editing.body).join(', ') || 'aucun'}. Champs automatiques : {BRAND_PLACEHOLDERS.map((p) => `{{${p}}}`).join(' ')}.
                  {editing.kind === 'prompt' && ' Le contexte de marque, le format de réponse et les règles de qualité sont ajoutés automatiquement.'}
                </>
              }
            >
              <textarea className="input mono" rows={10} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} />
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
