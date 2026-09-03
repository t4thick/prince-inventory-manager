# Prince Auto

Inventory + checkout for Prince's mechanic shop — shared across workers on phone and desktop.

## Run locally

```bash
npm install
npm run dev
```

Copy `.env.example` to `.env.local` and add your Supabase URL + publishable key.

## Database setup

Run the SQL files in **Supabase → SQL Editor** (in order):

1. `supabase/migrations/20250824000000_initial_schema.sql`
2. `supabase/migrations/20250826000000_phase1_auth.sql`
3. `supabase/migrations/20260903000000_finance_credit.sql`

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
- **Tax & profit** — optional 20% item tax, cost snapshots, per-sale and period profit
- **Customer credit** — pay later, partial payments, searchable balances and payment history

## iPhone (PWA + optional Xcode wrapper)

**Fastest:** Safari → [prince-inventory-manager.vercel.app](https://prince-inventory-manager.vercel.app) → Share → **Add to Home Screen**. The app opens full-screen like a native app.

Safari visitors see an in-app install guide. Full steps: [`docs/IPHONE.md`](docs/IPHONE.md).

**Xcode wrapper (optional):** Capacitor is configured (`capacitor.config.ts`). On a Mac with Xcode and CocoaPods:

```bash
npm run ios:sync
npm run ios:open
```

## Native Swift vs this app

A full Swift/SwiftUI rebuild would be a separate project. This codebase is React + Supabase + PWA — suitable for your shop today and expandable (suppliers, POs, barcode via camera, etc.) without rewriting in Swift.
