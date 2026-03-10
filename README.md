# TrackBlender

iRacing league track ownership manager. Helps leagues figure out which tracks everyone owns, plan season schedules, optimize purchases, and manage members — all with real-time sync and Google sign-in.

**Live site:** https://twr-chris.github.io/trackblender/

## Features

- **Ownership Grid** — Each member marks their own tracks (click to cycle: unowned → owned → buy → unowned). Your column is always leftmost. Admins can edit any column. Non-racing members are dimmed and excluded from calculations.
- **Schedule Builder** — Build a season from tracks with the best ownership overlap. Filter by category, minimum owners, and free/paid status. Admin-only for edits; all members can view.
- **Purchase Optimizer** — Greedy solver that finds the maximum number of tracks promotable to universal ownership within a per-member buy limit. Results are written to the grid as "buy" states.
- **Buy Recommendations** — Per-member best-value purchase suggestions based on how close each track is to full league coverage.
- **Overview** — Stats dashboard: universal tracks, one-away tracks, member library sizes, racing/non-racing breakdown.
- **Track Editor** (admin) — Add/remove/edit tracks with multi-category tags, configuration counts, and free-with-membership flags. Reset to iRacing defaults at any time.
- **League Admin** (admin) — Manage admins, toggle members between racing/not-racing, remove members.
- **Self-service rename** — Any member can change their driver name by clicking their name in the header.

## Authentication & Permissions

TrackBlender uses Google sign-in via Firebase Auth. The first person to sign in creates the league and becomes the admin.

- **Members** can edit their own ownership column and rename themselves.
- **Admins** can edit any member's ownership, manage the schedule, edit the track list, add/remove admins, toggle racing status, and remove members.
- **Non-racing members** appear in the grid (dimmed) but are excluded from all ownership calculations, buy recommendations, and the optimizer. Useful for league organizers who manage but don't race.

New members sign in with Google and pick a driver name. No invite system needed — share the URL and anyone with a Google account can join.

## Setup from Scratch

### 1. Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project.
2. **Firestore**: Build → Firestore Database → Create database → Start in test mode, any region.
3. **Auth**: Build → Authentication → Get started → Sign-in method tab → Enable **Google** → Set support email → Save.
4. **Web app config**: Project Settings (gear icon) → General → Your apps → Add web app (`</>`) → Register → Copy the `firebaseConfig` object.
5. Paste the config into `src/firebase.js`.

### 2. GitHub Pages

1. Push the repo to GitHub.
2. Go to repo → Settings → Pages → Source → **GitHub Actions**.
3. Pushes to `main` auto-deploy via the included workflow.

### 3. Authorized Domains

In Firebase Console → Authentication → Settings → Authorized domains, add your GitHub Pages domain (e.g. `your-username.github.io`).

### 4. Firestore Security Rules

In Firebase Console → Firestore → Rules, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAdmin(league) {
      return request.auth.uid in get(/databases/$(database)/documents/leagues/$(league)/data/config).data.adminUids;
    }

    match /leagues/{league}/data/{doc} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && isAdmin(league);
    }

    match /leagues/{league}/members/{uid} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null
        && (request.auth.uid == uid || isAdmin(league));
    }
  }
}
```

This ensures: any authenticated user can read everything and create their member document; only admins can modify league config, tracks, and schedules; members can only write to their own document (admins can write to any member document). The `isAdmin` function reads the config document to check the admin list, which costs one extra Firestore read per write.

## Firestore Data Model

```
leagues/{leagueId}/
  data/
    config    — { name, adminUids[], createdAt }
    tracks    — { list: [...track objects] }
    schedule  — { rounds: [...track names] }
  members/
    {uid}     — { displayName, ownership: {trackName: status}, racing: bool, joinedAt }
```

`leagueId` is currently `"default"`. The namespace exists to support multi-tenancy later.

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173/trackblender/`

## Project Structure

```
src/
  main.jsx        — React entry point
  App.jsx         — All UI components (auth flows, grid, schedule, optimizer, stats, admin)
  firebase.js     — Firebase config, auth, and Firestore read/write/subscribe functions
  tracks.js       — Default iRacing track database (148 tracks, multi-category, free flags)
```

## Tech Stack

- React 18 + Vite
- Firebase Auth (Google sign-in) + Firestore (real-time sync)
- GitHub Pages (static hosting via GitHub Actions)
- No CSS framework — inline styles with a custom dark theme

## Track Data

The default track list is sourced from [iracing.com/tracks](https://www.iracing.com/tracks/) (March 2026, 148 tracks). Each track has:

- **Name** — official iRacing name
- **Categories** — multi-select: road, oval, dirt-oval, dirt-road (tracks like Charlotte and Daytona have multiple)
- **Configs** — number of configurations (null if unknown, editable via Track Editor)
- **Free** — included with iRacing membership (excluded from buy recommendations)
