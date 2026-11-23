import { CAMPAIGN_STATUS_LABELS, CHANNEL_LABELS, FORMAT_LABELS, STATUS_LABELS, WORKSPACE_LABELS } from './labels';
import { toChannel, toDate } from './parseResponse';
import type { Campaign, PerformanceEntry, Publication } from './types';

/** CSV in the French Excel dialect: semicolon separator, UTF-8 BOM. */
export const SEP = ';';

/** Escapes a cell and neutralises spreadsheet formulas (=, +, -, @) to prevent CSV injection. */
export function csvCell(value: unknown): string {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[\s]*[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s.trim())) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  return '\uFEFF' + [headers, ...rows].map((r) => r.map(csvCell).join(SEP)).join('\r\n');
}

export function publicationsCSV(pubs: Publication[], campaigns: Campaign[]): string {
  const cname = (id: string | null) => campaigns.find((c) => c.id === id)?.name ?? '';
  return toCSV(
    ['Titre', 'Espace', 'Canal', 'Format', 'Statut', 'Campagne', 'Date prévue', 'Heure', 'Accroche', 'Texte', 'CTA', 'Hashtags', 'Brief visuel', 'Publié le', 'Lien', 'Notes'],
    pubs.map((p) => [
      p.title,
      WORKSPACE_LABELS[p.workspace],
      CHANNEL_LABELS[p.channel],
      FORMAT_LABELS[p.format],
      STATUS_LABELS[p.status],
      cname(p.campaignId),
      p.scheduledDate ?? '',
      p.scheduledTime ?? '',
      p.hook,
      p.body,
      p.cta,
      p.hashtags,
      p.visualBrief,
      p.publishedAt ?? '',
      p.publishedUrl,
      p.notes,
    ]),
  );
}

export function campaignsCSV(campaigns: Campaign[], pubs: Publication[]): string {
  return toCSV(
    ['Campagne', 'Statut', 'Début', 'Fin', 'Objectif', 'Cible', 'Message clé', 'Canaux', 'Indicateur visé', 'Publications', 'Publiées'],
    campaigns.map((c) => {
      const list = pubs.filter((p) => p.campaignId === c.id);
      return [
        c.name,
        CAMPAIGN_STATUS_LABELS[c.status],
        c.startDate ?? '',
        c.endDate ?? '',
        c.objective,
        c.audience,
        c.keyMessage,
        c.channels.map((x) => CHANNEL_LABELS[x]).join(', '),
        c.kpiTarget,
        list.length,
        list.filter((p) => p.status === 'publie').length,
      ];
    }),
  );
}

export function performanceCSV(entries: PerformanceEntry[], pubs: Publication[], campaigns: Campaign[]): string {
  return toCSV(
    ['Date', 'Canal', 'Publication', 'Campagne', 'Impressions', 'Couverture', 'Interactions', 'Clics', 'Visites du profil', 'Nouveaux abonnés', 'Demandes', 'Notes'],
    entries.map((e) => [
      e.date,
      CHANNEL_LABELS[e.channel],
      pubs.find((p) => p.id === e.publicationId)?.title ?? '',
      campaigns.find((c) => c.id === e.campaignId)?.name ?? '',
      e.impressions,
      e.reach,
      e.interactions,
      e.clicks,
      e.profileVisits,
      e.followersGained,
      e.enquiries,
      e.notes,
    ]),
  );
}

/** RFC 4180 parser with delimiter detection (; , or tab). */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] ?? '';
  const counts = [';', ',', '\t'].map((d) => [d, firstLine.split(d).length] as const);
  const delim = counts.sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const ALIASES: Record<string, string[]> = {
  date: ['date', 'jour', 'day', 'date de publication', 'publish time', 'heure de publication'],
  channel: ['canal', 'plateforme', 'platform', 'channel', 'reseau'],
  impressions: ['impressions', 'vues', 'views', 'affichages', 'nombre de vues'],
  reach: ['couverture', 'reach', 'portee', 'comptes touches', 'accounts reached'],
  interactions: ['interactions', 'engagement', 'engagements', 'interactions totales'],
  likes: ['j aime', 'likes', 'reactions', 'mentions j aime'],
  comments: ['commentaires', 'comments'],
  shares: ['partages', 'shares', 'republications'],
  saves: ['enregistrements', 'saves', 'sauvegardes'],
  clicks: ['clics', 'clicks', 'clics sur le lien', 'link clicks', 'clics sur le site web', 'website clicks'],
  profileVisits: ['visites du profil', 'profile visits', 'visites de profil', 'visites'],
  followersGained: ['nouveaux abonnes', 'abonnes', 'follows', 'followers', 'abonnements'],
  enquiries: ['demandes', 'contacts', 'leads', 'enquiries', 'messages', 'appels'],
  notes: ['notes', 'commentaire', 'remarques', 'titre', 'description'],
};

function num(v: string | undefined): number {
  if (!v) return 0;
  const cleaned = v.replace(/[\s\u00A0\u202F]/g, '').replace(/%$/, '');
  const normalized = /,\d{1,2}$/.test(cleaned) ? cleaned.replace(/\./g, '').replace(',', '.') : cleaned.replace(/,/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

export interface CSVImport {
  entries: Omit<PerformanceEntry, 'id' | 'createdAt'>[];
  warnings: string[];
  mapped: string[];
}

/** Imports statistics exported from Meta Business Suite, LinkedIn, Google or a hand-made sheet. */
export function importPerformanceCSV(text: string, fallbackChannel: PerformanceEntry['channel'] = 'instagram'): CSVImport {
  const rows = parseCSV(text);
  if (rows.length < 2) return { entries: [], warnings: ['Le fichier ne contient pas de lignes de données.'], mapped: [] };
  const headers = rows[0].map(norm);
  const col: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(ALIASES)) {
    const idx = headers.findIndex((h) => aliases.includes(h));
    const loose = idx === -1 ? headers.findIndex((h) => aliases.some((a) => a.length > 4 && h.includes(a))) : idx;
    if (loose !== -1 && !Object.values(col).includes(loose)) col[key] = loose;
  }
  const warnings: string[] = [];
  if (col.date === undefined) return { entries: [], warnings: ['Colonne « Date » introuvable.'], mapped: Object.keys(col) };
  const entries: CSVImport['entries'] = [];
  rows.slice(1).forEach((r, i) => {
    const date = toDate((r[col.date] ?? '').trim().slice(0, 19).replace(' ', 'T').split('T')[0]) ?? toDate(r[col.date]);
    if (!date) {
      warnings.push(`Ligne ${i + 2} ignorée : date illisible « ${r[col.date] ?? ''} ».`);
      return;
    }
    const get = (k: string) => (col[k] === undefined ? undefined : r[col[k]]);
    const interactions =
      col.interactions !== undefined ? num(get('interactions')) : num(get('likes')) + num(get('comments')) + num(get('shares')) + num(get('saves'));
    entries.push({
      date,
      channel: col.channel !== undefined && get('channel')?.trim() ? toChannel(get('channel')) : fallbackChannel,
      publicationId: null,
      campaignId: null,
      impressions: num(get('impressions')),
      reach: num(get('reach')),
      interactions,
      clicks: num(get('clicks')),
      profileVisits: num(get('profileVisits')),
      followersGained: num(get('followersGained')),
      enquiries: num(get('enquiries')),
      notes: (get('notes') ?? '').slice(0, 5000),
    });
  });
  if (entries.length > 5000) {
    warnings.push('Seules les 5 000 premières lignes ont été importées.');
    entries.length = 5000;
  }
  return { entries, warnings, mapped: Object.keys(col) };
}
