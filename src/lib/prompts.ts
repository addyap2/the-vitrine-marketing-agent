import { CHANNEL_LABELS, FORMAT_LABELS, WORKSPACE_LABELS } from './labels';
import { renderTemplate } from './templates';
import type { Brand, Campaign, Publication, PromptOutput, Template, WorkspaceId } from './types';
import { CHANNELS, FORMATS } from './types';

/**
 * Prompts for the manual Claude Pro workflow: the app builds the prompt, you paste it
 * into claude.ai, then paste Claude's answer back. No API, no key, nothing is sent by the app.
 */

export const CLAUDE_URL = 'https://claude.ai/new';

const ROLES: Record<WorkspaceId, string> = {
  strategy:
    'Tu es directeur·rice de la stratégie marketing d’un studio web français. Tu fais des recommandations concrètes, priorisées et réalistes pour une petite structure sans budget publicitaire important.',
  social:
    'Tu es social media manager francophone expérimenté. Tu écris des publications utiles, crédibles et distinctives pour Instagram, Facebook, LinkedIn et Google.',
  creative:
    'Tu es directeur·rice artistique. Tu conçois des briefs visuels précis et des prompts prêts à copier pour des générateurs d’images et de vidéos, en respectant strictement la charte de la marque.',
  calendar:
    'Tu es responsable éditorial. Tu construis des plannings réalistes, réguliers et variés, adaptés à une petite équipe.',
  seo: 'Tu es consultant·e SEO local et GEO (visibilité dans les moteurs de réponse IA) spécialisé·e dans les TPE/PME françaises.',
  analytics:
    'Tu es analyste marketing. Tu travailles uniquement à partir des chiffres fournis, tu montres tes calculs et tu proposes des tests mesurables.',
};

export function brandBlock(brand: Brand, workspace?: WorkspaceId): string {
  const lines = [
    `- Marque : ${brand.name} (${brand.website})`,
    brand.baseline && `- Promesse : ${brand.baseline}`,
    brand.description && `- Activité : ${brand.description}`,
    brand.location && `- Zone : ${brand.location}`,
    brand.services && `- Services :\n${brand.services.split('\n').filter(Boolean).map((s) => `  • ${s.trim()}`).join('\n')}`,
    brand.audiences && `- Cibles : ${brand.audiences}`,
    brand.tone && `- Ton : ${brand.tone}`,
    brand.avoid && `- À ne jamais faire : ${brand.avoid}`,
    brand.defaultCta && `- Appel à l’action par défaut : ${brand.defaultCta}`,
    (workspace === 'creative' || workspace === 'social') && brand.visualRules && `- Règles visuelles : ${brand.visualRules}`,
  ];
  return lines.filter(Boolean).join('\n');
}

export function campaignBlock(c: Campaign): string {
  return [
    `- Nom : ${c.name}`,
    c.objective && `- Objectif : ${c.objective}`,
    c.audience && `- Cible : ${c.audience}`,
    c.keyMessage && `- Message clé : ${c.keyMessage}`,
    c.channels.length && `- Canaux : ${c.channels.map((x) => CHANNEL_LABELS[x]).join(', ')}`,
    (c.startDate || c.endDate) && `- Période : ${c.startDate ?? '?'} → ${c.endDate ?? '?'}`,
    c.kpiTarget && `- Indicateur visé : ${c.kpiTarget}`,
  ]
    .filter(Boolean)
    .join('\n');
}

const PUB_KEYS = `"titre", "canal", "format", "date", "heure", "accroche", "texte", "cta", "hashtags", "brief_visuel", "notes"`;

