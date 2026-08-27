# Install on iPhone

Prince Auto is a **Progressive Web App (PWA)**. You can use it on iPhone in two ways — pick the one that fits you.

---

## Option 1: Add to Home Screen (recommended, no Mac needed)

This is the fastest way. The app opens full-screen like a native app.

1. Open **Safari** on your iPhone (Chrome does not support “Add to Home Screen” the same way).
2. Go to: **https://prince-inventory-manager.vercel.app**
3. Sign in with your shop account.
4. Tap **Share** (square with arrow at the bottom).
5. Scroll down and tap **Add to Home Screen**.
6. Tap **Add**.

You should see the **Prince Auto** icon on your Home Screen. Open it from there — it runs standalone without Safari’s address bar.

**Tip:** If you visit in Safari before installing, the app shows a short “Install on iPhone” guide at the bottom.

---

## Option 2: Xcode wrapper (Capacitor)

Use this if you want a real **.ipa** / TestFlight build or to open the project in Xcode.

### Requirements

- Mac with **Xcode** installed
- Apple Developer account (free account works for your own device)
- Node.js (already used for this project)

### One-time setup

```bash
cd "/Users/richyeff/Desktop/prince invemtory manager"
npm install
npm run build
npx cap sync ios
npm run ios:open
```

In Xcode:

1. Select the **App** target → **Signing & Capabilities**.
2. Choose your **Team** (Apple ID).
3. Connect your iPhone or pick a simulator.
4. Press **Run** (▶).

The wrapper ships the built web app in `dist/`. After code changes:

```bash
npm run ios:sync
```

Then run again from Xcode.

### Always load the live site (optional)

If you prefer the phone app to always use the deployed site (no rebuild for every UI change), edit `capacitor.config.ts` and uncomment the `server.url` block, then run `npx cap sync ios`.

---

## Environment variables

The app needs Supabase credentials at **build time** (Vite embeds `VITE_*` vars):

| Variable | Where to get it |
|----------|-----------------|
| `VITE_SUPABASE_URL` | Supabase → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Same page (publishable / anon key only) |

Copy `.env.example` to `.env.local` locally. On Vercel, set the same variables in Project → Settings → Environment Variables.

**Never** put the Supabase **service_role** key in the app or in `VITE_*` variables.

---

## Native Swift app vs PWA

The long Swift/SwiftUI spec you shared would be a **separate native iOS project**. Your current stack is React + Supabase + PWA, which already gives you:

- Shared inventory across workers  
- Login and roles  
- Checkout, jobs, reports  
- Offline sale queue  
- Installable on iPhone  

We can grow the web app toward more inventory features (suppliers, purchase orders, barcode scanning via camera API, etc.) without rewriting everything in Swift. A full native rebuild is possible later if you need App Store distribution with deep iOS APIs.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Old UI after install | Remove icon from Home Screen, clear Safari cache, re-add from Safari |
| Login fails | Confirm Phase 1 Supabase migration ran; check env vars on Vercel |
| Blank screen in Xcode build | Run `npm run build` then `npx cap sync ios` |
| “Add to Home Screen” missing | Use Safari, not Chrome |
