# WanoSend

A lightweight internal tool for composing and sending raw-HTML emails through
[Resend](https://resend.com) at a controllable send rate, to a recipient list
the operator supplies. Images referenced in the HTML can be uploaded to
Cloudinary and hosted from the tool.

Built per the *Simple HTML Email Sending Platform* PRD. Fast, no-frills
**paste HTML → set rate → send**.

## Features

- **Compose** — paste raw HTML with a live desktop/mobile preview; set subject,
  from name + address, and reply-to. Merge tags (`{{column}}`) supported in
  subject and body.
- **Recipients** — load by pasting comma/newline-separated addresses or by
  uploading a CSV with an `email` column plus optional merge columns. Invalid
  addresses are flagged, duplicates removed, and suppressed addresses stripped.
- **Images** — direct browser→Cloudinary unsigned upload with progress and a
  one-click copy of the returned `secure_url`.
- **Rate config** — target rate (emails/min), hard request ceiling (≤ Resend's
  2 req/s), batch size (≤100), and retry count, with a live pacing projection.
- **Rate-limiting engine** — splits recipients into batches of up to 100,
  paces batch dispatch to the configured rate while never exceeding the
  per-second ceiling, attaches an idempotency key per batch, and backs off with
  exponential jitter on 429 / 5xx.
- **Send** — test send to self first, then a full send with live progress
  (sent / failed / remaining / throughput), pause / resume / cancel, a
  per-recipient result log, and CSV export.
- **Suppressions** — hard bounces and unsubscribes are excluded from every send
  to keep bounce rate under Resend's 4% threshold.

## Stack

- **Next.js 16** (App Router) — single-page UI plus API route handlers.
- **Resend** SDK — server-side only; the API key never reaches the browser.
- **better-sqlite3** — lightweight persistence for jobs, per-recipient results,
  and the suppression list.
- **Cloudinary** — unsigned direct-from-browser image uploads.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your keys
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key. **Server-side only.** |
| `APP_PASSWORD` | Optional simple auth gate. If set, API routes require `Authorization: Bearer <APP_PASSWORD>`. Leave unset to disable. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name (public). |
| `NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET` | Cloudinary **unsigned** upload preset (public). |

## Prerequisites

- A **verified sending domain** in Resend (SPF/DKIM/DMARC) for the `from`
  address.
- One **unsigned upload preset** configured in Cloudinary (restrict allowed
  formats/size; optionally target a folder).

## API

| Route | Description |
|-------|-------------|
| `POST /api/send` | Validate/de-dupe/strip-suppressed recipients, create a job, and start the paced send. Returns `job_id` and a clean count. |
| `GET /api/send` | List recent jobs. |
| `GET /api/send/:id/status` | Job status + counts. |
| `GET /api/send/:id/results` | Per-recipient result log. |
| `POST /api/send/:id/pause` \| `/resume` \| `/cancel` | Control an in-progress send. |
| `POST /api/test-send` | Send a single `[TEST]` email to a given address. |
| `GET/POST/DELETE /api/suppression` | Manage the suppression list. |

## Notes & trade-offs

- **Unsigned Cloudinary uploads** are visible in client code. Acceptable for an
  internal tool; switch to signed uploads (backend-generated signature) if abuse
  is a concern.
- The send engine runs **in-process** in the API route. For a single operator
  and moderate lists this is sufficient; for durable, restart-safe queuing at
  higher volume, move the worker to a dedicated queue/background service.
- `List-Unsubscribe` header is attached to every send. Include a working
  unsubscribe link in your HTML and record opt-outs in the suppression list.
