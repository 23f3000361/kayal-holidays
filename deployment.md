# Deployment and running guide: Kayal Holidays

Repository: https://github.com/23f3000361/kayal-holidays

## 1. Run it locally

Needs Node.js 20.9 or newer (built and tested on Node 24 LTS) and npm. No other services are
needed: the database is a local SQLite file, and email, WhatsApp and payments are simulated.

```bash
git clone https://github.com/23f3000361/kayal-holidays.git
cd kayal-holidays
npm install
cp .env.example .env.local
```

Open `.env.local` and set `APP_SECRET` to any random string of 32 or more characters, for example
the output of `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.

```bash
npm run db:setup     # creates data/kayal.db, runs migrations, loads the demo data
npm run dev          # development server on http://localhost:3000
```

For a production-mode run:

```bash
npm run build
npm start            # http://localhost:3000
```

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run db:reset` | Wipes and reloads the demo data. Timers and dates are relative to now, so run it before a demo. |
| `npm test` | 107 unit tests (Vitest). |
| `npm run test:e2e` | 21 Playwright browser runs. Run `npm run build` first; this resets the demo data. First time only: `npx playwright install chromium`. |
| `npm run lint` / `npm run typecheck` | ESLint and TypeScript checks. |
| `node scripts/perf.mjs` | Measures page load (LCP) under throttled slow 4G against a running server. |

### Try the simulated channels

Phone calls and pasted chats: sign in as staff, open **Inbox**, then **Log an enquiry**.

WhatsApp, email or chat through the webhook (set `INBOUND_SECRET` in `.env.local` first):

```bash
curl -X POST http://localhost:3000/api/inbound/whatsapp \
  -H "Content-Type: application/json" -H "x-inbound-secret: <your INBOUND_SECRET>" \
  -d '{"name":"Ravi","phone":"+91 98470 00099","message":"2 adults, Munnar 3 nights next month, budget 60k"}'
```

Replies and acknowledgements are not delivered anywhere. They are stored in an outbox you can
read on each enquiry, under **Notes and history**.

## 2. How it is deployed

Target set-up: **Vercel** (Next.js hosting) plus **Turso** (hosted libSQL, the same SQLite dialect
used locally). Both have free tiers.

1. Create a Turso database, then copy its URL (`libsql://…`) and an auth token.
2. Load the schema and demo data into it from your machine:
   ```bash
   DATABASE_URL=libsql://<db>.turso.io DATABASE_AUTH_TOKEN=<token> npm run db:setup
   ```
3. Import the GitHub repository into Vercel (framework preset: Next.js; build command `npm run build`).
4. Add the environment variables below in Vercel, then deploy.
5. After the first deploy, set `SITE_URL` to the real domain and redeploy, so the sitemap, quote
   links and preview links use it.

Package and destination pages are generated at build time and refreshed when a package is
published, so the database must be reachable during the build.

Uploaded photos are stored in the database (resized to WebP in the browser first), so no separate
file storage is needed. A busy production site should move them to object storage; see the TDD.

### Environment variables (names only)

| Name | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | libSQL URL. Locally `file:./data/kayal.db`; in production the Turso URL. |
| `DATABASE_AUTH_TOKEN` | production | Turso auth token. Leave empty for a local file. |
| `APP_SECRET` | yes | 32+ character secret that signs draft preview links. |
| `SITE_URL` | yes | Public base URL, used in the sitemap, reply drafts, quote and preview links. |
| `INBOUND_SECRET` | for webhooks | Shared secret for `/api/inbound/{whatsapp,email,chat}`. |
| `LLM_BASE_URL` | optional | Any OpenAI-compatible chat endpoint for the extraction second opinion. |
| `LLM_API_KEY` | optional | Key for that endpoint. |
| `LLM_MODEL` | optional | Model name for that endpoint. Without the three LLM variables, the built-in rules engine runs alone. |

No secrets are committed. `.env.local` is git-ignored; `.env.example` lists the names only.

## 3. Demo logins for the reviewer

Every account uses the password **`kayal-demo-2026`**. All people and contact details in the demo
data are fictional.

| Role | Email | What to try |
| --- | --- | --- |
| Admin | `admin@example.com` | Overview KPIs, all enquiries, reassigning, **Team** (add staff, roles, deactivate), Activity log. |
| Content editor | `editor@example.com` | Packages: edit PKG-KL-07 prices, preview, publish or schedule, history. **Journal**: write and publish a post. **Old URLs**: paste a list and check it. No access to enquiries. |
| Travel consultant | `anjali@example.com` | Inbox: open **Priya Menon** (the brief's sample enquiry), correct a field, send the reply, create a quote. Sees own and unassigned enquiries only. |
| Travel consultant | `rahul@example.com`, `fatima@example.com` | Same role, different enquiries. |
| Traveller | `traveller@example.com` | **Your trips**: enquiries, replies and a quote. New travellers can register at `/register`. |

A suggested five-minute path:
1. As a visitor, open a package, try the price calculator, and send an enquiry.
2. As Anjali, open Priya Menon's enquiry, then hover the extracted fields to see their evidence.
3. As the editor, change a price and publish, then open the Journal and use “Suggest from the text” on a post.
4. Visit an old URL such as `/kerala-tour-packages.html` and watch it redirect.
