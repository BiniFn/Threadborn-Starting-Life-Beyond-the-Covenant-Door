# Threadborn – Starting Life Beyond the Covenant Door

Official reader and chapter export hub for **Threadborn**, an original dark fantasy light novel by **BiniFn**.

This repository contains both the public website and the Android app package for the project: a polished reader with chapter browsing, full cast and lore tabs, project credits, prettier PDF/EPUB exports, installable web-app support, and a fully offline APK build.

## Highlights

- Responsive light novel website built as a static single-page app
- Full-screen reader with saved progress, chapter jump, TTS, theme switching, and cleaner mobile controls
- Browser-generated **Collector PDF** and **Styled EPUB** chapter exports with improved presentation and credits
- Installable web app using `manifest.json` and `service-worker.js`
- Native Android wrapper that bundles the site locally and works offline
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

Because the project is static HTML/CSS/JS, it stays very light on the free tier as long as you avoid adding server functions or databases.

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
