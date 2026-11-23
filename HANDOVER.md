# Handover — v3.0.0 (23 November 2026)

## What happened to the earlier version
The repository received a ChatGPT-made prototype: one minified 22 KB `app/page.tsx`, five small helper files and documentation. `tsconfig.json` contained an error message instead of JSON, and `npm install` and the build had never been run. A "source bundle" in the git history (`bc3cc66`) held the same files, plus empty `api/`, `supabase/` and `components/` folders. Nothing more complete was recoverable.

v3 is a rebuild on Vite + React + TypeScript. It keeps the good ideas from the prototype (prompt builders, backup validation rules, CSV formula escaping, offline templates) and converts old v2 backups and old localStorage keys automatically.

## Verified on 23 November 2026
- `npm run verify` passes: eslint clean, 56 tests (49 logic + 7 UI flows), `tsc -b` strict, production build.
- Browser checks (dev server and production build under the production CSP):
  - creating a campaign;
  - building a Claude prompt, pasting an answer and importing 3 publications with dates and times;
  - the full approval chain through "programmé";
  - edit after approval sends the post back to review;
  - the validation queue;
  - calendar placement;
  - analytics CSV import, with correct KPIs and chart;
  - no console errors, fonts self-hosted, service worker registered.
- Responsive: no horizontal overflow on any of the 14 routes at 375px. Checked at 768px tablet width and on desktop, in light and dark themes.

## Not verified / known limits
- Calendar drag-and-drop was not exercised by automation (HTML5 drag events). The underlying `reschedule` action is simple and covered indirectly.
- No real deployment has been made yet. See DEPLOYMENT.md for host choice (Vercel Hobby forbids commercial use).
- localStorage holds roughly 5 MB. That is plenty for text, but the app stores no images.
- No cross-device sync and no login, by design.

## Ideas for later (all free)
- An optional encrypted export (password-based, using the Web Crypto API).
- Calendar week view; bulk actions in the publications list.
- Importing Google Search Console CSV exports into the keyword tracker.
