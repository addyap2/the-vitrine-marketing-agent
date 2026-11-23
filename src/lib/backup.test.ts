import { describe, expect, it } from 'vitest';
import { makeBackup, mergeStates, parseBackup, summarize } from './backup';
import { emptyState } from './defaults';
import { validateState } from './schema';
import { makePublication } from '../state/store';
import type { AppState } from './types';

function sample(): AppState {
  const s = emptyState('2026-11-01T10:00:00.000Z');
  s.campaigns.push({
    id: 'c1',
    name: 'Rentrée',
    objective: 'Demandes de devis',
    audience: 'Artisans',
    keyMessage: '',
    channels: ['instagram'],
    startDate: '2026-11-01',
    endDate: '2026-11-30',
    status: 'active',
    kpiTarget: '',
    notes: '',
    color: '#FFC27D',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  });
  s.publications.push({ ...makePublication({ title: 'Post', body: 'Bonjour', campaignId: 'c1', scheduledDate: '2026-11-23' }), id: 'p1' });
  return s;
}

describe('backup', () => {
  it('round-trips a full backup', () => {
    const s = sample();
    const parsed = parseBackup(JSON.stringify(makeBackup(s)));
    expect(parsed.state.publications[0].title).toBe('Post');
    expect(parsed.state.campaigns[0].id).toBe('c1');
    expect(parsed.migratedFrom).toBeNull();
    expect(summarize(parsed.state).publications).toBe(1);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseBackup('{')).toThrow(/JSON valide/);
  });

  it('rejects unknown structures and versions', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow(/incompatible/);
    expect(() => parseBackup(JSON.stringify({ ...makeBackup(sample()), version: 9 }))).toThrow(/incompatible/);
  });

  it('rejects duplicate ids', () => {
    const s = sample();
    s.publications.push({ ...s.publications[0] });
    expect(() => parseBackup(JSON.stringify(makeBackup(s)))).toThrow(/double/);
  });

  it('rejects orphan campaign references', () => {
    const s = sample();
    s.campaigns = [];
    expect(() => parseBackup(JSON.stringify(makeBackup(s)))).toThrow(/introuvable/);
  });

  it('rejects impossible dates and accepts leap days', () => {
    const bad = sample();
    bad.publications[0].scheduledDate = '2026-02-30';
    expect(() => parseBackup(JSON.stringify(makeBackup(bad)))).toThrow(/date invalide/);
    const leap = sample();
    leap.publications[0].scheduledDate = '2028-02-29';
    expect(parseBackup(JSON.stringify(makeBackup(leap))).state.publications).toHaveLength(1);
  });

  it('rejects oversized files and content', () => {
    expect(() => parseBackup(' '.repeat(20_000_001))).toThrow(/volumineuse/);
    const s = sample();
    s.publications[0].body = 'x'.repeat(100_001);
    expect(() => parseBackup(JSON.stringify(makeBackup(s)))).toThrow(/Données incorrectes/);
  });

  it('fills defaults for missing optional fields', () => {
    const s = sample() as unknown as { publications: Record<string, unknown>[] };
    delete s.publications[0].hashtags;
    delete s.publications[0].tags;
    const parsed = parseBackup(JSON.stringify({ format: 'vitrine-marketing-backup', version: 3, data: s }));
    expect(parsed.state.publications[0].hashtags).toBe('');
    expect(parsed.state.publications[0].tags).toEqual([]);
  });

  it('migrates the ChatGPT v2 backup format', () => {
    const v2 = {
      version: 2,
      drafts: [
        { id: 'd1', title: 'Ancien', agent: 'seo', content: 'Texte', status: 'Approuvé', date: '2026-11-23', created: '2026-11-20T10:00:00Z', campaign: 'c1', channel: 'Google Business Profile' },
      ],
      campaigns: [{ id: 'c1', name: 'Campagne', objective: 'Demandes', audience: 'Commerçants', status: 'Active' }],
    };
    const parsed = parseBackup(JSON.stringify(v2));
    expect(parsed.migratedFrom).toBe('v2');
    const p = parsed.state.publications[0];
    expect(p.status).toBe('approuve');
    expect(p.workspace).toBe('seo');
    expect(p.channel).toBe('google');
    expect(p.campaignId).toBe('c1');
    expect(parsed.state.campaigns[0].status).toBe('active');
  });

  it('restores missing built-in templates', () => {
    const s = sample();
    s.templates = [];
    const parsed = parseBackup(JSON.stringify(makeBackup(s)));
    expect(parsed.state.templates.length).toBeGreaterThan(10);
  });

  it('merges by id keeping the most recent version', () => {
    const a = sample();
    const b = structuredClone(a);
    b.publications[0] = { ...b.publications[0], title: 'Plus récent', updatedAt: '2099-01-01T00:00:00.000Z' };
    b.publications.push({ ...makePublication({ title: 'Nouveau' }), id: 'p2' });
    const merged = mergeStates(a, b);
    expect(merged.publications).toHaveLength(2);
    expect(merged.publications.find((p) => p.id === 'p1')?.title).toBe('Plus récent');
  });

  it('detaches statistics that point to deleted items instead of failing', () => {
    const s = sample();
    s.performance.push({
      id: 'm1', date: '2026-11-02', channel: 'instagram', publicationId: 'ghost', campaignId: 'ghost',
      impressions: 10, reach: 0, interactions: 1, clicks: 0, profileVisits: 0, followersGained: 0, enquiries: 0, notes: '', createdAt: 'x',
    });
    const v = validateState(s);
    expect(v.performance[0].publicationId).toBeNull();
    expect(v.performance[0].campaignId).toBeNull();
  });
});
