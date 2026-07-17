# Wanosend — Email Sender Platform

A full-stack email campaign platform: manage contacts and lists, design templates,
compose campaigns, and send them through [Resend](https://resend.com) with delivery
tracking.

## Stack

- **Next.js 15** (App Router, TypeScript, Server Actions)
- **PostgreSQL** + **Prisma** ORM
- **Tailwind CSS v4**
- **Resend** for email delivery (with a built-in dry-run mode)
- Session auth (JWT cookie via `jose` + `bcryptjs`)

## Features

- 🔐 **Auth** — email/password login, protected app, session cookies
- 👤 **Contacts** — CRUD, CSV import, subscribe/unsubscribe/bounce status
- 📋 **Lists** — group contacts into audiences, manage membership
- 🧩 **Templates** — reusable HTML email designs with live preview
- ✉️ **Campaigns** — compose, preview, test-send, and bulk-send to a list
- 🏷️ **Merge tags** — `{{firstName}}`, `{{lastName}}`, `{{email}}` personalization
- 📊 **Dashboard** — audience + sending stats, delivery log per campaign
- 🔗 **Unsubscribe** — one-click public unsubscribe links (auto-appended footer)
- 📡 **Webhooks** — Resend event receiver updates delivery/open/click status

## Getting started

### 1. Prerequisites
- Node.js 20+
- A running PostgreSQL database

### 2. Configure
Copy `.env.example` to `.env` and fill in values:

```bash
cp .env.example .env
```

- `DATABASE_URL` — Postgres connection string
- `SESSION_SECRET` — long random string
- `RESEND_API_KEY` — your Resend key (leave blank for **dry-run mode**)
- `DEFAULT_FROM_EMAIL` / `DEFAULT_FROM_NAME` — default sender identity
- `APP_URL` — used to build unsubscribe links

> **Dry-run mode:** with no `RESEND_API_KEY`, the app is fully usable — sends are
> logged to the database but not actually delivered. Add a real key to go live.

### 3. Install & set up the database

```bash
npm install
npx prisma migrate dev
npm run db:seed      # creates admin@wanosend.dev / password123 + demo data
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000 and sign in with the seeded admin account.

## Deployment

Set the environment variables in your host (e.g. Vercel), point `DATABASE_URL`
at a managed Postgres instance, run `prisma migrate deploy`, and configure a
Resend webhook pointing at `{APP_URL}/api/webhooks/resend`.
