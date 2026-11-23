/** Pure offline marketing helpers. No remote calls, trackers or API keys. */
export type Metrics = { impressions: number; interactions: number; profileVisits: number; enquiries: number };
export function analyseMetrics(m: Metrics) {
  const rate = (num: number, den: number) => den > 0 ? `${(100 * num / den).toFixed(2).replace('.', ',')} %` : '—';
  return [
    { label: 'Taux d’engagement / impressions', value: rate(m.interactions, m.impressions) },
    { label: 'Visites du profil / impressions', value: rate(m.profileVisits, m.impressions) },
    { label: 'Demandes / visites du profil', value: rate(m.enquiries, m.profileVisits) },
    { label: 'Demandes / impressions', value: rate(m.enquiries, m.impressions) },
  ];
}
export function checkPublication(content: string) {
  const value = content.trim();
  const words = value ? value.split(/\s+/).length : 0;
  return {
    words,
    characters: value.length,
    checks: [
      { label: 'Accroche présente', ok: value.split('\n').some(line => line.trim().length >= 15) },
      { label: 'Appel à l’action', ok: /contact|découvr|écriv|réserv|demandez|parlons|visitez|lien en bio|message|devis|audit/i.test(value) },
      { label: 'Longueur suffisante', ok: words >= 25 },
      { label: 'Longueur raisonnable pour Instagram', ok: value.length <= 2200 },
    ],
  };
}
export function csvSafe(value: string) {
  const safe = /^[\s]*[=+@\-\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}