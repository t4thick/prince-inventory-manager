# Prince Auto

Inventory + checkout for Prince's mechanic shop — shared across workers on phone and desktop.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add your Supabase URL + publishable key.

## Database setup

Run both SQL files in **Supabase → SQL Editor** (in order):

1. `supabase/migrations/20250824000000_initial_schema.sql`
2. `supabase/migrations/20250826000000_phase1_auth.sql`

Or after `npx supabase login` and `npx supabase link`:

```bash
npm run db:push
```

## First login

1. Open the app and tap **Join shop** (or Sign in after signup).
2. The **first account** becomes **owner** (can add/edit parts, void any job).
3. Later accounts are **workers** (checkout, adjust stock, void own jobs).

In Supabase → **Authentication → Providers**, enable Email. For a small internal team, you may disable **Confirm email** so workers can sign in immediately.

## Live site

https://prince-inventory-manager.vercel.app

## Features

- **Checkout** — parts & labor, cash/card/transfer, customer & vehicle on ticket
- **Receipt** — print-friendly summary after payment
- **Parts** — shared stock, low-stock alerts; owner manages catalog
- **Jobs** — history with worker name; void restores stock
- **Auth** — owner vs worker roles, secure database rules
- **PWA** — Add to Home Screen on iPhone/Android (standalone app feel)
- **Offline** — sales queue locally when connection drops, sync when back

## iOS / App Store path

The app is built mobile-first as a **PWA** today. For App Store later, wrap this same codebase with **Capacitor** — no rewrite needed.
