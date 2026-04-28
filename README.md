# 9470 Champs Scouting

Offline-first scouting web app for Team 9470's Championship scouting workflow.

## Stack

- Vite + React + TypeScript
- Dexie / IndexedDB for local durable storage
- Supabase (Auth, Postgres, Realtime sync)
- Vercel (hosting + serverless TBA proxy)

## Local Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. On the same WiFi network, phones can use the `Network` URL.

Create `.env.local` with:

```bash
TBA_AUTH_KEY=your_tba_key
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Deployment (Vercel)

The app deploys to Vercel automatically on push to `main`.

### Environment Variables

Set these in the Vercel dashboard → Settings → Environment Variables:

| Variable | Scope | Purpose |
|---|---|---|
| `TBA_AUTH_KEY` | Server only | Proxied to The Blue Alliance API — never exposed to client |
| `VITE_SUPABASE_URL` | Client (build-time) | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Client (build-time) | Supabase anon key (RLS-gated, safe to expose) |

### Supabase Auth Setup

For Google OAuth to work in production:

1. Go to **Supabase Dashboard → Authentication → URL Configuration**
2. Set **Site URL** to your Vercel production URL
3. Add these **Redirect URLs**:
   - `https://your-app.vercel.app`
   - `https://your-app.vercel.app/**`
   - `http://localhost:5173` (for local dev)

### Supabase Schema

Run these SQL files in the Supabase SQL editor (in order):

1. `supabase/schema.sql` — match submissions table
2. `supabase/profiles.sql` — user profiles with role/group
3. `supabase/assignments.sql` — scout assignments
4. `supabase/event_schedules.sql` — cached event schedules
5. `supabase/shifts.sql` — scout shift rotations

### Architecture

```
Browser (SPA)
├── React UI
├── Dexie/IndexedDB (offline-first local storage)
├── Supabase client (auth, data sync)
└── /api/tba/* → Vercel serverless → The Blue Alliance API
```

The TBA proxy (`api/tba/[...path].js`) keeps the API key server-side. The Vite dev server proxies the same route locally.

## Features

- Stage-based match scouting flow (setup → auto → teleop → endgame → review)
- Portrait-first mobile UI with hold-based live action buttons
- Local autosave to IndexedDB
- TBA event schedule import
- Role-based team roster (scouter / lead) with Google OAuth
- Shift-based scouter assignment generation
- Real-time Supabase sync for submissions, assignments, schedules, and shifts
- JSON export/import fallback
- Strategy dashboard with per-team aggregation

Live backend sync is opportunistic. Local storage and export/import remain the reliability foundation.
