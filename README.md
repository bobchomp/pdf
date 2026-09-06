# Flipbooks

A self-hosted alternative to FlipbookPDF: upload a PDF, get a realistic page-turning
viewer you can share as a link or embed on your own site — backed by your own
Cloudflare R2 storage instead of a monthly subscription.

## Features

- Upload PDFs, rendered client-side into a page-flip viewer (pdf.js + react-pageflip)
- Shareable public link (`/f/<slug>`) and embeddable `<iframe>` snippet (`/embed/<slug>`)
- Password-protect any flipbook
- Per-flipbook download/print toggles and toolbar/background branding
- View analytics (total views, last-30-days chart)
- Small-team accounts: an admin adds teammates by email + password; everyone shares one
  flipbook library

## Stack

Next.js (App Router) · NextAuth (Credentials) · Drizzle ORM over Cloudflare D1 (via its
HTTP API) · Cloudflare R2 (S3-compatible) for storage.

## Getting started

See [SETUP.md](./SETUP.md) for the full walkthrough (Cloudflare R2 + D1 setup, env
vars, first admin account). Short version:

```bash
cp .env.example .env      # fill in Cloudflare R2 + D1 + auth values
npm install
npm run db:push
npm run seed:user -- you@example.com "a-strong-password" "Your Name" admin
npm run dev
```

## Scripts

- `npm run dev` / `npm run build` / `npm run start`
- `npm run db:generate` / `npm run db:push` — Drizzle migrations against D1
- `npm run db:studio` — browse the D1 database
- `npm run seed:user -- <email> <password> <name> [admin|member]` — create a login
