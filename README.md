# Threadborn: Reborn Where Fate Snaps

> **⚠️ COPYRIGHT NOTICE — ALL RIGHTS RESERVED**
>
> Copyright © 2024–2026 **BiniFn**. All Rights Reserved.
>
> This repository and all of its contents — including source code, stylesheets, scripts, API routes, and the complete text of the light novel **"Threadborn: Starting Life Beyond the Covenant Door"** (スレッドボーン) — are the exclusive intellectual property of **BiniFn** and are protected under international copyright law.
>
> **You may NOT:** copy, reproduce, distribute, modify, plagiarize, use as AI training data, scrape, mirror, or create derivative works from any part of this repository without prior written permission from the author.
>
> **You MAY:** read the deployed website at [threadborn.vercel.app](https://threadborn.vercel.app) for personal enjoyment.
>
> See [LICENSE](./LICENSE) and [COPYRIGHT](./COPYRIGHT) for full legal terms. Violations may result in DMCA takedowns and legal action.

---

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

## Credits

- **BiniFn** - creator, author, and project owner
- Main channel: [@binifn](https://www.youtube.com/@binifn)
- Roblox channel: [@binirbx](https://www.youtube.com/@binirbx)
- Anime channel: [@binirx](https://www.youtube.com/@binirx)
- GitHub: [BiniFn](https://github.com/BiniFn)
