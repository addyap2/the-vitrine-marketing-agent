# Claude Code instructions — The Vitrine Marketing Agent

## Non-negotiable constraints
- €0 recurring cost. No paid APIs, no Supabase, no database, no backend, no API routes.
- Claude Pro is used manually through copy/paste. Claude Pro does NOT include API credits, so never add an AI SDK or API key.
- Never claim or implement automatic social-media publishing. "Programmé" means planned in the calendar.
- Data stays in browser localStorage, with JSON backup and restore. Keep the app usable offline and without accounts.
- French UI, professional tone. Never invent client results, reviews, prices or offers in seed content or prompts.

## Brand
Navy `#081227`, amber `#FFC27D`, cream `#F6F2EA`. Fonts: Fraunces (headings) and Inter (text), self-hosted via @fontsource.

## Commands
- `npm run dev`: Vite dev server.
- `npm run verify`: eslint, then vitest, then `tsc -b`, then `vite build`. It must pass before every commit.
- `npm run preview`: serves `dist/` with the production CSP. Use it to catch CSP violations.

## Architecture
- `src/lib/*`: pure, framework-free logic with unit tests next to it (`*.test.ts`). Put new logic here first.
- `src/lib/types.ts` is the domain model. `src/lib/schema.ts` validates untrusted data with Zod and checks references.
- **Changing the data model:** update `types.ts`, `schema.ts` (with a `.default()` so old backups still load), `defaults.ts` and the backup tests. Bump `schemaVersion` and add a migration in `backup.ts` only for breaking changes.
- `src/state/store.tsx`: a single store built on `useSyncExternalStore`. All mutations go through `actions`. Store updates are synchronous; use `useStoreApi().getState()` to read state right after an action.
- Workflow rules live in `src/lib/workflow.ts`. Status changes only through `applyTransition`. `applyEdit` never changes status or history, and sends edited approved content back to review.
- Claude prompts: `src/lib/prompts.ts` builds them, `src/lib/parseResponse.ts` parses pasted answers and tolerates key/accent variants. Built-in templates live in `src/lib/defaults.ts`, and `withBuiltins()` adds new ones to existing users on load.
- Routing is hash-based (`src/router.ts`), so it works on any static host without rewrites.
- Modals use `<dialog>` (`components/ui.tsx`). Confirmations use `useUI().confirm()`, never `window.confirm`.

## Quality bar
- TypeScript strict, no `any`. Keep the 375px layout free of horizontal scroll (CSS breakpoints are at 1100, 1023 and 760px).
- Every new user flow gets a test in `src/test/flows.test.tsx`.
- Keep the honesty notices in the UI: no auto-publishing, no AI calls, data stays local, reminders to back up.
