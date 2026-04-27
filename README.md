# 9470 Champs Scouting

Offline-first scouting web app for Team 9470's Championship scouting workflow.

## Stack

- Vite
- React
- TypeScript
- Dexie / IndexedDB for local durable storage

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. On the same WiFi network, phones can usually use the `Network` URL.

For TBA schedule import, create `.env.local` with either:

```bash
TBA_AUTH_KEY=your_tba_key
```

`TBA_API_KEY` is also accepted for compatibility with other 9470 projects.

## Build

```bash
npm run build
```

The static app is written to `dist/`.

## Deployment

### Vercel

Vercel should auto-detect Vite.

- Build command: `npm run build`
- Output directory: `dist`
- Add `TBA_AUTH_KEY` or `TBA_API_KEY` as an environment variable for schedule import.

### GitHub Pages

The included GitHub Actions workflow builds the app and publishes `dist/` to Pages.

In the GitHub repo settings:

- Go to Pages
- Set source to GitHub Actions

GitHub Pages remains valid for offline scouting, manual entry, and JSON import/export. TBA schedule import needs the Vercel/local proxy so the key is not exposed in the browser.

## Current MVP

- Stage-based match scouting flow
- Portrait-first mobile UI
- Hold-based live action buttons
- Local autosave to IndexedDB
- TBA event schedule import
- Local scouter roster and generated match assignments
- Assignment-aware next-match selection
- Match submission queue
- JSON export/import fallback
- Basic strategy dashboard aggregation

Live backend sync is intentionally not wired yet. The local storage and export/import path is the reliability foundation.
