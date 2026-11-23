import { z } from 'zod';
import { isValidDate, isValidTime } from './dates';
import {
  CAMPAIGN_STATUSES,
  CHANNELS,
  FORMATS,
  KEYWORD_INTENTS,
  METRIC_KEYS,
  NOTE_KINDS,
  PUB_STATUSES,
  WORKSPACES,
  type AppState,
} from './types';

/**
 * Validation of untrusted data (backups, stored state). Missing optional fields
 * get defaults so older or hand-edited backups still load, but wrong types,
 * impossible dates and broken references are rejected.
 */

const LONG = 100_000;
const s = (max = 2000) => z.string().max(max).default('');
const date = z.string().refine(isValidDate, 'date invalide');
const optDate = date.nullable().default(null);
const time = z.string().refine(isValidTime, 'heure invalide');
const id = z.string().min(1).max(100);
const iso = z.string().max(40);
const count = z.number().finite().min(0).max(1e12).default(0);

const history = z.object({
  at: iso,
  action: z.enum(['creation', 'statut', 'modification', 'commentaire', 'version']),
  from: z.enum(PUB_STATUSES).optional(),
  to: z.enum(PUB_STATUSES).optional(),
  comment: z.string().max(5000).optional(),
});

const version = z.object({ at: iso, hook: s(5000), body: s(LONG), cta: s(5000), hashtags: s(5000) });

export const publicationSchema = z.object({
  id,
  title: z.string().max(500),
  workspace: z.enum(WORKSPACES).default('social'),
  channel: z.enum(CHANNELS).default('instagram'),
  format: z.enum(FORMATS).default('post'),
  campaignId: id.nullable().default(null),
  status: z.enum(PUB_STATUSES).default('brouillon'),
  scheduledDate: optDate,
  scheduledTime: time.nullable().default(null),
  hook: s(5000),
  body: s(LONG),
  cta: s(5000),
  hashtags: s(5000),
  visualBrief: s(LONG),
  notes: s(LONG),
  publishedAt: optDate,
  publishedUrl: s(2000),
  tags: z.array(z.string().max(100)).max(50).default([]),
  source: z.enum(['manuel', 'claude', 'modele', 'import']).default('manuel'),
  history: z.array(history).max(500).default([]),
  versions: z.array(version).max(50).default([]),
  createdAt: iso,
  updatedAt: iso,
});

export const campaignSchema = z.object({
  id,
  name: z.string().min(1).max(300),
  objective: s(),
  audience: s(),
  keyMessage: s(),
  channels: z.array(z.enum(CHANNELS)).default([]),
  startDate: optDate,
  endDate: optDate,
  status: z.enum(CAMPAIGN_STATUSES).default('idee'),
  kpiTarget: s(),
  notes: s(LONG),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#FFC27D'),
  createdAt: iso,
  updatedAt: iso,
});

export const templateSchema = z.object({
  id,
  name: z.string().min(1).max(300),
  kind: z.enum(['contenu', 'prompt']),
  workspace: z.enum(WORKSPACES),
  description: s(),
  channel: z.enum(CHANNELS).nullable().default(null),
  format: z.enum(FORMATS).nullable().default(null),
  body: z.string().max(LONG),
  output: z.enum(['publications', 'document', 'mots-cles', 'texte']).default('texte'),
  builtin: z.boolean().default(false),
  createdAt: iso,
  updatedAt: iso,
});

export const performanceSchema = z.object({
  id,
  date,
  channel: z.enum(CHANNELS),
  publicationId: id.nullable().default(null),
  campaignId: id.nullable().default(null),
  impressions: count,
  reach: count,
  interactions: count,
  clicks: count,
  profileVisits: count,
  followersGained: z.number().finite().min(-1e9).max(1e12).default(0),
  enquiries: count,
  notes: s(5000),
  createdAt: iso,
});

const noteSchema = z.object({
  id,
  kind: z.enum(NOTE_KINDS),
  title: z.string().max(500),
  content: s(LONG),
  createdAt: iso,
  updatedAt: iso,
});

const goalSchema = z.object({
  id,
  label: z.string().max(500),
  metric: z.enum(METRIC_KEYS),
  target: z.number().finite().min(0),
  startDate: date,
  endDate: date,
  channel: z.union([z.enum(CHANNELS), z.literal('tous')]).default('tous'),
  campaignId: id.nullable().default(null),
});

