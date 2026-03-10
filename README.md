# TrackBlender

iRacing track ownership manager for the **Tonight We Race** league. Helps figure out which tracks everyone owns, plan season schedules, and recommend purchases.

**Live site:** https://twr-chris.github.io/trackblender/

## Features

- **Ownership Grid** — Members mark which tracks they own. Click to cycle: unowned → owned → buy → unowned.
- **Schedule Builder** — Build a season from tracks with the best ownership overlap. Filter by category and minimum owners.
- **Buy Recommendations** — Shows each member which purchases would have the most impact for the league.
- **Overview** — Stats dashboard with universal tracks, one-away tracks, and member library sizes.
- **Track Editor** (admin) — Add/remove/edit tracks, categories, config counts, and free status.

Data is stored in Firebase Firestore and syncs in real-time across all users.

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173/trackblender/`

## Deploying

Pushes to `main` auto-deploy to GitHub Pages via the included GitHub Actions workflow.

### First-time GitHub Pages setup:

1. Go to your repo → Settings → Pages
2. Under "Build and deployment", set Source to **GitHub Actions**
3. Push to main — the workflow will build and deploy automatically

### Firebase setup (already done):

The Firestore database is at `trackblender.firebaseapp.com`. Current security rules are in test mode. To lock down:

1. Go to [Firebase Console](https://console.firebase.google.com) → Firestore → Rules
2. Replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /league/{document=**} {
      allow read, write: if true;
    }
  }
}
```

This allows anyone with the URL to read/write league data (which is what you want for a league tool). For tighter security, you could add Firebase Auth later.

## Project Structure

```
src/
  main.jsx        — React entry point
  App.jsx         — All UI components
  firebase.js     — Firebase config + storage adapter
  tracks.js       — Default iRacing track database
```

## Tech Stack

- React 18 + Vite
- Firebase Firestore (real-time sync)
- GitHub Pages (hosting)
- No CSS framework — inline styles with a custom dark theme