export function outputContract(output: PromptOutput): string {
  switch (output) {
    case 'publications':
      return [
        'Commence par un résumé de 3 lignes maximum, puis termine OBLIGATOIREMENT par un unique bloc de code ```json contenant un tableau d’objets, un objet par contenu, avec exactement ces clés :',
        PUB_KEYS + '.',
        `- "canal" : une valeur parmi ${CHANNELS.join(', ')}.`,
        `- "format" : une valeur parmi ${FORMATS.join(', ')}.`,
        '- "date" : "AAAA-MM-JJ" ou null ; "heure" : "HH:MM" ou null.',
        '- "hashtags" : une chaîne, hashtags séparés par des espaces (vide si non pertinent).',
        '- Utilise \\n pour les retours à la ligne dans les valeurs. JSON strict : pas de commentaires, pas de virgule finale.',
      ].join('\n');
    case 'mots-cles':
      return [
        'Commence par un résumé de 3 lignes maximum, puis termine OBLIGATOIREMENT par un unique bloc de code ```json contenant un tableau d’objets avec exactement ces clés :',
        '"mot_cle", "intention" (locale, informationnelle, commerciale, transactionnelle ou navigationnelle), "page_cible", "priorite" (1, 2 ou 3), "notes".',
        'JSON strict : pas de commentaires, pas de virgule finale.',
      ].join('\n');
    case 'document':
      return 'Réponds en Markdown structuré (titres ##, listes). La toute première ligne doit être « TITRE : » suivi d’un titre court pour ce document.';
    case 'texte':
      return 'Réponds directement avec le texte demandé, prêt à être relu, sans introduction.';
  }
}

const RULES = [
  'Écris en français de France, avec un ton professionnel, humain et clair ; vouvoiement.',
  'N’invente ni chiffres, ni avis clients, ni tarifs, ni résultats, ni récompenses. Si une information manque, signale-la entre crochets [À VÉRIFIER : …].',
  'Distingue ce qui est un fait de ce qui est une hypothèse.',
  'Ne prétends jamais avoir publié, programmé, envoyé ou consulté quoi que ce soit en ligne.',
  'Évite les clichés publicitaires et les emojis en excès (2 maximum par publication).',
];

export interface PromptInput {
  brand: Brand;
  template: Template;
  values: Record<string, string>;
  campaign?: Campaign | null;
  extra?: string;
}

export function buildClaudePrompt({ brand, template, values, campaign, extra }: PromptInput): string {
  const parts = [
    `# Rôle — ${WORKSPACE_LABELS[template.workspace]}`,
    ROLES[template.workspace],
    '',
    `# Contexte de marque`,
    brandBlock(brand, template.workspace),
  ];
  if (campaign) parts.push('', '# Campagne concernée', campaignBlock(campaign));
  parts.push('', '# Demande', renderTemplate(template.body, values, brand).trim());
  if (template.channel || template.format) {
    parts.push(
      `Canal par défaut : ${template.channel ? CHANNEL_LABELS[template.channel] : 'au choix'} ; format par défaut : ${template.format ? FORMAT_LABELS[template.format] : 'au choix'}.`,
    );
  }
  if (extra?.trim()) parts.push('', '# Informations complémentaires', extra.trim());
  parts.push('', '# Format de réponse', outputContract(template.output), '', '# Règles', ...RULES.map((r) => `- ${r}`));
  return parts.join('\n');
}

export function buildRevisionPrompt(brand: Brand, pub: Publication, instruction: string): string {
  const current = JSON.stringify(
    { accroche: pub.hook, texte: pub.body, cta: pub.cta, hashtags: pub.hashtags, brief_visuel: pub.visualBrief },
    null,
    2,
  );
  return [
    `# Rôle — ${WORKSPACE_LABELS[pub.workspace]}`,
    ROLES[pub.workspace],
    '',
    '# Contexte de marque',
    brandBlock(brand, pub.workspace),
    '',
    `# Publication à améliorer (${CHANNEL_LABELS[pub.channel]} · ${FORMAT_LABELS[pub.format]})`,
    `Titre interne : ${pub.title}`,
    '```json',
    current,
    '```',
    '',
    '# Ce qu’il faut changer',
    instruction.trim() || 'Rends ce texte plus clair, plus concret et plus engageant, sans changer le fond.',
    '',
    '# Format de réponse',
    'Explique en 2 lignes maximum ce que tu as changé, puis termine par un unique bloc ```json contenant UN objet avec les clés "accroche", "texte", "cta", "hashtags", "brief_visuel". JSON strict.',
    '',
    '# Règles',
    ...RULES.map((r) => `- ${r}`),
  ].join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for browsers without async clipboard permission.
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