const keywordSchema = z.object({
  id,
  keyword: z.string().min(1).max(300),
  intent: z.enum(KEYWORD_INTENTS).default('locale'),
  targetUrl: s(),
  priority: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
  status: z.enum(['a-traiter', 'en-cours', 'optimise']).default('a-traiter'),
  positions: z.array(z.object({ date, position: z.number().int().min(1).max(1000) })).max(500).default([]),
  notes: s(5000),
  createdAt: iso,
  updatedAt: iso,
});

const sessionSchema = z.object({
  id,
  workspace: z.enum(WORKSPACES),
  templateId: id.nullable().default(null),
  title: z.string().max(500),
  prompt: z.string().max(LONG * 2),
  response: s(LONG * 2),
  importedCount: z.number().int().min(0).default(0),
  createdAt: iso,
});

const brandSchema = z.object({
  name: z.string().max(200),
  website: s(500),
  baseline: s(),
  description: s(5000),
  location: s(),
  services: s(5000),
  audiences: s(5000),
  tone: s(5000),
  avoid: s(5000),
  defaultCta: s(),
  hashtagSets: z.array(z.object({ name: z.string().max(100), tags: z.string().max(2000) })).max(50).default([]),
  colors: z.object({ navy: z.string().max(20), amber: z.string().max(20), cream: z.string().max(20) }),
  visualRules: s(5000),
});

export const stateSchema = z.object({
  meta: z.object({
    schemaVersion: z.literal(3),
    createdAt: iso,
    lastChangeAt: iso.nullable().default(null),
    lastBackupAt: iso.nullable().default(null),
  }),
  brand: brandSchema,
  campaigns: z.array(campaignSchema).max(1000),
  publications: z.array(publicationSchema).max(20_000),
  templates: z.array(templateSchema).max(1000),
  performance: z.array(performanceSchema).max(50_000).default([]),
  strategy: z
    .object({ notes: z.array(noteSchema).max(2000).default([]), goals: z.array(goalSchema).max(500).default([]) })
    .default({ notes: [], goals: [] }),
  seo: z
    .object({
      keywords: z.array(keywordSchema).max(5000).default([]),
      checks: z.record(z.string().max(100), z.boolean()).default({}),
    })
    .default({ keywords: [], checks: {} }),
  claude: z.array(sessionSchema).max(500).default([]),
});

export class ValidationError extends Error {}

function dupes(ids: string[]): string | undefined {
  const seen = new Set<string>();
  for (const i of ids) {
    if (seen.has(i)) return i;
    seen.add(i);
  }
  return undefined;
}

/** Validates structure, then cross-references. Returns a clean AppState or throws ValidationError (French message). */
export function validateState(input: unknown): AppState {
  const result = stateSchema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const where = issue.path.join(' › ') || 'racine';
    throw new ValidationError(`Données incorrectes (${where} : ${issue.message})`);
  }
  const st = result.data as AppState;
  const checks: [string, string[]][] = [
    ['campagnes', st.campaigns.map((c) => c.id)],
    ['publications', st.publications.map((p) => p.id)],
    ['modèles', st.templates.map((t) => t.id)],
    ['statistiques', st.performance.map((p) => p.id)],
    ['mots-clés', st.seo.keywords.map((k) => k.id)],
  ];
  for (const [label, ids] of checks) {
    const d = dupes(ids);
    if (d) throw new ValidationError(`Identifiant en double dans les ${label} : ${d}`);
  }
  const campaignIds = new Set(st.campaigns.map((c) => c.id));
  const pubIds = new Set(st.publications.map((p) => p.id));
  const orphan = st.publications.find((p) => p.campaignId && !campaignIds.has(p.campaignId));
  if (orphan) throw new ValidationError(`Campagne référencée introuvable pour la publication « ${orphan.title} »`);
  // Statistics may point to deleted items: detach instead of failing.
  st.performance = st.performance.map((e) => ({
    ...e,
    campaignId: e.campaignId && campaignIds.has(e.campaignId) ? e.campaignId : null,
    publicationId: e.publicationId && pubIds.has(e.publicationId) ? e.publicationId : null,
  }));
  st.strategy.goals = st.strategy.goals.map((g) => ({
    ...g,
    campaignId: g.campaignId && campaignIds.has(g.campaignId) ? g.campaignId : null,
  }));
  const badCampaign = st.campaigns.find((c) => c.startDate && c.endDate && c.endDate < c.startDate);
  if (badCampaign) throw new ValidationError(`La campagne « ${badCampaign.name} » se termine avant de commencer`);
  return st;
}
