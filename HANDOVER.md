# Claude Code handover — read this first

## Goal and constraints
The Vitrine Marketing Agent is a French-language, private single-user marketing workspace for a commercial web agency. **No additional paid services**. Do not add Supabase, Neon, paid AI APIs, analytics trackers, third-party authentication, or hosted databases. Claude Pro is used manually by copying prompts into claude.ai, not through an API. No autonomous Meta posting. Static Next.js export, browser localStorage, JSON backup/restore.

## Current implementation
- Six specialist workspaces; structured prompts; six offline content templates.
- Campaigns, editable drafts, approval statuses, monthly calendar, CSV export.
- Offline performance calculator, publication quality checklist, JSON backups.
- `lib/backup.ts`: strict import validation; rollback of localStorage writes on failed import.
- `.github/workflows/verify.yml`: build/typecheck/static checks on GitHub pushes.

## Mandatory verification before deployment
1. `npm install --no-audit --no-fund`
2. `npm run lint && npm run build && python3 tests-check.py`
3. Browser smoke test: create/edit/delete drafts and campaigns, calendar navigation, offline template, prompt copy, JSON export/import, CSV export, refresh persistence, mobile layout.
4. Verify `out/` exists after build. No secrets in the static bundle.
5. Ensure the hosting plan allows commercial use at no cost; do not assume Vercel Hobby is eligible.

## Known limitations and security
- No full-site authentication. A static site is publicly accessible to anyone who knows its URL; localStorage is device-local and not encrypted. Avoid sensitive customer data.
- No cross-device sync, server-side scheduled publishing or automatic AI generation.
- Browser storage can be cleared; backup frequently.
- `npm install` timed out in the ChatGPT build environment; successful production compilation has NOT been verified.

## Suggested next work (only after build passes)
- Add browser-level E2E tests with Playwright when dependencies can install.
- Improve keyboard navigation, contrast and responsive QA.
- Add campaign editing and calendar drag-and-drop only if useful.
- Implement user-requested enhancements without introducing costs or server dependencies.

## Deploy
Create private repo `addyap2/the-vitrine-marketing-agent`, upload project files at repo root, check GitHub Actions. Deploy `out/` to an eligible static host or import Next.js repo into Vercel after verifying commercial eligibility. Never put private API keys in NEXT_PUBLIC variables.


## Final pre-handover improvements (23 November 2026)
- Draft cards support TXT download, duplication, and campaign reassignment.
- Failed localStorage writes explicitly leave in-memory data unchanged and warn the user.
- Static source checks pass. npm install could not finish in the execution environment (25-second timeout); **do not claim a successful build**.
- First Claude Code task: `npm install && npm run lint && npm run build`, fix errors, then test all navigation, backup import/export, drafts, campaigns and calendar in desktop/mobile browsers.
- No API subscriptions, Supabase, Neon, or paid third-party integrations are permitted.

## Latest hardening

- Backup import validates actual calendar dates and rejects orphaned campaign references.
- Campaign deletion retains publications while clearing their campaign assignment.
- Verify both paths in browser before release.

## Latest verified additions
- Publication editor can reassign a draft to an existing campaign or remove its campaign assignment.
- `tests/backup.test.mjs` contains nine executable Node 22 tests for backup integrity. Run `npm run test` before building. All nine passed locally on 2026-11-23.
- CI now runs tests before TypeScript and static export.
- TypeScript compilation, Next.js production build and interactive browser tests remain unverified; do not claim production readiness until they pass.