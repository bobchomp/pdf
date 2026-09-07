# Setup

This app stores PDFs and cover thumbnails in **Cloudflare R2** and all app data (users,
flipbook settings, view analytics) in **Cloudflare D1**. It's a Next.js app you deploy
to Vercel (or any Node host). Follow the steps below in order.

## 1. Create a Cloudflare account & find your Account ID

If you don't already have one, sign up at https://dash.cloudflare.com. Once logged in,
your **Account ID** is shown in the right sidebar of the dashboard overview page (or
under Workers & Pages > Overview). Copy it — you'll need it twice below.

```
CLOUDFLARE_ACCOUNT_ID=<your account id>
```

## 2. Create the D1 database

Easiest via the dashboard: **Workers & Pages > D1 > Create database**, name it e.g.
`flipbook-db`. After creation, its **Database ID** is shown on the database's detail page.

Or via the CLI (requires `npx wrangler login` once):

```bash
npx wrangler d1 create flipbook-db
```

Either way, set:

```
CLOUDFLARE_D1_DATABASE_ID=<the database id>
```

### Create a D1 API token

The app talks to D1 over Cloudflare's REST API (so it works from Vercel, which can't use
Workers Bindings). Create a token at **My Profile > API Tokens > Create Token**:

- Use the **Create Custom Token** option
- Permissions: **Account > D1 > Edit**
- Account Resources: the account that owns your database

Set:

```
CLOUDFLARE_D1_API_TOKEN=<the token>
```

### Push the schema

With `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID` and `CLOUDFLARE_D1_API_TOKEN` in
a `.env` file at the project root (drizzle-kit reads `.env`, not `.env.local`):

```bash
cp .env.example .env
# fill in the D1 values, then:
npm run db:push
```

This creates the `users`, `flipbooks` and `flipbook_views` tables.

## 3. Create the R2 bucket

**R2 Object Storage > Create bucket**, name it e.g. `flipbook-storage`. Set:

```
CLOUDFLARE_R2_BUCKET_NAME=flipbook-storage
```

### Create an R2 API token

**R2 Object Storage > Manage R2 API Tokens > Create API Token**:

- Permissions: **Object Read & Write**
- Scope it to the bucket you just created

This gives you an Access Key ID and Secret Access Key:

```
CLOUDFLARE_R2_ACCESS_KEY_ID=<access key id>
CLOUDFLARE_R2_SECRET_ACCESS_KEY=<secret access key>
```

### Configure CORS on the bucket

Browsers render PDF pages directly (via pdf.js) by fetching the file from R2, so the
bucket needs a CORS policy that allows your app's origin. In the bucket's **Settings >
CORS Policy**, add:

```json
[
  {
    "AllowedOrigins": ["https://your-app.vercel.app", "http://localhost:3000"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"]
  }
]
```

Update `AllowedOrigins` to match your real deployed domain(s) once you have one.

Nothing needs to be public — cover thumbnails and custom background images are both
served through short-lived signed URLs, same as the PDF itself.

## 4. Auth secret

```bash
openssl rand -base64 32
```

Set the result as `AUTH_SECRET`. Set `NEXTAUTH_URL` to `http://localhost:3000` locally,
and to your real deployed URL in production.

## 5. Email (Resend) — for "forgot password" links

Sign up at https://resend.com and create an API key at **API Keys > Create API Key**:

```
RESEND_API_KEY=<the key>
```

Emails need a `From` address on a domain you've verified with Resend (**Domains > Add
Domain**, then add the DNS records it gives you). Once verified:

```
RESEND_FROM_EMAIL=noreply@yourdomain.com
```

Without a verified domain, Resend's shared `onboarding@resend.dev` sender only delivers
to the email address of the Resend account owner — fine for a quick test, not for real
teammates. If you skip this section entirely, everything else works fine; only the
"Forgot password?" link on the login page won't be able to send emails.

## 6. Install and create the D1 tables

```bash
npm install
npm run db:push          # creates the D1 tables (needs .env, see step 2)
```

## 7. Deploying

Push this repo to GitHub and import it in Vercel, or run `vercel deploy`. Add every
variable from `.env.example` to the project's Environment Variables in the Vercel
dashboard (production **and** preview if you use preview deployments), and update
`NEXTAUTH_URL` and the R2 CORS `AllowedOrigins` to match your real domain.

## 8. Create your first (admin) login

Visit `/setup` on your deployed app (e.g. `https://your-app.vercel.app/setup`) and fill
in the form. This page only works **once** — the moment an account exists, it stops
accepting new ones and just points you at `/login` instead, so there's no lasting way in
through it. Skip straight to running it right after your first deploy so the window
where the URL works is as short as possible; you don't need to keep it secret indefinitely,
but don't leave a fresh deploy sitting unclaimed either.

Once you have your account, add teammates from the **Team** page in the dashboard
instead — everyone with a login shares the same flipbook library (there's no per-user
isolation; this is meant for a small team, not a public multi-tenant service).

Prefer the command line? The same thing works locally without deploying first:

```bash
npm run seed:user -- you@example.com "a-strong-password" "Your Name" admin
```

This needs Node 20.6+ (it uses `process.loadEnvFile`) and a working local `.env` — see
step 2. If you hit `'tsx' is not recognized`, run `npm install` first. If you get a
Cloudflare "Authentication error", double check `.env` has no quotes, no stray angle
brackets left over from a placeholder, and the exact token/IDs from steps 1–2.

## 9. Run it locally (optional)

```bash
npm run dev
```

Visit http://localhost:3000, sign in, and upload a PDF.

---

## Known limitations (read before relying on this for sensitive documents)

- **Download/print toggles are a UI convenience, not DRM.** Rendering pages in the
  browser with pdf.js means the browser fetches the original PDF bytes to draw them.
  A technically inclined visitor can still retrieve the file even with "Allow download"
  turned off. This is the same fundamental limitation every client-side flipbook viewer
  has (FlipbookPDF included) — it deters casual downloading, it doesn't prevent it.
- **Password-protected embeds.** The `<iframe>` embed for a private/password-protected
  flipbook relies on a cookie set on your app's own domain. Some browsers restrict
  third-party cookies inside iframes on other sites, which can cause the password
  prompt to reappear inside the embed. Public (non-private) flipbooks embed without any
  issue. If you need a protected flipbook embedded elsewhere, link to `/f/<slug>`
  directly instead of `/embed/<slug>`.
- **Shared team library.** Any logged-in teammate can see, edit, and delete any
  flipbook — there's no per-user ownership restriction. That's intentional for a small
  team tool; say so if you'd rather have per-user isolation and it can be added.
