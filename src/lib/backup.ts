import { emptyState, BUILTIN_CONTENT, BUILTIN_PROMPTS } from './defaults';
import { isValidDate, nowISO } from './dates';
import { ValidationError, validateState } from './schema';
import type { AppState, Campaign, CampaignStatus, Channel, Publication, PubStatus, Template, WorkspaceId } from './types';
import { CHANNELS, WORKSPACES } from './types';

export const BACKUP_FORMAT = 'vitrine-marketing-backup';
export const MAX_BACKUP_CHARS = 20_000_000;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: 3;
  exportedAt: string;
  app: string;
  data: AppState;
}

export interface ParsedBackup {
  state: AppState;
  exportedAt: string | null;
  migratedFrom: 'v2' | null;
}

export function makeBackup(state: AppState, at = nowISO()): BackupFile {
  return { format: BACKUP_FORMAT, version: 3, exportedAt: at, app: 'The Vitrine Marketing Agent', data: state };
}

export function backupFilename(at = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `vitrine-marketing-sauvegarde-${at.getFullYear()}-${p(at.getMonth() + 1)}-${p(at.getDate())}-${p(at.getHours())}${p(at.getMinutes())}.json`;
}

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Adds built-in templates introduced by newer versions without touching user edits. */
export function withBuiltins(state: AppState): AppState {
  const ids = new Set(state.templates.map((t) => t.id));
  const missing: Template[] = [...BUILTIN_PROMPTS, ...BUILTIN_CONTENT].filter((t) => !ids.has(t.id)).map((t) => ({ ...t }));
  return missing.length ? { ...state, templates: [...state.templates, ...missing] } : state;
}

export function parseBackup(text: string): ParsedBackup {
  if (text.length > MAX_BACKUP_CHARS) throw new ValidationError('Sauvegarde trop volumineuse (20 Mo maximum).');
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ValidationError('Ce fichier n’est pas un JSON valide.');
  }
  if (!isObj(raw)) throw new ValidationError('Version ou structure incompatible.');

  if (raw.format === BACKUP_FORMAT) {
    if (raw.version !== 3) throw new ValidationError('Version ou structure incompatible.');
    return {
      state: withBuiltins(validateState(raw.data)),
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
      migratedFrom: null,
    };
  }
  if (isObj(raw.meta) && raw.meta.schemaVersion === 3) {
    return { state: withBuiltins(validateState(raw)), exportedAt: null, migratedFrom: null };
  }
  if (raw.version === 2 && Array.isArray(raw.drafts) && Array.isArray(raw.campaigns)) {
    return {
      state: migrateV2(raw.drafts, raw.campaigns),
      exportedAt: typeof raw.exportedAt === 'string' ? raw.exportedAt : null,
      migratedFrom: 'v2',
    };
  }
  throw new ValidationError('Version ou structure incompatible.');
}

const V2_STATUS: Record<string, PubStatus> = { Brouillon: 'brouillon', Approuvé: 'approuve', Publié: 'publie' };
const V2_CAMPAIGN_STATUS: Record<string, CampaignStatus> = { Idée: 'idee', Active: 'active', Terminée: 'terminee' };

function channelFrom(v: unknown): Channel {
  const s = String(v ?? '').toLowerCase();
  if (s.includes('google')) return 'google';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('facebook')) return 'facebook';
  if (s.includes('blog') || s.includes('site')) return 'blog';
  return (CHANNELS as readonly string[]).includes(s) ? (s as Channel) : 'instagram';
}

