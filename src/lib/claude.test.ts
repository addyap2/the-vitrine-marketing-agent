import { describe, expect, it } from 'vitest';
import { BUILTIN_PROMPTS, DEFAULT_BRAND } from './defaults';
import { parseDocument, parseKeywords, parsePublications, parseRevision, toDate, toTime } from './parseResponse';
import { buildClaudePrompt, buildRevisionPrompt } from './prompts';
import { extractPlaceholders, renderTemplate } from './templates';
import { makePublication } from '../state/store';

describe('templates', () => {
  it('extracts user placeholders but not brand ones', () => {
    expect(extractPlaceholders('{{sujet}} {{ cta }} {{nombre_de_slides}} {{sujet}}')).toEqual(['sujet', 'nombre_de_slides']);
  });
  it('renders values and keeps missing ones visible', () => {
    expect(renderTemplate('{{marque}} — {{sujet}} — {{vide}}', { sujet: 'SEO' }, DEFAULT_BRAND)).toBe('The Vitrine — SEO — [vide]');
  });
});

describe('prompt builder', () => {
  it('builds a complete prompt for every built-in template', () => {
    for (const t of BUILTIN_PROMPTS) {
      const prompt = buildClaudePrompt({ brand: DEFAULT_BRAND, template: t, values: {} });
      expect(prompt).toContain('# Contexte de marque');
      expect(prompt).toContain('thevitrine.fr');
      expect(prompt).toContain('N’invente ni chiffres');
      if (t.output === 'publications') expect(prompt).toContain('"brief_visuel"');
      if (t.output === 'mots-cles') expect(prompt).toContain('"mot_cle"');
      if (t.output === 'document') expect(prompt).toContain('TITRE :');
    }
  });
  it('includes campaign context and filled values', () => {
    const t = BUILTIN_PROMPTS.find((x) => x.id === 'p-social-series')!;
    const prompt = buildClaudePrompt({
      brand: DEFAULT_BRAND,
      template: t,
      values: { nombre: '3', sujet: 'la vitesse des sites' },
      campaign: { id: 'c', name: 'Hiver', objective: 'Devis', audience: '', keyMessage: '', channels: ['facebook'], startDate: null, endDate: null, status: 'active', kpiTarget: '', notes: '', color: '#FFC27D', createdAt: '', updatedAt: '' },
    });
    expect(prompt).toContain('Rédige 3 publications');
    expect(prompt).toContain('la vitesse des sites');
    expect(prompt).toContain('# Campagne concernée');
    expect(prompt).toContain('Hiver');
  });
  it('builds a revision prompt containing the current text', () => {
    const prompt = buildRevisionPrompt(DEFAULT_BRAND, makePublication({ title: 'X', body: 'Texte actuel' }), 'Plus court');
    expect(prompt).toContain('Texte actuel');
    expect(prompt).toContain('Plus court');
  });
});

const claudeAnswer = `Voici trois publications pour votre semaine.

\`\`\`json
[
  {"titre": "Vitesse", "canal": "Instagram", "format": "carrousel", "date": "2026-12-01", "heure": "9h30", "accroche": "Votre site met-il plus de 3 secondes à charger ?", "texte": "Slide 1\\nSlide 2", "cta": "Demandez un audit", "hashtags": ["SiteWeb", "#Var"], "brief_visuel": "4:5 navy", "notes": ""},
  {"title": "Fiche", "channel": "Google Business Profile", "date": "02/12/2026", "text": "Actualité", "cta": ""},
  {"titre": "Sans date", "canal": "linkedin", "format": "post", "date": "bientôt", "texte": "Bonjour",}
]
\`\`\``;

describe('response parser', () => {
  it('parses publications with French and English keys', () => {
    const { items, warnings } = parsePublications(claudeAnswer);
    expect(items).toHaveLength(3);
    expect(items[0]).toMatchObject({ title: 'Vitesse', channel: 'instagram', format: 'carrousel', scheduledDate: '2026-12-01', scheduledTime: '09:30', hashtags: '#SiteWeb #Var' });
    expect(items[0].body).toBe('Slide 1\nSlide 2');
    expect(items[1]).toMatchObject({ title: 'Fiche', channel: 'google', format: 'fiche', scheduledDate: '2026-12-02' });
    expect(items[2].scheduledDate).toBeNull();
    expect(warnings.join(' ')).toMatch(/bientôt/);
  });
  it('accepts a bare JSON array without fences', () => {
    expect(parsePublications('Résultat : [{"titre":"A","texte":"B"}]').items).toHaveLength(1);
  });
  it('reports missing JSON', () => {
    const r = parsePublications('Pas de JSON ici.');
    expect(r.items).toHaveLength(0);
    expect(r.warnings[0]).toMatch(/Aucun bloc JSON/);
  });
  it('parses keywords', () => {
    const r = parseKeywords('```json\n[{"mot_cle":"création site internet Fréjus","intention":"Locale","page_cible":"/creation-site-internet-frejus-saint-raphael/","priorite":1},{"intention":"x"}]\n```');
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ intent: 'locale', priority: 1 });
    expect(r.warnings).toHaveLength(1);
  });
  it('parses documents with a TITRE line', () => {
    expect(parseDocument('TITRE : Plan Q1\n\n## Diagnostic\nTexte')).toEqual({ title: 'Plan Q1', content: '## Diagnostic\nTexte' });
    expect(parseDocument('## Persona Julie\nTexte').title).toBe('Persona Julie');
  });
  it('parses a revision object', () => {
    expect(parseRevision('Modifié.\n```json\n{"accroche":"A","texte":"B","cta":"C","hashtags":"#d"}\n```')).toEqual({ hook: 'A', body: 'B', cta: 'C', hashtags: '#d' });
    expect(parseRevision('rien')).toBeNull();
  });
  it('normalises dates and times', () => {
    expect(toDate('31/12/2026')).toBe('2026-12-31');
    expect(toDate('2026-13-01')).toBeNull();
    expect(toTime('18h')).toBe('18:00');
    expect(toTime('25:00')).toBeNull();
  });
});
