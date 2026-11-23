import { describe, expect, it } from 'vitest';
import { csvCell, importPerformanceCSV, parseCSV, publicationsCSV } from './csv';
import { buildICS, foldLine } from './ics';
import { dataDigest, goalProgress, rates, sumEntries } from './metrics';
import { checkPublication, composeForPosting } from './qa';
import { descriptionCheck, faqJsonLd, titleCheck } from './seo';
import { monthGrid, addDays, startOfWeek } from './dates';
import { buildVisualPrompt } from './creative';
import { DEFAULT_BRAND } from './defaults';
import { makePublication } from '../state/store';
import type { PerformanceEntry } from './types';

const entry = (o: Partial<PerformanceEntry>): PerformanceEntry => ({
  id: Math.random().toString(),
  date: '2026-11-10',
  channel: 'instagram',
  publicationId: null,
  campaignId: null,
  impressions: 0,
  reach: 0,
  interactions: 0,
  clicks: 0,
  profileVisits: 0,
  followersGained: 0,
  enquiries: 0,
  notes: '',
  createdAt: '',
  ...o,
});

describe('csv', () => {
  it('neutralises formulas and escapes quotes', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('-12')).toBe('"-12"');
    expect(csvCell('@SUM')).toBe(`"'@SUM"`);
  });
  it('exports publications with BOM and semicolons', () => {
    const csv = publicationsCSV([makePublication({ title: 'A;B', body: 'ligne\n2' })], []);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('"A;B"');
  });
  it('parses quoted CSV with any delimiter', () => {
    expect(parseCSV('a,b\n"x, y","z ""q"""')).toEqual([['a', 'b'], ['x, y', 'z "q"']]);
    expect(parseCSV('a;b\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
  });
  it('imports a Meta-style statistics export', () => {
    const csv = 'Date;Plateforme;Vues;Couverture;J\'aime;Commentaires;Partages;Enregistrements;Clics sur le lien;Visites du profil\n01/11/2026;Facebook;1 234;900;40;5;3;2;12;30\nnope;x;1;1;1;1;1;1;1;1';
    const r = importPerformanceCSV(csv);
    expect(r.entries).toHaveLength(1);
    expect(r.entries[0]).toMatchObject({ date: '2026-11-01', channel: 'facebook', impressions: 1234, reach: 900, interactions: 50, clicks: 12, profileVisits: 30 });
    expect(r.warnings).toHaveLength(1);
  });
  it('requires a date column', () => {
    expect(importPerformanceCSV('a;b\n1;2').warnings[0]).toMatch(/Date/);
  });
});

describe('metrics', () => {
  const entries = [
    entry({ impressions: 1000, interactions: 50, clicks: 10, enquiries: 1 }),
    entry({ impressions: 1000, interactions: 30, clicks: 10, profileVisits: 20, enquiries: 3, channel: 'facebook', date: '2026-12-02' }),
  ];
  it('sums and computes rates', () => {
    const t = sumEntries(entries);
    expect(t.impressions).toBe(2000);
    const r = rates(t);
    expect(r.engagement).toBeCloseTo(0.04);
    expect(r.enquiryPerThousand).toBe(2);
    expect(rates(sumEntries([])).engagement).toBeNull();
  });
  it('tracks goal progress within the period and channel', () => {
    const g = { id: 'g', label: '', metric: 'enquiries' as const, target: 2, startDate: '2026-11-01', endDate: '2026-11-30', channel: 'tous' as const, campaignId: null };
    expect(goalProgress(g, entries)).toEqual({ current: 1, ratio: 0.5 });
  });
  it('produces a digest for Claude', () => {
    const d = dataDigest(entries, []);
    expect(d).toContain('Impressions / vues : 2');
    expect(d).toContain('Par canal');
    expect(d).toContain('Par mois');
  });
});

describe('ics', () => {
  it('exports scheduled publications with reminders', () => {
    const p = { ...makePublication({ title: 'Post, test', body: 'Ligne 1\nLigne 2' }), scheduledDate: '2026-12-01', scheduledTime: '23:45' };
    const unscheduled = makePublication({ title: 'Sans date' });
    const ics = buildICS([p, unscheduled], [], new Date('2026-11-23T10:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(ics).toContain('DTSTART;TZID=Europe/Paris:20261201T234500');
    expect(ics).toContain('DTEND;TZID=Europe/Paris:20261202T001500');
    expect(ics).toContain('Post\\, test');
    expect(ics).toContain('TRIGGER:-PT30M');
  });
  it('folds long lines', () => {
    const folded = foldLine('X'.repeat(200));
    expect(folded.split('\r\n ').every((l) => l.length <= 75)).toBe(true);
  });
});

describe('quality checks', () => {
  it('flags missing CTA, risky claims and Instagram links', () => {
    const p = makePublication({ title: 't', channel: 'instagram', body: 'Nous sommes le meilleur studio, voir https://x.fr' });
    const qa = checkPublication(p);
    const labels = qa.checks.filter((c) => c.level !== 'ok').map((c) => c.label);
    expect(labels).toContain('Appel à l’action');
    expect(labels).toContain('Promesses vérifiables');
    expect(labels).toContain('Liens');
  });
  it('errors on too many Instagram hashtags and on empty content', () => {
    const tags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
    expect(checkPublication(makePublication({ title: 't', body: 'Texte', hashtags: tags })).errors).toBeGreaterThan(0);
    expect(checkPublication(makePublication({ title: 'vide' })).checks[0].level).toBe('error');
  });
  it('composes text for posting without duplicating the hook', () => {
    expect(composeForPosting({ hook: 'Accroche', body: 'Accroche\nSuite', cta: 'CTA', hashtags: '#a' })).toBe('Accroche\nSuite\n\nCTA\n\n#a');
  });
});

describe('seo & creative & dates', () => {
  it('checks title and description lengths', () => {
    expect(titleCheck('Court').level).toBe('court');
    expect(titleCheck('Création de site internet à Fréjus | The Vitrine').level).toBe('ok');
    expect(descriptionCheck('x'.repeat(200)).level).toBe('long');
  });
  it('generates escaped FAQ JSON-LD', () => {
    const out = faqJsonLd([{ q: 'Délai ?', a: '<b>3 semaines</b>' }, { q: '', a: 'ignored' }]);
    expect(out).toContain('"FAQPage"');
    expect(out).not.toContain('<b>');
    expect(JSON.parse(out.replace(/<\/?script[^>]*>/g, '')).mainEntity).toHaveLength(1);
  });
  it('builds visual prompts with brand palette and exclusions', () => {
    const r = buildVisualPrompt({ kind: 'video', subject: 'a desk', ratio: '9:16', style: 'cinematic', light: 'warm', brandPalette: true, exclusions: ['faces', 'text'], duration: 8, camera: '' }, DEFAULT_BRAND);
    expect(r.prompt).toContain('8 seconds');
    expect(r.prompt).toContain('#081227');
    expect(r.negative).toContain('faces');
  });
  it('computes calendar grids starting on Monday', () => {
    const grid = monthGrid(2026, 10); // November 2026 starts on a Sunday
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-10-26');
    expect(startOfWeek('2026-11-23')).toBe('2026-11-23');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});
