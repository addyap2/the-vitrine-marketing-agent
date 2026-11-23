import { isValidDate, isValidTime, pad } from './dates';
import type { Channel, Format, KeywordIntent } from './types';

/** Parses answers pasted back from Claude. Tolerant of key spelling, accents and minor JSON slips. */

export interface ParsedPublication {
  title: string;
  channel: Channel;
  format: Format;
  scheduledDate: string | null;
  scheduledTime: string | null;
  hook: string;
  body: string;
  cta: string;
  hashtags: string;
  visualBrief: string;
  notes: string;
}

export interface ParsedKeyword {
  keyword: string;
  intent: KeywordIntent;
  targetUrl: string;
  priority: 1 | 2 | 3;
  notes: string;
}

export interface ParseResult<T> {
  items: T[];
  warnings: string[];
}

const normKey = (k: string) =>
  k
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    try {
      // Common slips: trailing commas, curly quotes used as JSON quotes.
      const fixed = s.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"');
      return JSON.parse(fixed);
    } catch {
      return undefined;
    }
  }
}

/** Returns the last JSON value found in fenced code blocks, or a bare array/object in the text. */
export function extractJson(text: string): unknown {
  const blocks = [...text.matchAll(/```(?:json|JSON)?\s*\n?([\s\S]*?)```/g)].map((m) => m[1].trim());
  for (const b of blocks.reverse()) {
    if (!/^[[{]/.test(b)) continue;
    const v = tryParse(b);
    if (v !== undefined) return v;
  }
  const firstArr = text.indexOf('[');
  const lastArr = text.lastIndexOf(']');
  if (firstArr !== -1 && lastArr > firstArr) {
    const v = tryParse(text.slice(firstArr, lastArr + 1));
    if (v !== undefined) return v;
  }
  const firstObj = text.indexOf('{');
  const lastObj = text.lastIndexOf('}');
  if (firstObj !== -1 && lastObj > firstObj) {
    const v = tryParse(text.slice(firstObj, lastObj + 1));
    if (v !== undefined) return v;
  }
  return undefined;
}

function toList(v: unknown): Record<string, unknown>[] {
  if (Array.isArray(v)) return v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x));
  if (v && typeof v === 'object') {
    const obj = v as Record<string, unknown>;
    for (const key of Object.keys(obj)) {
      if (Array.isArray(obj[key])) return toList(obj[key]);
    }
    return [obj];
  }
  return [];
}

function pick(obj: Record<string, unknown>, aliases: string[]): unknown {
  const map = new Map(Object.entries(obj).map(([k, v]) => [normKey(k), v]));
  for (const a of aliases) if (map.has(a)) return map.get(a);
  return undefined;
}

function text(v: unknown, max = 100_000): string {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.map((x) => text(x)).filter(Boolean).join('\n').slice(0, max);
  if (typeof v === 'object') return JSON.stringify(v, null, 2).slice(0, max);
  return String(v).replace(/\\n/g, '\n').trim().slice(0, max);
}

export function toChannel(v: unknown): Channel {
  const s = normKey(String(v ?? ''));
  if (!s) return 'instagram';
  if (s.includes('insta') || s === 'ig') return 'instagram';
  if (s.includes('facebook') || s === 'fb') return 'facebook';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('google') || s === 'gbp' || s.includes('fiche')) return 'google';
  if (s.includes('blog') || s.includes('site') || s.includes('web')) return 'blog';
  if (s.includes('newsletter') || s.includes('mail')) return 'newsletter';
  if (s.includes('tiktok')) return 'tiktok';
  if (s.includes('pinterest')) return 'pinterest';
  if (s.includes('youtube') || s.includes('short')) return 'youtube';
  return 'autre';
}

export function toFormat(v: unknown, channel?: Channel): Format {
  const s = normKey(String(v ?? ''));
  if (s.includes('carrousel') || s.includes('carousel')) return 'carrousel';
  if (s.includes('reel')) return 'reel';
  if (s.includes('stor')) return 'story';
  if (s.includes('video') || s.includes('short')) return 'video';
  if (s.includes('visuel') || s.includes('image') || s.includes('photo')) return 'visuel';
  if (s.includes('article') || s.includes('blog')) return 'article';
  if (s.includes('fiche') || s.includes('google')) return 'fiche';
  if (s.includes('mail') || s.includes('newsletter')) return 'email';
  if (s.includes('page')) return 'page';
  if (s.includes('document')) return 'document';
  if (!s) return channel === 'blog' ? 'article' : channel === 'google' ? 'fiche' : 'post';
  return 'post';
}

export function toDate(v: unknown): string | null {
  const s = String(v ?? '').trim();
  if (isValidDate(s)) return s;
  const fr = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (fr) {
    const iso = `${fr[3]}-${pad(Number(fr[2]))}-${pad(Number(fr[1]))}`;
    if (isValidDate(iso)) return iso;
  }
  const isoPrefix = s.match(/^(\d{4}-\d{2}-\d{2})T/);
  if (isoPrefix && isValidDate(isoPrefix[1])) return isoPrefix[1];
  return null;
}

export function toTime(v: unknown): string | null {
  const s = String(v ?? '').trim().toLowerCase();
  const m = s.match(/^(\d{1,2})\s*[:h]\s*(\d{2})?$/);
  if (!m) return null;
  const t = `${pad(Number(m[1]))}:${m[2] ?? '00'}`;
  return isValidTime(t) ? t : null;
}

function hashtagsText(v: unknown): string {
  if (Array.isArray(v)) return v.map((h) => String(h).trim()).filter(Boolean).map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ');
  return text(v, 5000);
}

