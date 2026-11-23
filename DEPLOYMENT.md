# Deployment

The app is a static build (`npm run build` → `dist/`). It has no server code, no environment variables and no secrets, and it uses hash URLs (`/#/calendrier`), so no rewrite rules are needed.

## Which free host?

| Host | Free plan allows commercial use? | Config in this repo |
| --- | --- | --- |
| **Cloudflare Pages** | Yes | `public/_headers` (security headers) |
| **Netlify** (free) | Yes | `public/_headers` |
| **Vercel Hobby** | **No.** Hobby is limited to personal, non-commercial use. An internal tool for a business counts as commercial use. Vercel Pro is paid. | `vercel.json` |

**Recommendation: Cloudflare Pages.** It's free, allows commercial use, has unlimited bandwidth on static sites, and can deploy automatically from GitHub. `vercel.json` is included in case you already have a Vercel plan that covers commercial use (Pro or Team).

Check each provider's current terms yourself before deploying. This summary reflects their published policies, not legal advice.

### Cloudflare Pages (recommended)

1. Go to dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Choose `addyap2/the-vitrine-marketing-agent`.
3. Set the framework preset to **None** (or Vite), the build command to `npm run build` and the output directory to `dist`.
4. Optional: add the environment variable `NODE_VERSION` = `22`.
5. Deploy. Each push to `main` redeploys automatically.

### Vercel (only with a commercial-use plan)

Import the repository. `vercel.json` already sets the Vite framework, the build command, `dist` and the security headers.

## Privacy of the URL

The site has no login, so anyone who knows the URL can open the app. They'll see an **empty** app, because your data lives only in your own browser. Nothing is stored on the host. `noindex` headers and `robots.txt` keep search engines away. If you want a login wall at no cost, Cloudflare Access (Zero Trust, free for up to 50 users) can protect the Pages URL with an email code.

## Checklist after the first deploy

- [ ] Open the URL, create a campaign and a publication, then reload: the data is still there.
- [ ] Copy a prompt into claude.ai and paste the answer back into the app.
- [ ] **Données** → export a JSON backup, import it again, check the counts.
- [ ] On a phone: bottom navigation, full-screen editor and calendar agenda all work.
- [ ] Optional: "Add to Home Screen" on iOS/Android installs it as an app that also works offline.
