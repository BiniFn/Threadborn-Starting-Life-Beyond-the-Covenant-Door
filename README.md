# Threadborn – Starting Life Beyond the Covenant Door

Official reader and chapter export hub for **Threadborn**, an original dark fantasy light novel by **BiniFn**.

This repository contains both the public website and the Android app package for the project: a polished reader with chapter browsing, full cast and lore tabs, project credits, prettier PDF/EPUB exports, installable web-app support, and a fully offline APK build.

## Highlights

- Responsive light novel website built as a static single-page app
- Full-screen reader with saved progress, chapter jump, TTS, theme switching, and cleaner mobile controls
- Browser-generated **Collector PDF** and **Styled EPUB** chapter exports with improved presentation and credits
- Installable web app using `manifest.json` and `service-worker.js`
- Native Android wrapper that bundles the site locally and works offline
- Desktop wrappers for Windows and macOS built from GitHub Actions
- Direct APK download via [`Threadborn.apk`](./Threadborn.apk)
- Ready for **GitHub Pages** and **Vercel**

## Story Snapshot

Yono Kazeshima dies in modern Japan and wakes in **Lumera**, pulled into a world of debt-oaths, shattered seals, gods, and monsters.

Volume 1 follows the **Shade Debt Arc**, Yono and Violet’s growing bond, and the discovery of **Velkor’s prison** in the forest.  
Volume 2 pushes further into the Covenant Door arc, where each new chapter makes Yono stronger than the last.

> The current Yono is always the strongest Yono.

## Project Structure

```text
.
├── .github/workflows/pages.yml
├── .github/workflows/build-apk.yml
├── .nojekyll
├── README.md
├── Threadborn.apk
├── android-app/
├── desktop-app/
├── assets/
├── index.html
├── manifest.json
├── scripts/
└── service-worker.js
```

## Website Features

- Home, volumes, chapters, characters, powers, leaks, lore, drawings, and credits sections
- Reading progress saved in browser `localStorage`
- Improved responsive layout for phone, tablet, and desktop
- APK download button for direct Android install
- Installable PWA support for supported browsers

## Android App

The Android app lives in [`android-app`](./android-app) and loads the website from bundled local assets.

What it includes:

- Fully offline chapter reading
- Same logo, content, and UI as the web version
- Local export saving through the Android bridge
- Bundled site assets synced via [`scripts/sync_android_site.sh`](./scripts/sync_android_site.sh)

The latest built APK is included in this repo at [`Threadborn.apk`](./Threadborn.apk).

## Desktop Apps

The repo also includes a desktop wrapper in [`desktop-app`](./desktop-app) plus a GitHub Actions workflow at [`.github/workflows/build-desktop.yml`](./.github/workflows/build-desktop.yml).

That workflow builds:

- `Threadborn-Windows.zip`
- `Threadborn-macOS.zip`

Each desktop build bundles the same local site files and opens the reader in a dedicated desktop window.

## Local Preview

Because the site is static, you can preview it in a browser by opening `index.html` directly or by serving the folder locally:

```bash
python3 -m http.server 8080
```

Then visit `http://localhost:8080`.

## Deploy on GitHub Pages

This repo includes a Pages workflow at [`.github/workflows/pages.yml`](./.github/workflows/pages.yml).

To publish:

1. Push the repository to GitHub.
2. Open **Settings → Pages**.
3. Set the source to **GitHub Actions**.
4. Re-run the workflow if needed.

## Deploy on Vercel

Recommended Vercel setup:

1. Import the GitHub repository.
2. Set **Framework Preset** to `Other`.
3. Leave **Build Command** empty.
4. Leave **Output Directory** as `.`.
5. Deploy.

This project now includes production-focused Vercel Functions for auth, profile, reader sync, bookmarks, and analytics.

Native wrapper note:

- Android and desktop builds keep the reader bundled offline but use the live auth API for login, signup, and profile sync.
- If `API_BASE_URL` is not supplied during a native build, the apps fall back to `https://threadborn.vercel.app`.

### Phase 1 backend setup (Neon + Vercel Blob)

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a local env file:
   ```bash
   cp .env.example .env.local
   ```
3. Add environment variables in `.env.local`:
   - `DATABASE_URL`
   - `SESSION_SECRET`
   - `BLOB_READ_WRITE_TOKEN`
   - `OWNER_EMAIL`
   - `OWNER_PASSWORD`
   - `API_BASE_URL` (optional for web; recommended for native wrappers if you are not using the default `https://threadborn.vercel.app`)
4. Run migrations:
   ```bash
   npm run db:migrate
   ```
5. Bootstrap owner once:
   ```bash
   curl -X POST http://localhost:3000/api/auth/bootstrap-owner
   ```
6. Run local Vercel dev server:
   ```bash
   npx vercel dev
   ```
7. Open:
   - `http://localhost:3000/login.html`
   - `http://localhost:3000/signup.html`
   - `http://localhost:3000/profile.html`

To add the same secret in Vercel:

```bash
vercel env add DATABASE_URL production
vercel env add DATABASE_URL preview
vercel env add DATABASE_URL development
vercel env add SESSION_SECRET production
vercel env add SESSION_SECRET preview
vercel env add SESSION_SECRET development
vercel env add BLOB_READ_WRITE_TOKEN production
vercel env add OWNER_EMAIL production
vercel env add OWNER_PASSWORD production
vercel env add API_BASE_URL production
vercel env add API_BASE_URL preview
vercel env add API_BASE_URL development
```

### API routes (Phase 1)

- `POST /api/auth/login`
- `POST /api/auth/signup`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/bootstrap-owner`
- `GET|PATCH /api/user/profile`
- `GET|PUT /api/user/settings`
- `GET|PUT /api/reader/progress`
- `GET|POST|DELETE /api/reader/bookmarks`
- `GET|POST /api/reader/analytics`
- `POST /api/upload/avatar`

## Offline / PWA

The web version includes:

- [`manifest.json`](./manifest.json) for installability
- [`service-worker.js`](./service-worker.js) for caching the core reader shell

## Credits

- **BiniFn** - creator, author, and project owner
- Main channel: [@binifn](https://www.youtube.com/@binifn)
- Roblox channel: [@binirbx](https://www.youtube.com/@binirbx)
- Anime channel: [@binirx](https://www.youtube.com/@binirx)
- GitHub: [BiniFn](https://github.com/BiniFn)