export function parsePublications(response: string): ParseResult<ParsedPublication> {
  const warnings: string[] = [];
  const json = extractJson(response);
  const list = toList(json);
  if (!list.length) {
    return { items: [], warnings: ['Aucun bloc JSON exploitable n’a été trouvé dans la réponse.'] };
  }
  const items = list.slice(0, 200).map((o, i): ParsedPublication => {
    const channel = toChannel(pick(o, ['canal', 'channel', 'plateforme', 'platform', 'reseau']));
    const rawDate = pick(o, ['date', 'date_de_publication', 'jour', 'publish_date']);
    const scheduledDate = toDate(rawDate);
    if (rawDate && !scheduledDate) warnings.push(`Élément ${i + 1} : date « ${String(rawDate)} » ignorée (format attendu AAAA-MM-JJ).`);
    const body = text(pick(o, ['texte', 'text', 'body', 'contenu', 'content', 'legende', 'caption', 'publication', 'article']));
    const hook = text(pick(o, ['accroche', 'hook', 'titre_seo', 'seo_title']), 5000);
    const title =
      text(pick(o, ['titre', 'title', 'nom', 'name', 'sujet', 'theme']), 500) || hook.slice(0, 80) || body.slice(0, 60) || `Contenu ${i + 1}`;
    return {
      title,
      channel,
      format: toFormat(pick(o, ['format', 'type']), channel),
      scheduledDate,
      scheduledTime: toTime(pick(o, ['heure', 'time', 'horaire', 'hour'])),
      hook,
      body,
      cta: text(pick(o, ['cta', 'appel_a_l_action', 'call_to_action', 'meta_description']), 5000),
      hashtags: hashtagsText(pick(o, ['hashtags', 'tags', 'mots_dieses'])),
      visualBrief: text(pick(o, ['brief_visuel', 'visuel', 'visual', 'visual_brief', 'prompt', 'prompt_visuel', 'storyboard'])),
      notes: text(pick(o, ['notes', 'note', 'remarques', 'commentaires'])),
    };
  });
  if (list.length > 200) warnings.push('Seuls les 200 premiers éléments ont été conservés.');
  return { items, warnings };
}

const INTENTS: KeywordIntent[] = ['locale', 'informationnelle', 'commerciale', 'transactionnelle', 'navigationnelle'];

export function parseKeywords(response: string): ParseResult<ParsedKeyword> {
  const list = toList(extractJson(response));
  if (!list.length) return { items: [], warnings: ['Aucun bloc JSON exploitable n’a été trouvé dans la réponse.'] };
  const items: ParsedKeyword[] = [];
  const warnings: string[] = [];
  list.slice(0, 500).forEach((o, i) => {
    const keyword = text(pick(o, ['mot_cle', 'keyword', 'mot_clef', 'requete', 'query', 'mots_cles']), 300);
    if (!keyword) {
      warnings.push(`Élément ${i + 1} ignoré : mot-clé manquant.`);
      return;
    }
    const intentRaw = normKey(text(pick(o, ['intention', 'intent', 'type'])));
    const intent = INTENTS.find((x) => intentRaw.startsWith(x.slice(0, 5))) ?? (intentRaw.startsWith('local') ? 'locale' : 'informationnelle');
    const p = Number(pick(o, ['priorite', 'priority']));
    items.push({
      keyword,
      intent,
      targetUrl: text(pick(o, ['page_cible', 'target_url', 'url', 'page']), 2000),
      priority: p === 1 || p === 3 ? p : 2,
      notes: text(pick(o, ['notes', 'note', 'commentaire']), 5000),
    });
  });
  return { items, warnings };
}

export function parseDocument(response: string): { title: string; content: string } {
  const lines = response.replace(/\r\n/g, '\n').trim().split('\n');
  let title = '';
  const idx = lines.findIndex((l) => /^\s*\**\s*titre\s*:/i.test(l));
  if (idx !== -1 && idx < 5) {
    title = lines[idx].replace(/^\s*\**\s*titre\s*:\s*/i, '').replace(/\*+$/, '').trim();
    lines.splice(idx, 1);
  } else {
    const h = lines.find((l) => /^#{1,3}\s+/.test(l));
    if (h) title = h.replace(/^#{1,3}\s+/, '').trim();
  }
  return { title: title.slice(0, 300) || 'Document Claude', content: lines.join('\n').trim() };
}

export function parseRevision(response: string): Partial<Pick<ParsedPublication, 'hook' | 'body' | 'cta' | 'hashtags' | 'visualBrief'>> | null {
  const list = toList(extractJson(response));
  const o = list[0];
  if (!o) return null;
  const out: Partial<Pick<ParsedPublication, 'hook' | 'body' | 'cta' | 'hashtags' | 'visualBrief'>> = {};
  const hook = pick(o, ['accroche', 'hook']);
  const body = pick(o, ['texte', 'text', 'body', 'contenu', 'legende']);
  const cta = pick(o, ['cta', 'appel_a_l_action']);
  const tags = pick(o, ['hashtags', 'tags']);
  const visual = pick(o, ['brief_visuel', 'visuel', 'visual_brief']);
  if (hook !== undefined) out.hook = text(hook, 5000);
  if (body !== undefined) out.body = text(body);
  if (cta !== undefined) out.cta = text(cta, 5000);
  if (tags !== undefined) out.hashtags = hashtagsText(tags);
  if (visual !== undefined) out.visualBrief = text(visual);
  return Object.keys(out).length ? out : null;
}
