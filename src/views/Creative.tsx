import { useState } from 'react';
import { useAppState } from '../state/store';
import { useEditor } from '../components/PublicationEditor';
import { Button, CopyButton, Field, PageHeader, Tabs } from '../components/ui';
import { ClaudeAssistant } from '../components/ClaudeAssistant';
import { DEFAULT_FILTER, FilterBar, NewPublicationButton, PublicationList, filterPublications, type PubFilter } from '../components/PublicationViews';
import { TemplatePickerButton } from '../components/TemplatePicker';
import { WORKSPACE_DESCRIPTIONS } from '../lib/labels';
import { buildVisualPrompt, EXCLUSIONS, LIGHTS, RATIOS, STYLES, type VisualInput } from '../lib/creative';

export function CreativeView() {
  const state = useAppState();
  const [tab, setTab] = useState<'builder' | 'briefs' | 'claude'>('builder');
  const [filter, setFilter] = useState<PubFilter>(DEFAULT_FILTER);
  const creative = state.publications.filter((p) => p.workspace === 'creative' || ['visuel', 'video', 'reel'].includes(p.format));
  return (
    <div className="page">
      <PageHeader
        eyebrow="Espace marketing"
        title="Création"
        description={WORKSPACE_DESCRIPTIONS.creative}
        actions={
          <>
            <TemplatePickerButton workspace="creative" />
            <NewPublicationButton workspace="creative" label="Nouveau brief" defaults={{ format: 'visuel' }} />
          </>
        }
      />
      <Tabs
        label="Sections création"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'builder', label: 'Générateur de prompt visuel' },
          { id: 'briefs', label: 'Briefs', count: creative.filter((p) => p.status !== 'archive').length },
          { id: 'claude', label: 'Avec Claude' },
        ]}
      />
      {tab === 'builder' && <VisualBuilder />}
      {tab === 'briefs' && (
        <>
          <FilterBar value={filter} onChange={setFilter} />
          <PublicationList pubs={filterPublications(creative, filter)} />
        </>
      )}
      {tab === 'claude' && (
        <section className="panel">
          <ClaudeAssistant workspace="creative" />
        </section>
      )}
    </div>
  );
}

function VisualBuilder() {
  const { brand } = useAppState();
  const { newPublication } = useEditor();
  const [input, setInput] = useState<VisualInput>({
    kind: 'image',
    subject: '',
    ratio: '4:5',
    style: 'photo',
    light: 'warm',
    brandPalette: true,
    exclusions: ['text', 'logos', 'faces', 'hands'],
    duration: 8,
    camera: '',
  });
  const set = <K extends keyof VisualInput>(k: K, v: VisualInput[K]) => setInput((i) => ({ ...i, [k]: v }));
  const out = buildVisualPrompt(input, brand);
  const full = `${out.prompt}${out.negative ? `\nNegative: ${out.negative}` : ''}`;

  return (
    <div className="two-col">
      <section className="panel stack">
        <div className="segmented" role="radiogroup" aria-label="Type de visuel">
          {(['image', 'video'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={input.kind === k}
              className={input.kind === k ? 'active' : ''}
              onClick={() => setInput((i) => ({ ...i, kind: k, ratio: k === 'video' ? '9:16' : '4:5' }))}
            >
              {k === 'image' ? 'Image' : 'Vidéo courte'}
            </button>
          ))}
        </div>
        <Field label="Sujet (en français ou en anglais)" hint="Décrivez la scène : lieu, objets, ambiance. Les prompts sont générés en anglais, langue la mieux comprise par les générateurs.">
          <textarea className="input" rows={3} value={input.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Ex. a tidy desk in a sunny Provençal studio with a laptop showing a website" />
        </Field>
        <div className="row2">
          <Field label="Format">
            <select className="input" value={input.ratio} onChange={(e) => set('ratio', e.target.value as VisualInput['ratio'])}>
              {RATIOS.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </Field>
          <Field label="Style">
            <select className="input" value={input.style} onChange={(e) => set('style', e.target.value as VisualInput['style'])}>
              {STYLES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
        <div className="row2">
          <Field label="Lumière">
            <select className="input" value={input.light} onChange={(e) => set('light', e.target.value as VisualInput['light'])}>
              {LIGHTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </Field>
          {input.kind === 'video' && (
            <Field label="Durée (secondes)">
              <input className="input" type="number" min={2} max={60} value={input.duration} onChange={(e) => set('duration', Math.max(2, Math.min(60, Number(e.target.value) || 8)))} />
            </Field>
          )}
        </div>
        {input.kind === 'video' && (
          <Field label="Mouvement de caméra">
            <input className="input" value={input.camera} onChange={(e) => set('camera', e.target.value)} placeholder="slow dolly-in, gentle parallax…" />
          </Field>
        )}
        <label className="checkbox">
          <input type="checkbox" checked={input.brandPalette} onChange={(e) => set('brandPalette', e.target.checked)} />
          <span>Palette de la marque</span>
          <span className="swatches" aria-hidden="true">
            <i style={{ background: brand.colors.navy }} />
            <i style={{ background: brand.colors.amber }} />
            <i style={{ background: brand.colors.cream }} />
          </span>
        </label>
        <fieldset className="checks">
          <legend className="field-label">Ne doit pas apparaître</legend>
          {EXCLUSIONS.map((e) => (
            <label key={e.id} className="checkbox">
              <input
                type="checkbox"
                checked={input.exclusions.includes(e.id)}
                onChange={(ev) => set('exclusions', ev.target.checked ? [...input.exclusions, e.id] : input.exclusions.filter((x) => x !== e.id))}
              />
              <span>{e.label}</span>
            </label>
          ))}
        </fieldset>
      </section>
      <section className="panel stack">
        <div className="row-between">
          <h2>Prompt généré</h2>
          <span className="small muted">{out.spec}</span>
        </div>
        <div className="preview mono tall">{full}</div>
        <div className="inline-actions wrap">
          <CopyButton text={full} label="Copier le prompt" variant="primary" />
          <Button
            icon="plus"
            onClick={() =>
              newPublication({
                title: `${input.kind === 'video' ? 'Vidéo' : 'Visuel'} — ${input.subject.slice(0, 50) || 'nouveau brief'}`,
                workspace: 'creative',
                channel: 'instagram',
                format: input.kind === 'video' ? 'reel' : 'visuel',
                visualBrief: `${out.spec}\n\n${full}`,
                source: 'modele',
              })
            }
          >
            Enregistrer comme brief
          </Button>
        </div>
        <p className="small muted">
          Fonctionne avec les générateurs d’images ou de vidéos de votre choix (y compris leurs offres gratuites). L’application ne génère pas d’image elle-même.
        </p>
      </section>
    </div>
  );
}