/** Converts the ChatGPT-era backup ({version:2, drafts, campaigns}) to the current model. */
export function migrateV2(drafts: unknown[], campaigns: unknown[]): AppState {
  const now = nowISO();
  const state = emptyState(now);
  const str = (v: unknown, max = 100_000) => (typeof v === 'string' ? v.slice(0, max) : '');
  state.campaigns = campaigns.filter(isObj).map(
    (c): Campaign => ({
      id: str(c.id, 100) || `legacy-c-${Math.random().toString(36).slice(2)}`,
      name: str(c.name, 300) || 'Campagne sans nom',
      objective: str(c.objective, 2000),
      audience: str(c.audience, 2000),
      keyMessage: '',
      channels: [],
      startDate: null,
      endDate: null,
      status: V2_CAMPAIGN_STATUS[str(c.status)] ?? 'idee',
      kpiTarget: '',
      notes: '',
      color: '#FFC27D',
      createdAt: now,
      updatedAt: now,
    }),
  );
  const campaignIds = new Set(state.campaigns.map((c) => c.id));
  state.publications = drafts.filter(isObj).map((d): Publication => {
    const agent = str(d.agent);
    const workspace: WorkspaceId = (WORKSPACES as readonly string[]).includes(agent) ? (agent as WorkspaceId) : 'social';
    const date = str(d.date, 10);
    const created = str(d.created, 40) || now;
    const status = V2_STATUS[str(d.status)] ?? 'brouillon';
    return {
      id: str(d.id, 100) || `legacy-p-${Math.random().toString(36).slice(2)}`,
      title: str(d.title, 500) || 'Sans titre',
      workspace,
      channel: channelFrom(d.channel),
      format: workspace === 'seo' ? 'article' : workspace === 'strategy' ? 'document' : 'post',
      campaignId: d.campaign && campaignIds.has(String(d.campaign)) ? String(d.campaign) : null,
      status,
      scheduledDate: isValidDate(date) ? date : null,
      scheduledTime: null,
      hook: '',
      body: str(d.content),
      cta: '',
      hashtags: '',
      visualBrief: '',
      notes: 'Importé depuis l’ancienne version (v2).',
      publishedAt: status === 'publie' && isValidDate(date) ? date : null,
      publishedUrl: '',
      tags: [],
      source: 'import',
      history: [{ at: now, action: 'creation', comment: 'Migration depuis la sauvegarde v2' }],
      versions: [],
      createdAt: created,
      updatedAt: now,
    };
  });
  return validateState(state);
}

export interface BackupSummary {
  campaigns: number;
  publications: number;
  templates: number;
  performance: number;
  keywords: number;
  notes: number;
}

export function summarize(state: AppState): BackupSummary {
  return {
    campaigns: state.campaigns.length,
    publications: state.publications.length,
    templates: state.templates.filter((t) => !t.builtin).length,
    performance: state.performance.length,
    keywords: state.seo.keywords.length,
    notes: state.strategy.notes.length,
  };
}

function mergeById<T extends { id: string; updatedAt?: string; createdAt?: string }>(a: T[], b: T[]): T[] {
  const map = new Map(a.map((x) => [x.id, x]));
  for (const item of b) {
    const cur = map.get(item.id);
    const curStamp = cur?.updatedAt ?? cur?.createdAt ?? '';
    const newStamp = item.updatedAt ?? item.createdAt ?? '';
    if (!cur || newStamp >= curStamp) map.set(item.id, item);
  }
  return [...map.values()];
}

/** Merges an imported state into the current one; the most recently updated version of each item wins. */
export function mergeStates(current: AppState, incoming: AppState): AppState {
  const merged: AppState = {
    ...current,
    brand: current.brand,
    campaigns: mergeById(current.campaigns, incoming.campaigns),
    publications: mergeById(current.publications, incoming.publications),
    templates: mergeById(current.templates, incoming.templates),
    performance: mergeById(current.performance, incoming.performance),
    strategy: {
      notes: mergeById(current.strategy.notes, incoming.strategy.notes),
      goals: mergeById(current.strategy.goals, incoming.strategy.goals),
    },
    seo: {
      keywords: mergeById(current.seo.keywords, incoming.seo.keywords),
      checks: { ...incoming.seo.checks, ...current.seo.checks },
    },
    claude: mergeById(current.claude, incoming.claude).slice(-200),
  };
  return validateState(merged);
}
