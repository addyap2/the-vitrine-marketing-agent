import { inRange } from './dates';
import { CHANNEL_LABELS, METRIC_LABELS } from './labels';
import type { Campaign, Channel, Goal, MetricKey, PerformanceEntry, Publication } from './types';
import { METRIC_KEYS } from './types';

export type Totals = Record<MetricKey, number> & { entries: number };

export function emptyTotals(): Totals {
  return { impressions: 0, reach: 0, interactions: 0, clicks: 0, profileVisits: 0, followersGained: 0, enquiries: 0, entries: 0 };
}

export function sumEntries(entries: PerformanceEntry[]): Totals {
  const t = emptyTotals();
  for (const e of entries) {
    for (const k of METRIC_KEYS) t[k] += Number(e[k]) || 0;
    t.entries++;
  }
  return t;
}

export function ratio(num: number, den: number): number | null {
  return den > 0 ? num / den : null;
}

export interface Rates {
  engagement: number | null;
  ctr: number | null;
  profileRate: number | null;
  enquiryPerVisit: number | null;
  enquiryPerThousand: number | null;
}

export function rates(t: Totals): Rates {
  const base = t.impressions || t.reach;
  const visits = t.profileVisits + t.clicks;
  return {
    engagement: ratio(t.interactions, base),
    ctr: ratio(t.clicks, base),
    profileRate: ratio(t.profileVisits, base),
    enquiryPerVisit: ratio(t.enquiries, visits),
    enquiryPerThousand: base > 0 ? (t.enquiries / base) * 1000 : null,
  };
}

export interface EntryFilter {
  from?: string | null;
  to?: string | null;
  channel?: Channel | 'tous';
  campaignId?: string | 'tous';
}

export function filterEntries(entries: PerformanceEntry[], f: EntryFilter): PerformanceEntry[] {
  return entries.filter(
    (e) =>
      inRange(e.date, f.from ?? null, f.to ?? null) &&
      (!f.channel || f.channel === 'tous' || e.channel === f.channel) &&
      (!f.campaignId || f.campaignId === 'tous' || e.campaignId === f.campaignId),
  );
}

export function groupBy<K extends string>(entries: PerformanceEntry[], key: (e: PerformanceEntry) => K): Map<K, Totals> {
  const map = new Map<K, PerformanceEntry[]>();
  for (const e of entries) {
    const k = key(e);
    map.set(k, [...(map.get(k) ?? []), e]);
  }
  return new Map([...map.entries()].map(([k, list]) => [k, sumEntries(list)]));
}

export function byMonth(entries: PerformanceEntry[]): { month: string; totals: Totals }[] {
  return [...groupBy(entries, (e) => e.date.slice(0, 7)).entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => ({ month, totals }));
}

export function goalProgress(goal: Goal, entries: PerformanceEntry[]): { current: number; ratio: number } {
  const relevant = filterEntries(entries, {
    from: goal.startDate,
    to: goal.endDate,
    channel: goal.channel,
    campaignId: goal.campaignId ?? 'tous',
  });
  const current = sumEntries(relevant)[goal.metric];
  return { current, ratio: goal.target > 0 ? Math.min(1, current / goal.target) : 0 };
}

export function topPublications(entries: PerformanceEntry[], pubs: Publication[], n = 5) {
  const byPub = groupBy(
    entries.filter((e) => e.publicationId),
    (e) => e.publicationId as string,
  );
  return [...byPub.entries()]
    .map(([id, totals]) => ({ pub: pubs.find((p) => p.id === id), totals, rate: rates(totals).engagement }))
    .filter((x) => x.pub)
    .sort((a, b) => b.totals.interactions - a.totals.interactions)
    .slice(0, n);
}

const nf = new Intl.NumberFormat('fr-FR');
const pf = new Intl.NumberFormat('fr-FR', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 });

export const formatNumber = (n: number) => nf.format(Math.round(n * 100) / 100);
export const formatPct = (r: number | null) => (r === null ? '—' : pf.format(r));

/** Plain-text digest for the "Analyse des performances" Claude prompt. */
export function dataDigest(entries: PerformanceEntry[], campaigns: Campaign[]): string {
  if (!entries.length) return '[Aucune statistique saisie pour cette période]';
  const t = sumEntries(entries);
  const r = rates(t);
  const lines = [
    `Nombre de relevés : ${t.entries}`,
    ...METRIC_KEYS.map((k) => `${METRIC_LABELS[k]} : ${formatNumber(t[k])}`),
    `Taux d’engagement (interactions / impressions) : ${formatPct(r.engagement)}`,
    `Taux de clic : ${formatPct(r.ctr)}`,
    `Demandes pour 1 000 impressions : ${r.enquiryPerThousand === null ? '—' : formatNumber(r.enquiryPerThousand)}`,
    '',
    'Par canal :',
  ];
  for (const [ch, tot] of groupBy(entries, (e) => e.channel)) {
    lines.push(
      `- ${CHANNEL_LABELS[ch]} : ${formatNumber(tot.impressions)} impressions, ${formatNumber(tot.interactions)} interactions, ${formatNumber(tot.clicks)} clics, ${formatNumber(tot.enquiries)} demandes (engagement ${formatPct(rates(tot).engagement)})`,
    );
  }
  const withCampaign = entries.filter((e) => e.campaignId);
  if (withCampaign.length) {
    lines.push('', 'Par campagne :');
    for (const [cid, tot] of groupBy(withCampaign, (e) => e.campaignId as string)) {
      const name = campaigns.find((c) => c.id === cid)?.name ?? 'Campagne supprimée';
      lines.push(`- ${name} : ${formatNumber(tot.impressions)} impressions, ${formatNumber(tot.interactions)} interactions, ${formatNumber(tot.enquiries)} demandes`);
    }
  }
  const months = byMonth(entries);
  if (months.length > 1) {
    lines.push('', 'Par mois :');
    for (const m of months) lines.push(`- ${m.month} : ${formatNumber(m.totals.impressions)} impressions, ${formatNumber(m.totals.interactions)} interactions, ${formatNumber(m.totals.enquiries)} demandes`);
  }
  return lines.join('\n');
}
