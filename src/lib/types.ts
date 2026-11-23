/** Domain model. Everything lives in the browser (localStorage) and in JSON backups. */

export const WORKSPACES = ['strategy', 'social', 'creative', 'calendar', 'seo', 'analytics'] as const;
export type WorkspaceId = (typeof WORKSPACES)[number];

export const CHANNELS = [
  'instagram',
  'facebook',
  'linkedin',
  'google',
  'blog',
  'newsletter',
  'tiktok',
  'pinterest',
  'youtube',
  'autre',
] as const;
export type Channel = (typeof CHANNELS)[number];

export const FORMATS = [
  'post',
  'carrousel',
  'reel',
  'story',
  'video',
  'visuel',
  'article',
  'fiche',
  'email',
  'page',
  'document',
  'autre',
] as const;
export type Format = (typeof FORMATS)[number];

export const PUB_STATUSES = [
  'idee',
  'brouillon',
  'relecture',
  'corrections',
  'approuve',
  'programme',
  'publie',
  'archive',
] as const;
export type PubStatus = (typeof PUB_STATUSES)[number];

export const CAMPAIGN_STATUSES = ['idee', 'planifiee', 'active', 'pause', 'terminee'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface HistoryEntry {
  at: string;
  action: 'creation' | 'statut' | 'modification' | 'commentaire' | 'version';
  from?: PubStatus;
  to?: PubStatus;
  comment?: string;
}

export interface Version {
  at: string;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
}

export interface Publication {
  id: string;
  title: string;
  workspace: WorkspaceId;
  channel: Channel;
  format: Format;
  campaignId: string | null;
  status: PubStatus;
  scheduledDate: string | null; // YYYY-MM-DD
  scheduledTime: string | null; // HH:MM
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  visualBrief: string;
  notes: string;
  publishedAt: string | null; // YYYY-MM-DD
  publishedUrl: string;
  tags: string[];
  source: 'manuel' | 'claude' | 'modele' | 'import';
  history: HistoryEntry[];
  versions: Version[];
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  objective: string;
  audience: string;
  keyMessage: string;
  channels: Channel[];
  startDate: string | null;
  endDate: string | null;
  status: CampaignStatus;
  kpiTarget: string;
  notes: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export type TemplateKind = 'contenu' | 'prompt';
export type PromptOutput = 'publications' | 'document' | 'mots-cles' | 'texte';

export interface Template {
  id: string;
  name: string;
  kind: TemplateKind;
  workspace: WorkspaceId;
  description: string;
  channel: Channel | null;
  format: Format | null;
  /** Body with {{placeholders}}. */
  body: string;
  /** Only for prompt templates: what the app expects back from Claude. */
  output: PromptOutput;
  builtin: boolean;
  createdAt: string;
  updatedAt: string;
}

export const METRIC_KEYS = [
  'impressions',
  'reach',
  'interactions',
  'clicks',
  'profileVisits',
  'followersGained',
  'enquiries',
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

export interface PerformanceEntry {
  id: string;
  date: string; // YYYY-MM-DD
  channel: Channel;
  publicationId: string | null;
  campaignId: string | null;
  impressions: number;
  reach: number;
  interactions: number;
  clicks: number;
  profileVisits: number;
  followersGained: number;
  enquiries: number;
  notes: string;
  createdAt: string;
}

export const NOTE_KINDS = ['positionnement', 'persona', 'swot', 'plan', 'message', 'concurrent', 'autre'] as const;
export type NoteKind = (typeof NOTE_KINDS)[number];

export interface StrategyNote {
  id: string;
  kind: NoteKind;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  label: string;
  metric: MetricKey;
  target: number;
  startDate: string;
  endDate: string;
  channel: Channel | 'tous';
  campaignId: string | null;
}

export const KEYWORD_INTENTS = ['locale', 'informationnelle', 'commerciale', 'transactionnelle', 'navigationnelle'] as const;
export type KeywordIntent = (typeof KEYWORD_INTENTS)[number];

export interface Keyword {
  id: string;
  keyword: string;
  intent: KeywordIntent;
  targetUrl: string;
  priority: 1 | 2 | 3;
  status: 'a-traiter' | 'en-cours' | 'optimise';
  positions: { date: string; position: number }[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClaudeSession {
  id: string;
  workspace: WorkspaceId;
  templateId: string | null;
  title: string;
  prompt: string;
  response: string;
  importedCount: number;
  createdAt: string;
}

export interface Brand {
  name: string;
  website: string;
  baseline: string;
  description: string;
  location: string;
  services: string;
  audiences: string;
  tone: string;
  avoid: string;
  defaultCta: string;
  hashtagSets: { name: string; tags: string }[];
  colors: { navy: string; amber: string; cream: string };
  visualRules: string;
}

export interface Meta {
  schemaVersion: 3;
  createdAt: string;
  lastChangeAt: string | null;
  lastBackupAt: string | null;
}

export interface AppState {
  meta: Meta;
  brand: Brand;
  campaigns: Campaign[];
  publications: Publication[];
  templates: Template[];
  performance: PerformanceEntry[];
  strategy: { notes: StrategyNote[]; goals: Goal[] };
  seo: { keywords: Keyword[]; checks: Record<string, boolean> };
  claude: ClaudeSession[];
}
