import type { Brand } from './types';

/** Placeholders filled automatically from the brand profile. */
export const BRAND_PLACEHOLDERS = ['marque', 'site', 'cta', 'zone', 'navy', 'ambre', 'crème'] as const;

const RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

export function extractPlaceholders(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(RE)) {
    const name = m[1];
    if (!out.includes(name) && !(BRAND_PLACEHOLDERS as readonly string[]).includes(name)) out.push(name);
  }
  return out;
}

export function brandValues(brand: Brand): Record<string, string> {
  return {
    marque: brand.name,
    site: brand.website,
    cta: brand.defaultCta,
    zone: brand.location,
    navy: brand.colors.navy,
    ambre: brand.colors.amber,
    crème: brand.colors.cream,
  };
}

/** Replaces {{name}}; unknown or empty placeholders are kept visible as [name] so nothing is silently lost. */
export function renderTemplate(body: string, values: Record<string, string>, brand?: Brand): string {
  const all = { ...(brand ? brandValues(brand) : {}), ...values };
  return body.replace(RE, (_, name: string) => {
    const v = all[name]?.trim();
    return v ? v : `[${name}]`;
  });
}

export function placeholderLabel(name: string): string {
  const s = name.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
