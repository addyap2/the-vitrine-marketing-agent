import type { Brand } from './types';

/** Offline visual prompt builder (English prompts work best in most image/video generators). */

export const RATIOS = [
  { id: '4:5', label: 'Instagram portrait 4:5 — 1080 × 1350', w: 1080, h: 1350 },
  { id: '9:16', label: 'Reel / Story 9:16 — 1080 × 1920', w: 1080, h: 1920 },
  { id: '1:1', label: 'Carré 1:1 — 1080 × 1080', w: 1080, h: 1080 },
  { id: '16:9', label: 'Paysage 16:9 — 1920 × 1080', w: 1920, h: 1080 },
  { id: '1.91:1', label: 'Lien / bannière 1,91:1 — 1200 × 628', w: 1200, h: 628 },
] as const;

export const STYLES = [
  { id: 'photo', label: 'Photo réaliste', prompt: 'photorealistic editorial photography, shallow depth of field' },
  { id: 'cinematic', label: 'Cinématique', prompt: 'cinematic still, anamorphic look, soft film grain' },
  { id: 'minimal', label: 'Minimal graphique', prompt: 'minimalist graphic composition, clean geometric shapes, generous negative space' },
  { id: 'flatlay', label: 'Vue de dessus', prompt: 'top-down flat lay, carefully arranged objects, even soft light' },
  { id: '3d', label: 'Rendu 3D doux', prompt: 'soft 3D render, matte materials, subtle global illumination' },
  { id: 'mockup', label: 'Mockup d’écran', prompt: 'premium device mockup, laptop and smartphone showing an elegant generic website' },
] as const;

export const LIGHTS = [
  { id: 'warm', label: 'Lumière chaude', prompt: 'warm golden-hour light' },
  { id: 'studio', label: 'Studio doux', prompt: 'soft diffused studio lighting' },
  { id: 'night', label: 'Soirée tamisée', prompt: 'moody evening light with warm practical lamps' },
  { id: 'daylight', label: 'Lumière du jour', prompt: 'bright natural daylight from a large window' },
] as const;

export const EXCLUSIONS = [
  { id: 'text', label: 'Texte', prompt: 'text, letters, words, captions, watermarks' },
  { id: 'logos', label: 'Logos', prompt: 'logos, brand marks' },
  { id: 'faces', label: 'Visages', prompt: 'faces, people' },
  { id: 'hands', label: 'Mains', prompt: 'hands, fingers' },
  { id: 'clutter', label: 'Désordre', prompt: 'clutter, busy background' },
] as const;

export interface VisualInput {
  kind: 'image' | 'video';
  subject: string;
  ratio: (typeof RATIOS)[number]['id'];
  style: (typeof STYLES)[number]['id'];
  light: (typeof LIGHTS)[number]['id'];
  brandPalette: boolean;
  exclusions: string[];
  duration: number;
  camera: string;
}

export function buildVisualPrompt(input: VisualInput, brand: Brand): { prompt: string; negative: string; spec: string } {
  const ratio = RATIOS.find((r) => r.id === input.ratio) ?? RATIOS[0];
  const style = STYLES.find((s) => s.id === input.style) ?? STYLES[0];
  const light = LIGHTS.find((l) => l.id === input.light) ?? LIGHTS[0];
  const subject = input.subject.trim() || 'a calm, elegant web design studio workspace';
  const palette = input.brandPalette
    ? `colour palette of deep navy ${brand.colors.navy}, warm amber ${brand.colors.amber} and soft cream ${brand.colors.cream}`
    : '';
  const parts =
    input.kind === 'video'
      ? [
          `Cinematic vertical video, ${input.duration} seconds, aspect ratio ${ratio.id}`,
          subject,
          input.camera.trim() || 'slow, smooth dolly-in camera movement',
          style.prompt,
          light.prompt,
          palette,
          'premium, calm, modern atmosphere, no dialogue, no subtitles',
        ]
      : [`${style.prompt}, aspect ratio ${ratio.id}`, subject, light.prompt, palette, 'premium, calm, modern atmosphere, high detail'];
  const negative = EXCLUSIONS.filter((e) => input.exclusions.includes(e.id))
    .map((e) => e.prompt)
    .join(', ');
  return {
    prompt: parts.filter(Boolean).join(', ') + '.',
    negative,
    spec: `${input.kind === 'video' ? `Vidéo ${input.duration} s` : 'Image'} · ${ratio.label}`,
  };
}
