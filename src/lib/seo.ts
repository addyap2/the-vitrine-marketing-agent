import type { Brand } from './types';

export interface LengthCheck {
  length: number;
  min: number;
  max: number;
  level: 'ok' | 'court' | 'long';
}

const check = (s: string, min: number, max: number): LengthCheck => {
  const length = [...s.trim()].length;
  return { length, min, max, level: length < min ? 'court' : length > max ? 'long' : 'ok' };
};

export const titleCheck = (s: string) => check(s, 30, 60);
export const descriptionCheck = (s: string) => check(s, 70, 155);

export function truncateSerp(s: string, max: number): string {
  const chars = [...s.trim()];
  return chars.length > max ? chars.slice(0, max - 1).join('').trimEnd() + '…' : chars.join('');
}

export function displayUrl(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    const path = u.pathname.replace(/\/$/, '').split('/').filter(Boolean);
    return [u.hostname.replace(/^www\./, ''), ...path].join(' › ');
  } catch {
    return url;
  }
}

export interface ChecklistItem {
  id: string;
  label: string;
  help: string;
}

export interface ChecklistGroup {
  title: string;
  items: ChecklistItem[];
}

/** Practical, free-to-implement checklist for local SEO and generative engine optimisation (GEO). */
export const GEO_CHECKLIST: ChecklistGroup[] = [
  {
    title: 'Fondations techniques',
    items: [
      { id: 'tech-https', label: 'Site en HTTPS, rapide sur mobile', help: 'Vérifiez avec PageSpeed Insights (gratuit).' },
      { id: 'tech-sitemap', label: 'Sitemap XML déclaré dans Google Search Console', help: 'Search Console est gratuit et indique les pages indexées.' },
      { id: 'tech-robots', label: 'robots.txt n’empêche pas les robots IA utiles', help: 'Autorisez Googlebot, Bingbot, OAI-SearchBot, PerplexityBot si vous voulez être cité.' },
      { id: 'tech-llms', label: 'Fichier llms.txt publié', help: 'Un résumé en Markdown de vos pages clés, à la racine du site.' },
      { id: 'tech-schema', label: 'Données structurées LocalBusiness / ProfessionalService', help: 'Nom, adresse, téléphone, zone desservie, horaires. Générateur ci-dessous.' },
    ],
  },
  {
    title: 'Contenu citable par les IA',
    items: [
      { id: 'content-answer', label: 'Chaque page commence par une réponse directe en 2 phrases', help: 'Les moteurs de réponse reprennent les définitions claires.' },
      { id: 'content-faq', label: 'FAQ visible + balisage FAQPage sur les pages de service', help: 'Questions réellement posées par vos clients.' },
      { id: 'content-facts', label: 'Faits vérifiables : délais, méthode, zone, technologies', help: 'Pas de chiffres inventés ; datez les informations.' },
      { id: 'content-entities', label: 'Entités nommées cohérentes (ville, services, marque)', help: 'Toujours les mêmes noms de services et de lieux.' },
      { id: 'content-author', label: 'Page « À propos » avec les personnes derrière la marque', help: 'Expérience, rôle, liens vers profils publics.' },
    ],
  },
  {
    title: 'Autorité et cohérence locale',
    items: [
      { id: 'local-nap', label: 'Nom, adresse, téléphone identiques partout (NAP)', help: 'Site, fiche Google, Pages Jaunes, réseaux sociaux.' },
      { id: 'local-directories', label: 'Présence dans 5 annuaires locaux ou professionnels', help: 'Gratuits : PagesJaunes, Bing Places, Apple Business Connect, annuaires de la ville ou CCI.' },
      { id: 'local-mentions', label: 'Mentions ou liens depuis des sites locaux', help: 'Partenaires, associations, presse locale, clients (avec leur accord).' },
    ],
  },
  {
    title: 'Fiche d’établissement Google',
    items: [
      { id: 'gbp-complete', label: 'Fiche complète : catégories, services, zone, horaires', help: 'Catégorie principale « Concepteur de sites Web ».' },
      { id: 'gbp-posts', label: 'Une actualité publiée chaque semaine', help: 'Planifiez-les dans le calendrier (canal « Fiche Google »).' },
      { id: 'gbp-photos', label: 'Photos récentes et réelles chaque mois', help: 'Locaux, équipe (avec accord), captures de projets.' },
      { id: 'gbp-reviews', label: 'Réponse à chaque avis sous 48 h', help: 'Ne jamais acheter ni rédiger de faux avis.' },
    ],
  },
];

export const ALL_CHECK_IDS = GEO_CHECKLIST.flatMap((g) => g.items.map((i) => i.id));

export function checklistProgress(checks: Record<string, boolean>): { done: number; total: number } {
  return { done: ALL_CHECK_IDS.filter((id) => checks[id]).length, total: ALL_CHECK_IDS.length };
}

export function faqJsonLd(pairs: { q: string; a: string }[]): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: pairs
      .filter((p) => p.q.trim() && p.a.trim())
      .map((p) => ({ '@type': 'Question', name: p.q.trim(), acceptedAnswer: { '@type': 'Answer', text: p.a.trim() } })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}

export interface BusinessInfo {
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  areas: string;
}

export function localBusinessJsonLd(brand: Brand, info: BusinessInfo): string {
  const data: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: brand.name,
    url: brand.website,
    description: brand.description,
  };
  if (info.phone.trim()) data.telephone = info.phone.trim();
  if (info.city.trim()) {
    data.address = {
      '@type': 'PostalAddress',
      ...(info.street.trim() ? { streetAddress: info.street.trim() } : {}),
      ...(info.postalCode.trim() ? { postalCode: info.postalCode.trim() } : {}),
      addressLocality: info.city.trim(),
      addressCountry: 'FR',
    };
  }
  const areas = info.areas
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  if (areas.length) data.areaServed = areas.map((name) => ({ '@type': 'Place', name }));
  const services = brand.services.split('\n').map((s) => s.trim()).filter(Boolean);
  if (services.length) {
    data.hasOfferCatalog = {
      '@type': 'OfferCatalog',
      name: 'Services',
      itemListElement: services.map((name) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name } })),
    };
  }
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}
