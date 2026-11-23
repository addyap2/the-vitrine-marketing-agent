import { CHANNEL_LABELS, CHANNEL_LIMITS } from './labels';
import type { Publication } from './types';

export type CheckLevel = 'ok' | 'warning' | 'error';

export interface Check {
  label: string;
  level: CheckLevel;
  detail?: string;
}

export interface QAResult {
  checks: Check[];
  characters: number;
  words: number;
  hashtagCount: number;
  errors: number;
  warnings: number;
}

const VISUAL_FORMATS = ['carrousel', 'reel', 'story', 'video', 'visuel'];
const CTA_RE = /contact|découvr|écriv|réserv|demand|parlons|visitez|lien en bio|message|devis|audit|appel|rendez-vous|inscri|télécharg|en savoir plus/i;
const RISKY_RE = /\b(garanti[es]?|n°\s?1|numéro un|le meilleur|la meilleure|les meilleurs|100\s?%|premier sur google|1re position|résultats assurés)\b/i;

/** Assembles the text as it would be pasted into the network. */
export function composeForPosting(p: Pick<Publication, 'hook' | 'body' | 'cta' | 'hashtags'>): string {
  const parts = [p.hook.trim(), p.body.trim(), p.cta.trim(), p.hashtags.trim()].filter(Boolean);
  // Avoid repeating the hook if the body already starts with it.
  if (p.hook.trim() && p.body.trim().startsWith(p.hook.trim())) parts.shift();
  return parts.join('\n\n');
}

export function checkPublication(p: Publication): QAResult {
  const full = composeForPosting(p);
  const characters = [...full].length;
  const words = full.trim() ? full.trim().split(/\s+/).length : 0;
  const hashtagCount = (full.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
  const checks: Check[] = [];
  const add = (label: string, level: CheckLevel, detail?: string) => checks.push({ label, level, detail });
  const isVisual = VISUAL_FORMATS.includes(p.format);

  if (!full.trim() && !(isVisual && p.visualBrief.trim())) add('Contenu rédigé', 'error', 'Le texte est vide.');
  else add('Contenu rédigé', 'ok');

  const firstLine = (p.hook.trim() || p.body.trim().split('\n')[0] || '').trim();
  if (firstLine.length >= 15) add('Accroche en première ligne', 'ok');
  else add('Accroche en première ligne', 'warning', 'La première ligne doit donner envie de lire la suite (15 caractères minimum).');

  if (p.channel === 'instagram' && firstLine.length > 125) {
    add('Accroche visible avant « plus »', 'warning', 'Instagram coupe la légende vers 125 caractères : raccourcissez la première phrase.');
  }

  if (p.cta.trim() || CTA_RE.test(full)) add('Appel à l’action', 'ok');
  else add('Appel à l’action', 'warning', 'Indiquez ce que le lecteur doit faire ensuite.');

  const limit = CHANNEL_LIMITS[p.channel];
  if (limit && characters > limit) add(`Longueur ${CHANNEL_LABELS[p.channel]}`, 'error', `${characters} caractères pour ${limit} autorisés.`);
  else if (limit) add(`Longueur ${CHANNEL_LABELS[p.channel]}`, 'ok', `${characters} / ${limit} caractères`);

  if (p.channel === 'instagram' && hashtagCount > 30) add('Hashtags', 'error', `${hashtagCount} hashtags : Instagram en accepte 30 au maximum.`);
  else if (['instagram', 'linkedin', 'tiktok'].includes(p.channel) && hashtagCount > 8)
    add('Hashtags', 'warning', `${hashtagCount} hashtags : 3 à 8 hashtags ciblés suffisent.`);
  else if (p.channel === 'google' && hashtagCount > 0) add('Hashtags', 'warning', 'Les hashtags sont inutiles sur une fiche Google.');
  else add('Hashtags', 'ok', `${hashtagCount} hashtag${hashtagCount > 1 ? 's' : ''}`);

  if (/\[(À VÉRIFIER|A VERIFIER|à vérifier)[^\]]*\]|\[[a-zà-ÿ_ ]{2,30}\]/i.test(full + p.visualBrief)) {
    add('Éléments à compléter', 'warning', 'Le texte contient des crochets [à vérifier] ou des champs non remplis.');
  } else add('Éléments à compléter', 'ok');

  if (RISKY_RE.test(full)) add('Promesses vérifiables', 'warning', 'Formulation risquée (garantie, « le meilleur », 100 %…) : reformulez avec des faits vérifiables.');
  else add('Promesses vérifiables', 'ok');

  if (p.channel === 'instagram' && /https?:\/\//.test(p.body)) {
    add('Liens', 'warning', 'Les liens ne sont pas cliquables dans une légende Instagram : utilisez « lien en bio ».');
  }

  if (isVisual) {
    if (p.visualBrief.trim()) add('Brief visuel', 'ok');
    else add('Brief visuel', 'warning', 'Ce format a besoin d’un brief ou d’un prompt visuel.');
  }

  if (!p.scheduledDate && !['publie', 'archive'].includes(p.status)) add('Date prévue', 'warning', 'Aucune date : la publication n’apparaît pas au calendrier.');

  return {
    checks,
    characters,
    words,
    hashtagCount,
    errors: checks.filter((c) => c.level === 'error').length,
    warnings: checks.filter((c) => c.level === 'warning').length,
  };
}
