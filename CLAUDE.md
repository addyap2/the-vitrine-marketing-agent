# Claude Code instructions — The Vitrine Marketing Agent

## Non-negotiable constraints
- €0 additional recurring cost. No paid APIs, no billing details, no Supabase/Neon/database.
- Claude Pro is used manually via copy/paste prompts; Claude Pro does NOT include Claude API credits.
- Next.js static export (`output: export`), browser localStorage, JSON backups.
- Do not add API routes, server actions, middleware, external AI SDKs or automatic publishing without explicit permission.
- Keep the app usable without external accounts or secrets.

## Brand
- The Vitrine, French web-design and digital-marketing studio; thevitrine.fr.
- Navy #081227, amber #FFC27D, cream #F6F2EA.
- French default, professional human tone; no invented client results, reviews, pricing or offers.
- Instagram visuals: 4:5 1080×1350, no text/logos/hands/faces by default; videos 9:16, often 8 seconds.

## Features
Six prompt builders: strategy, social, creative, calendar, SEO/GEO, analytics. Manual Claude Pro copy/paste workflow. Editable drafts, campaigns, editorial calendar, CSV export, JSON backup/restore. Human approval required before publishing.

## Development priorities
1. Run `npm install`, `npm run lint`, `npm run build`; fix any issues.
2. Add client-side schema validation for imported backups and resilient storage/quota handling.
3. Add calendar month view and filters by campaign/platform.
4. Add editable brand settings, reusable prompt templates and analytics CSV import.
5. Add automated tests for prompt builders and backup validation.
6. Improve accessibility, mobile layout and keyboard navigation.

## Safety
Never expose secrets in frontend code. Never claim auto-publishing or API integrations are live. Browser data is not encrypted and is not synced; remind users to export backups. Free Vercel Hobby may restrict commercial use: verify eligibility or use a free commercial-compatible static host.

## v2.1 changes and next engineering steps
- Offline content templates: `lib/content-templates.ts`; keep them deterministic and reviewable.
- Studio supports instant editable draft generation; calendar supports month navigation; publications have full-text local search.
- Validate TS/Next build after `npm install` in a networked environment; dependency install was not available in the build environment.
- Add automated unit/e2e tests, accessible modal confirmations, improved mobile calendar and optional IndexedDB storage. Never introduce paid services or API keys without explicit consent.

## v2.2 handover

Added `lib/marketing-tools.ts` (pure offline metric ratios, publication QA, CSV cell safety) and a new `tools` tab in `app/page.tsx`. Check the TypeScript compilation and static export before deploying. Prioritise accessibility, backup schema migration, localStorage quota error handling, and browser-level smoke tests. No database or paid APIs.