import { useState } from 'react';
import { useActions, useAppState } from '../state/store';
import { Button, Field, PageHeader, useUI } from '../components/ui';
import { DEFAULT_BRAND } from '../lib/defaults';
import { brandBlock } from '../lib/prompts';
import type { Brand } from '../lib/types';

export function BrandView() {
  const state = useAppState();
  const actions = useActions();
  const { toast, confirm } = useUI();
  const [b, setB] = useState<Brand>(state.brand);
  const dirty = JSON.stringify(b) !== JSON.stringify(state.brand);
  const set = <K extends keyof Brand>(k: K, v: Brand[K]) => setB((x) => ({ ...x, [k]: v }));

  return (
    <div className="page">
      <PageHeader
        eyebrow="Outils"
        title="Profil de marque"
        description="Ces informations sont injectées dans chaque prompt Claude et dans les modèles de contenu. Soyez factuel : Claude s’appuiera dessus."
        actions={
          <>
            <Button
              variant="ghost"
              onClick={async () => {
                if (await confirm({ title: 'Rétablir le profil par défaut', message: 'Le profil reviendra aux valeurs d’origine de The Vitrine.', confirmLabel: 'Rétablir' })) setB(structuredClone(DEFAULT_BRAND));
              }}
            >
              Valeurs d’origine
            </Button>
            <Button
              variant="primary"
              icon="check"
              disabled={!dirty}
              onClick={() => {
                if (!b.name.trim()) return toast('Le nom de la marque est obligatoire.', 'error');
                actions.saveBrand(b);
                toast('Profil de marque enregistré');
              }}
            >
              Enregistrer
            </Button>
          </>
        }
      />
      <div className="two-col brand-layout">
        <section className="panel stack">
          <div className="row2">
            <Field label="Nom">
              <input className="input" value={b.name} onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Site">
              <input className="input" type="url" value={b.website} onChange={(e) => set('website', e.target.value)} />
            </Field>
          </div>
          <Field label="Promesse / baseline">
            <input className="input" value={b.baseline} onChange={(e) => set('baseline', e.target.value)} />
          </Field>
          <Field label="Description de l’activité">
            <textarea className="input" rows={3} value={b.description} onChange={(e) => set('description', e.target.value)} />
          </Field>
          <Field label="Zone d’intervention">
            <input className="input" value={b.location} onChange={(e) => set('location', e.target.value)} />
          </Field>
          <Field label="Services (un par ligne)">
            <textarea className="input" rows={5} value={b.services} onChange={(e) => set('services', e.target.value)} />
          </Field>
          <Field label="Cibles">
            <textarea className="input" rows={2} value={b.audiences} onChange={(e) => set('audiences', e.target.value)} />
          </Field>
          <Field label="Ton de voix">
            <textarea className="input" rows={2} value={b.tone} onChange={(e) => set('tone', e.target.value)} />
          </Field>
          <Field label="À ne jamais faire">
            <textarea className="input" rows={3} value={b.avoid} onChange={(e) => set('avoid', e.target.value)} />
          </Field>
          <Field label="Appel à l’action par défaut">
            <input className="input" value={b.defaultCta} onChange={(e) => set('defaultCta', e.target.value)} />
          </Field>
          <Field label="Règles visuelles">
            <textarea className="input" rows={3} value={b.visualRules} onChange={(e) => set('visualRules', e.target.value)} />
          </Field>
          <fieldset className="checks">
            <legend className="field-label">Couleurs</legend>
            <div className="row3">
              {(['navy', 'amber', 'cream'] as const).map((k) => (
                <Field key={k} label={k === 'navy' ? 'Bleu nuit' : k === 'amber' ? 'Ambre' : 'Crème'}>
                  <span className="color-field">
                    <input type="color" value={b.colors[k]} onChange={(e) => set('colors', { ...b.colors, [k]: e.target.value.toUpperCase() })} aria-label={`Couleur ${k}`} />
                    <input className="input" value={b.colors[k]} onChange={(e) => set('colors', { ...b.colors, [k]: e.target.value })} maxLength={7} />
                  </span>
                </Field>
              ))}
            </div>
          </fieldset>
          <fieldset className="checks">
            <legend className="field-label">Jeux de hashtags</legend>
            {b.hashtagSets.map((h, i) => (
              <div key={i} className="inline-form">
                <input className="input input-inline" value={h.name} onChange={(e) => set('hashtagSets', b.hashtagSets.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} aria-label="Nom du jeu" />
                <input className="input" value={h.tags} onChange={(e) => set('hashtagSets', b.hashtagSets.map((x, j) => (j === i ? { ...x, tags: e.target.value } : x)))} aria-label="Hashtags" />
                <Button small variant="ghost" icon="trash" aria-label="Retirer ce jeu" onClick={() => set('hashtagSets', b.hashtagSets.filter((_, j) => j !== i))} />
              </div>
            ))}
            <Button small icon="plus" onClick={() => set('hashtagSets', [...b.hashtagSets, { name: 'Nouveau', tags: '' }])}>Ajouter un jeu</Button>
          </fieldset>
        </section>
        <section className="panel sticky">
          <h2>Ce que Claude reçoit</h2>
          <div className="preview mono tall">{brandBlock(b, 'social')}</div>
          {dirty && <p className="small warn">Modifications non enregistrées.</p>}
        </section>
      </div>
    </div>
  );
}
