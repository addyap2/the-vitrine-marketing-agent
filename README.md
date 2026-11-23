# The Vitrine Marketing Agent

A French-language marketing workspace for [The Vitrine](https://thevitrine.fr). It runs entirely in the browser: **no database, no server, no paid API, no account**. Your Claude Pro subscription is used through a copy/paste workflow, since Claude Pro doesn't include API credits.

## What it does

| Area | What you get |
| --- | --- |
| **Tableau de bord** | This week's posts, what's waiting for approval, overdue items, active campaigns, a getting-started checklist. |
| **Stratégie** | Positioning, persona, SWOT and plan documents. Measurable goals with progress calculated from your statistics. |
| **Réseaux sociaux** | Kanban board (drag between allowed statuses) and list view, filters and full-text search. |
| **Création** | An offline image/video prompt builder (4:5, 9:16…, brand palette, things to exclude) and visual briefs. |
| **Calendrier éditorial** | Month grid with drag-and-drop rescheduling, an agenda view for phones, an "à planifier" tray, `.ics` export to Google/Apple/Outlook calendars, print. |
| **SEO & GEO** | Keyword tracker with position history, Google snippet preview with length checks, a 17-point local SEO + GEO checklist, FAQPage and LocalBusiness JSON-LD generators. |
| **Analyses** | Manual entry or CSV import (Meta Business Suite, LinkedIn or spreadsheet exports), KPIs, engagement rate, monthly chart, per-channel table, top posts. |
| **Campagnes** | Objective, audience, key message, channels, dates and colour; each campaign shows its posts, its results and a Markdown brief export. |
| **Validation** | Approval queue: approve, or request changes with a mandatory comment. |
| **Modèles** | 17 Claude prompt templates and 7 offline content templates. All of them can be edited, duplicated or restored, and you can add your own with `{{fields}}`. |
| **Atelier Claude** | The copy/paste workflow, the history of prompts and answers, and a how-to guide. |
| **Marque** | The brand profile injected into every prompt: tone, services, area, claims to avoid, visual rules, hashtag sets. |
| **Données** | JSON backup and restore (replace or merge), automatic restore points, storage gauge, CSV/ICS exports, full reset. |

### Approval workflow

`Idée → Brouillon → En relecture → (À corriger) → Approuvé → Programmé → Publié → Archivé`

- Requesting changes needs a comment. Scheduling needs a date. Empty content can't be sent for review.
- **If you edit the wording of an approved or scheduled post, it goes back to review automatically.** The previous wording is kept as a restorable version.
- Every publication has a quality check: hook, CTA, platform length limits, hashtag count, `[À VÉRIFIER]` placeholders, risky claims ("garanti", "le meilleur"…), links in Instagram captions, and a visual brief for visual formats.

### What it does *not* do (on purpose)

- **It doesn't publish to social networks.** "Programmé" means planned in the calendar. Publish by hand, or schedule the post in Meta Business Suite (free), then mark it "Publié" here. The `.ics` export gives you reminders on your phone.
- **It doesn't call any AI.** Nothing leaves your browser unless you copy it.
- **It doesn't sync between devices.** Use JSON export/import to move data.

## Using Claude Pro (copy/paste)

1. Open **Atelier Claude** (or the "Avec Claude" tab in any workspace) and pick a prompt template.
2. Fill in the fields and optionally pick a campaign. The app adds your brand profile, quality rules and a strict response format.
3. Click **Copier le prompt**, then **Ouvrir Claude** and paste it into a claude.ai conversation. A Claude *Project* called "The Vitrine" keeps the conversations together.
4. Use the **Copy** button under Claude's answer, paste the whole answer back into the app and click **Analyser la réponse**.
5. Tick what you want to keep. Posts are imported as drafts (with channel, format, date and time), keywords go to the SEO tracker, and documents go to Stratégie.

Each publication also has an **"Améliorer avec Claude"** tab that builds a rewrite prompt from the current text and applies Claude's answer as a new version.

## Data and privacy

- Data lives in `localStorage` on this device and in this browser only. It is **not encrypted** and **not synced**.
- Clearing site data or using private browsing erases it. **Export a JSON backup regularly.** The app reminds you after 7 days without one.
- The app keeps up to 3 restore points in the browser: one per day you use it, plus one before each import or reset.
- Imported backups are fully validated: types, real calendar dates, duplicate IDs, campaign references and size limits. Backups from the earlier ChatGPT version (`{version: 2, drafts, campaigns}`) are detected and converted.
- If storage is full or blocked, your changes stay in memory and a red banner asks you to export. Nothing is lost silently.
- Don't store passwords or sensitive customer data.

## Development

Requires Node 20 or later.

```bash
npm install
npm run dev        # http://localhost:5173
npm run verify     # lint + tests + typecheck + production build
npm run preview    # serve dist/ with the production Content-Security-Policy
```

Stack: Vite, React 19, TypeScript (strict), Zod for backup validation, Vitest and Testing Library. Fonts (Inter, Fraunces) are self-hosted. There are no runtime network requests.

```
src/
  lib/          pure logic, unit-tested: schema, backup, storage, workflow, prompts,
                parseResponse, csv, ics, metrics, qa, seo, creative, templates, dates
  state/        store (useSyncExternalStore) + actions
  components/   Layout, PublicationEditor, ClaudeAssistant, PublicationViews, TemplatePicker, ui
  views/        one file per page
  test/         user-flow tests (Claude import, approval, backup restore, routing)
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md). It's a static site (`dist/`), so it works on any free static host and needs no environment variables.
