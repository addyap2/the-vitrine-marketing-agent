import type {
  CampaignStatus,
  Channel,
  Format,
  KeywordIntent,
  MetricKey,
  NoteKind,
  PubStatus,
  WorkspaceId,
} from './types';

export const WORKSPACE_LABELS: Record<WorkspaceId, string> = {
  strategy: 'Stratégie',
  social: 'Réseaux sociaux',
  creative: 'Création',
  calendar: 'Calendrier éditorial',
  seo: 'SEO & GEO',
  analytics: 'Analyses',
};

export const WORKSPACE_DESCRIPTIONS: Record<WorkspaceId, string> = {
  strategy: 'Positionnement, personas, objectifs mesurables et plans de campagne.',
  social: 'Publications Instagram, Facebook, LinkedIn et Google, du brouillon à la mise en ligne.',
  creative: 'Briefs visuels, prompts image et vidéo, storyboards de Reels.',
  calendar: 'Planning mensuel, glisser-déposer, rappels exportables vers votre agenda.',
  seo: 'Mots-clés suivis, aperçu Google, FAQ structurée et visibilité dans les IA.',
  analytics: 'Saisie ou import CSV des statistiques, ratios, objectifs et tendances.',
};

export const CHANNEL_LABELS: Record<Channel, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  google: 'Fiche Google',
  blog: 'Site / blog',
  newsletter: 'Newsletter',
  tiktok: 'TikTok',
  pinterest: 'Pinterest',
  youtube: 'YouTube',
  autre: 'Autre',
};

/** Practical text limits used by the publication checklist. */
export const CHANNEL_LIMITS: Partial<Record<Channel, number>> = {
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  google: 1500,
  tiktok: 2200,
  pinterest: 500,
  youtube: 5000,
};

export const FORMAT_LABELS: Record<Format, string> = {
  post: 'Publication',
  carrousel: 'Carrousel',
  reel: 'Reel',
  story: 'Story',
  video: 'Vidéo',
  visuel: 'Visuel',
  article: 'Article',
  fiche: 'Actualité Google',
  email: 'E-mail',
  page: 'Page web',
  document: 'Document',
  autre: 'Autre',
};

export const STATUS_LABELS: Record<PubStatus, string> = {
  idee: 'Idée',
  brouillon: 'Brouillon',
  relecture: 'En relecture',
  corrections: 'À corriger',
  approuve: 'Approuvé',
  programme: 'Programmé',
  publie: 'Publié',
  archive: 'Archivé',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  idee: 'Idée',
  planifiee: 'Planifiée',
  active: 'Active',
  pause: 'En pause',
  terminee: 'Terminée',
};

export const METRIC_LABELS: Record<MetricKey, string> = {
  impressions: 'Impressions / vues',
  reach: 'Couverture',
  interactions: 'Interactions',
  clicks: 'Clics',
  profileVisits: 'Visites du profil',
  followersGained: 'Nouveaux abonnés',
  enquiries: 'Demandes de contact',
};

export const NOTE_KIND_LABELS: Record<NoteKind, string> = {
  positionnement: 'Positionnement',
  persona: 'Persona',
  swot: 'SWOT',
  plan: 'Plan d’action',
  message: 'Messages clés',
  concurrent: 'Veille concurrentielle',
  autre: 'Autre',
};

export const INTENT_LABELS: Record<KeywordIntent, string> = {
  locale: 'Locale',
  informationnelle: 'Informationnelle',
  commerciale: 'Commerciale',
  transactionnelle: 'Transactionnelle',
  navigationnelle: 'Navigationnelle',
};

export const KEYWORD_STATUS_LABELS = {
  'a-traiter': 'À traiter',
  'en-cours': 'En cours',
  optimise: 'Optimisé',
} as const;
