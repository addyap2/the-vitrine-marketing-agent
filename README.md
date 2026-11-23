# The Vitrine Marketing Agent — Free Edition

A **database-free**, **API-free** marketing workspace in French for The Vitrine. All core functionality works without paying for an API or connecting an external account. Six specialist prompt builders support strategy, social media, creative direction, editorial calendar, SEO/GEO and analytics.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. To build the static website: `npm run build`. Upload the generated `out/` directory to a static host, or import the repository into Vercel with the Next.js framework preset. **Check your host's commercial-use terms before using a free plan for a business.**

## Claude Pro workflow

1. Open Studio and choose a specialist.
2. Enter your request and click **Préparer le prompt Claude**.
3. Copy the full prompt, open Claude and paste it into your existing Claude Pro conversation.
4. Copy Claude's answer into the response box and save it as a draft.
5. Review, approve and publish manually. No autonomous posting is claimed.

## Data and privacy

Drafts and campaigns are stored in **browser localStorage** on that device only. Export JSON backups regularly in Configuration. JSON import replaces local data. Private browsing, cleared site data or device changes can erase work if no backup exists. No account login is included: keep this studio on a private device and avoid storing sensitive customer data. The project is static and does not transmit content to an AI provider itself.

## Included

- Six specialist workspaces and structured Claude prompts
- Campaigns, editable drafts, status workflow and content calendar
- CSV export and JSON backup/restore
- Brand palette and responsive interface
- No database, no paid API, no Supabase, no API keys

## Not included

Automatic social publishing, integrated image/video generation, shared multi-device storage and server-side authentication. Those require separate services and/or additional engineering.

## GitHub / Claude Code

Create private repository `addyap2/the-vitrine-marketing-agent`, upload all project files **except** `node_modules`, `.next` and `out`. See `CLAUDE.md` for the engineering brief. 

## Offline production tools (v2.1)

The Studio includes six deterministic, editable templates for carousel posts, eight-second Reels, Facebook posts, audit invitations, service introductions, and Google Business Profile updates. These work with no network connection and do not generate images or videos themselves. The publications view supports text search; the calendar has a month grid and navigable dated entries. Backups are JSON files stored on your device; imports replace current local data after confirmation and basic format/size validation.

### Security and limits

Browser localStorage is not encrypted or shared between devices. Do not store passwords, client secrets, or sensitive personal data in drafts. The app does not autonomously publish to Meta, access Claude Pro through an API, or promise a paid service is free. A production build still needs verification with `npm install && npm run lint && npm run build` on a machine with npm registry access. Static hosting must be selected according to its current commercial-use policy.

## Offline marketing tools (v2.2)

The **Outils gratuits** workspace includes an engagement/conversion ratio calculator and publication quality checklist. All calculations are performed in-browser; no tracking or external data access. CSV export escapes spreadsheet formula prefixes to reduce formula-injection risk.

**Verification:** Static project checks pass. Full npm dependency installation/build is not verified in this environment because the registry request timed out. Run `npm install && npm run lint && npm run build` before deploying.

## Final handover and CI

See [HANDOVER.md](HANDOVER.md) for Claude Code's verification checklist and security limitations. A GitHub Actions workflow typechecks and builds the static export on every push. Do not publish the application until those checks and a browser smoke test pass. This project intentionally does not offer authentication or automatic publishing.

## Data integrity

Backups validate calendar dates and campaign references. Deleting a campaign keeps its publications and unassigns them. Local browser storage is not a secure customer-data vault; no authentication or automatic cross-device sync is provided.

## Automated backup tests
Run `npm run test` with Node.js 22 or newer. Nine backup validation tests pass locally without installing dependencies. The publication editor also supports reassignment between campaigns. GitHub Actions runs these tests before compilation and build.