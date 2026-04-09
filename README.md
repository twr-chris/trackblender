# TrackBlender

iRacing league track ownership manager. Helps leagues figure out which tracks everyone owns, plan season schedules, optimize purchases, and manage members — all with real-time sync and Google sign-in. TrackBlender is developed to support Tongiht We Race, Seattle's Secret Underground Racing Laboratory. Build-from-scratch capability is not expected until v1.0 is committed, so play around at your own risk.

- https://www.tonightwerace.gg
- https://discord.gg/A5BbadESjK

## The Laziest League Admin

If you, like me, find maintaining infrastructure tedious, please delight in this zero cost, zero operational load solution.

## Features

- **Ownership Grid** — Each member marks their own tracks (click to toggle owned/unowned). Your column is always leftmost. Admins can edit any column. Non-racing members are dimmed and excluded from calculations.
- **iRacing Import** — Paste your licensed track list directly from the iRacing client. A fuzzy parser matches track names and bulk-sets ownership. Admins can import on behalf of any member.
- **Schedule Builder** — Build a season from tracks with the best ownership overlap. Counts both owned and "buy" states, so you can plan off the optimizer's hypothetical purchases. Filter by category, minimum owners, and free/paid. Admin-only for edits; all members can view.
- **Purchase Optimizer** — Greedy solver that maximizes tracks promotable to universal ownership within a per-member buy limit. Supports "force buy" tracks that must be included regardless of efficiency. Results are written as buy states visible across the app.
- **Buy Recommendations** — Per-member best-value purchase suggestions based on proximity to full league coverage.
- **League Overview** — Landing page with league-wide stats: member count, races logged, estimated hours driven, ELO leaderboard (top 5), recent races, most raced tracks, and per-season summary.
- **iRacing API Import** (admin) — Pull race results directly from iRacing's Data API. Select a season, pick sessions, and import — no JSON file export needed. Uses a Firebase Cloud Function to securely proxy requests with OAuth credentials. Falls back to JSON file import for offline use.
- **League ELO** — Enter race results manually with a drag-to-position UI, bulk-import from iRacing event result JSON files (multi-file, multi-class), or pull directly from the iRacing API. Automatic driver resolution via iRacing customer ID, aliases, and display name. Supports virtual members for shared-pod/local drivers with seasonal identity mapping. On-demand ELO calculation using a pairwise multi-player algorithm with tunable K-factor. Standings with provisional filtering, race history grouped by season, and admin tools for linking external drivers.
- **My Stats** — Personal driver stats under the ELO tab: lifetime summary (races, wins, podiums, avg/best finish, ELO), per-season rollup, and collapsible season-grouped race history. Driver picker lets you view any league member's stats.
- **Ownership Overview** (admin) — Stats dashboard: universal tracks, one-away tracks, member library sizes, racing/non-racing breakdown.
- **Track Editor** (admin) — Add/remove/edit tracks with multi-category tags (road, oval, dirt-oval, dirt-road), configuration counts, and free-with-membership flags. Reset to iRacing defaults at any time.
- **League Admin** (admin) — Manage admins, toggle racing/not-racing status, set driver aliases and iRacing customer IDs for race result matching, create virtual members for local/pod drivers, configure iRacing league ID for API imports, view member emails and UIDs (for de-duplication), remove members. Sortable by join date or name.
- **League Logo** (admin) — Upload a custom logo that replaces the default icon in the header. Image is resized client-side and stored in Firestore as a base64 data URL.
- **Self-service rename** — Any member can change their driver name by clicking their name in the header.

## How It Works

### For league members

1. Open the site and sign in with Google.
2. Pick a driver name on first visit.
3. Go to the Ownership Grid and mark your tracks, or use "Import from iRacing" to bulk-import from the client.
4. Check the Schedule Builder to see the upcoming season and what you're missing.
5. Check Buy Recs to see what purchases would help the league most.

### For the league admin

The first person to sign in creates the league and becomes the admin. From there:

1. Share the URL with your league — anyone with a Google account can join.
2. Use the Track Editor to maintain the track list (add new releases, update categories, mark free tracks).
3. Use the Purchase Optimizer to find the best set of buys for the league, optionally forcing specific tracks into the plan.
4. Build the season schedule in the Schedule Builder, which reflects both current ownership and planned purchases.
5. Use League Admin to manage members: toggle racing/not-racing for non-participants, promote additional admins, de-duplicate accidental signups using email/UID info.

### Buy state workflow

The "buy" state on a track is only settable by the Purchase Optimizer — members can't manually toggle it. This keeps buy states meaningful: they represent the optimizer's recommendation. The Schedule Builder counts buy states as owned, so you can plan a season around hypothetical purchases. Once a member actually buys a track, they click the BUY cell to promote it to owned.

## Authentication & Permissions

TrackBlender uses Google sign-in via Firebase Auth. No passwords, no accounts to manage.

- **Members** can edit their own ownership column, import their own tracks, and rename themselves.
- **Admins** can edit any member's ownership, import for any member, manage the schedule, edit the track list, run the optimizer, add/remove admins, toggle racing status, and remove members.
- **Non-racing members** appear in the grid (dimmed) but are excluded from all ownership calculations, buy recommendations, the optimizer, and the "who needs what" display. Useful for league organizers who manage but don't race.

## Setup from Scratch

### 1. Create a Firebase Project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project. You can skip Google Analytics.
2. **Firestore Database**: In the left sidebar, click Build → Firestore Database → Create database. Choose "Start in test mode" and any region (us-central1 is fine for US-based leagues). Test mode expires after 30 days — you'll replace the rules in step 4.
3. **Authentication**: Click Build → Authentication → Get started. Go to the Sign-in method tab, click Google, toggle Enable, set a support email (your email), and Save.
4. **Web app config**: Click the gear icon (Project Settings) → General tab → scroll to "Your apps" → click the web icon (`</>`) → give it a nickname → Register app. Copy the `firebaseConfig` object.
5. Paste the config values into `src/firebase.js`, replacing the existing config.

### 2. Set Up the Repository

Clone or fork this repo, then push to your own GitHub repository.

The GitHub Actions workflow (`deploy.yml`) uses `npm install` instead of `npm ci`, so no lock file is needed. If you want faster builds, run `npm install` locally once to generate `package-lock.json`, commit it, and change the workflow back to `npm ci` with `cache: npm` enabled.

### 3. Enable GitHub Pages

1. Go to your repo on GitHub → Settings → Pages.
2. Under "Build and deployment", set Source to **GitHub Actions**.
3. Push to `main` — the workflow will build and deploy automatically.
4. Your site will be at `https://your-username.github.io/your-repo-name/`.

If you use a different repo name than `trackblender`, update the `base` path in `vite.config.js` to match.

### 4. Authorize Your Domain

In Firebase Console → Authentication → Settings tab → Authorized domains, click Add domain and enter your GitHub Pages domain (e.g. `your-username.github.io`). Without this, Google sign-in will fail with an "unauthorized domain" error.

If you later add a custom domain, add that here too.

### 5. Set Firestore Security Rules

In Firebase Console → Firestore Database → Rules tab, replace the default rules with:

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

    match /leagues/{league}/races/{raceId} {
      allow read: if request.auth != null;
      allow create, update, delete: if request.auth != null && isAdmin(league);
    }
  }
}
```

Click Publish. These rules enforce:

- **Read**: any authenticated user can read all league data.
- **Create**: any authenticated user can create documents (needed for the first-run league creation and member join flow).
- **Update/delete league config, tracks, schedule**: admin only. The `isAdmin` helper reads the config document to check the admin list (costs one extra Firestore read per write, negligible at league scale).
- **Update/delete member documents**: the member themselves or an admin. This is how members edit their own ownership and admins can edit anyone's.
- **Race records**: admin only for all writes. All authenticated users can read.

The `allow create` on data documents is intentionally open to handle the first-run case where no config document exists yet (so no admin list to check against). After the league is created, new data documents are rare — tracks and schedule already exist and only get updated, not created.

### 6. First Sign-In

Open your deployed site. You'll see a Google sign-in screen. Sign in — since no league exists yet, you'll be prompted to name your league and pick your driver name. You're now the admin.

Share the URL with your league members. They sign in, pick a driver name, and start marking tracks.

### 7. iRacing API Integration (Optional)

This enables pulling race results directly from iRacing instead of exporting JSON files manually. Requires a Blaze (pay-as-you-go) Firebase plan (free tier covers typical league usage).

1. **Get iRacing API credentials**: Contact iRacing to request a "password_limited" OAuth client for their Data API. They'll give you a client ID and client secret. This flow is limited to 3 registered users and is intended for headless/server applications.
2. **Upgrade to Blaze plan**: Visit Firebase Console → Usage & billing → upgrade to Blaze. Required for Cloud Functions and Secret Manager.
3. **Set secrets**:
   ```bash
   firebase functions:secrets:set IRACING_CLIENT_ID
   firebase functions:secrets:set IRACING_CLIENT_SECRET
   firebase functions:secrets:set IRACING_USERNAME
   firebase functions:secrets:set IRACING_PASSWORD
   ```
4. **Install and deploy**:
   ```bash
   cd functions && npm install && cd ..
   firebase deploy --only functions
   ```
5. **Grant IAM roles**: In Google Cloud Console → IAM, find your compute service account (`{project-number}-compute@developer.gserviceaccount.com`) and add: **Cloud Build Service Account**, **Cloud Datastore User**, and **Cloud Firestore Service Agent**.
6. **Allow public access**: In Cloud Run console, find the `iracingproxy` service → Security tab → select "Allow public access". The Firebase callable SDK handles user authentication; the Cloud Run layer just needs to let requests through.
7. **Configure league ID**: In the app, go to League Admin → set your iRacing League ID (find it on iRacing's league page URL).

## About the Firebase Config in Source Code

The `firebaseConfig` object in `src/firebase.js` is committed to the repo. This looks like an exposed secret but isn't — it's a client-side project identifier, not an access credential. Every Firebase web app works this way (inspect the source of any Firebase-powered site and you'll find the same). Google designed this to be public.

The config tells the Firebase SDK where your project lives. It does not grant access. Access is controlled entirely by your Firestore security rules, which require Google authentication and enforce per-user write restrictions.

The actual attack surface: someone could find your config, initialize a Firebase SDK, authenticate with a Google account, and join your league as a new member. They could then write to their own member document. They cannot read or modify other members' data, the track list, or the schedule (unless they're an admin). This is the same "threat" as someone joining your Discord with a burner account — a nuisance, not a security breach. You'd see them in League Admin and remove them.

If this still bothers you, you can move the config to environment variables (`VITE_FIREBASE_API_KEY` etc. in a gitignored `.env` file). The values still end up in the built JavaScript bundle served to browsers, so it's not meaningfully more secure — but it keeps automated secret scanners from flagging the repo.

## Firestore Data Model

```
leagues/{leagueId}/
  data/
    config      — { name, adminUids[], logoUrl?: string, iracingLeagueId?: number, createdAt, updatedAt }
    tracks      — { list: [...track objects], updatedAt }
    schedule    — { rounds: [...track names], updatedAt }
    eloRatings  — { ratings: {driverKey: {elo, racesPlayed}}, kFactor, lastCalculatedAt }
  members/
    {uid}       — { displayName, email, ownership: {trackName: status}, aliases: string[], iracingCustId: string?, virtual: bool?, racing: bool, joinedAt, updatedAt }
  races/
    {autoId}    — { date, raceNumber, trackName, season, raceClass, results: [{driverKey, name, position}], createdAt }
```

`leagueId` is currently hardcoded as `"default"`. The namespace exists to support multi-tenancy later without a data migration.

Each track object in the `tracks.list` array has: `name` (string), `cats` (string array of categories), `configs` (number or null), `free` (boolean).

Ownership status values: `"owned"`, `"unowned"`, `"buy"` (set by the optimizer only).

## iRacing Import

Members can bulk-import their track ownership by pasting text from the iRacing client's "My Licensed Tracks" screen (list view, Ctrl+A, Ctrl+C). The parser:

1. Identifies the track data section between the "Track Name" header and "Licenses" footer.
2. Extracts track names and configuration counts from the alternating name/number line format.
3. Matches names to the database using three tiers: explicit alias map (for known mismatches like "Road Atlanta" → "Michelin Raceway Road Atlanta"), normalized string comparison (case/punctuation insensitive), and substring containment as a fallback.
4. Shows a preview of matched and unmatched tracks before committing.

The import is destructive — it resets the target member's ownership to only include tracks found in the paste. This is intentional: the iRacing client is the source of truth for what someone owns.

If new track name mismatches are discovered, add them to the `TRACK_ALIASES` map in `src/lib/parser.js`.

## Local Development

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173/trackblender/`

The app connects to your production Firebase project even in dev mode. There's no separate dev database — changes you make locally are live. If you want isolation, create a second Firebase project and swap the config.

## Project Structure

```
src/
  App.jsx              — Shell, auth flow, data loading, tab routing
  main.jsx             — React entry point
  firebase.js          — Firebase config, auth, Firestore CRUD, real-time subscriptions, iRacing API callables
  tracks.js            — Default iRacing track database (148 tracks, multi-category, free flags)
  lib/
    shared.js          — Color constants, category definitions, shared style objects
    solver.js          — Branch-and-bound purchase optimizer
    parser.js          — iRacing paste parser + track name alias map
    elo.js             — Multi-player ELO calculation (pairwise algorithm)
    iracing-parser.js  — iRacing event result JSON parser (driver resolution, multi-class)
  components/
    shared.jsx         — Reusable UI atoms: CatTags, Badges, StatCard, Empty
    auth.jsx           — SignIn, CreateLeague, Claim, FullScreen, UserName
    Grid.jsx           — Ownership grid + toggle logic
    Schedule.jsx       — Season schedule builder
    BuyRecs.jsx        — Purchase optimizer UI + best-value recommendations
    LeagueOverview.jsx — League overview: league-wide stats, ELO leaderboard, recent races
    Stats.jsx          — Ownership overview / stats dashboard (admin-only)
    Elo.jsx            — ELO tab: standings, race results, my stats, settings, iRacing API import
    Editor.jsx         — Track editor (admin-only)
    LeagueAdmin.jsx    — Admin panel (member management, permissions, driver aliases, iRacing league ID)
    ImportModal.jsx    — iRacing track paste importer
functions/
  index.js             — Firebase callable: iracingProxy (admin-only iRacing Data API proxy)
  lib/
    iracing-auth.js    — iRacing OAuth2 password_limited flow, token caching
    iracing-api.js     — iRacing Data API request helper
```

## Tech Stack

- React 18 + Vite
- Firebase Auth (Google sign-in) + Firestore (real-time sync)
- GitHub Pages (static hosting via GitHub Actions)
- Firebase Cloud Functions (v2, Node 22) — iRacing Data API proxy
- No CSS framework — inline styles with a custom dark theme

## Track Data

The default track list is sourced from [iracing.com/tracks](https://www.iracing.com/tracks/) (March 2026, 148 tracks). Each track has:

- **Name** — official iRacing name
- **Categories** — multi-select: road, oval, dirt-oval, dirt-road (tracks like Charlotte and Daytona span multiple types)
- **Configs** — number of layout configurations (null if unknown, populated via import or Track Editor)
- **Free** — included with iRacing membership (auto-owned for everyone, excluded from buy recommendations and the optimizer)

The track list is stored in Firestore and editable via the Track Editor. The defaults in `tracks.js` are only used when seeding a new league.

## Real-Time Sync

All data syncs in real-time via Firestore's `onSnapshot` listeners. If two members are filling in tracks at the same time, they see each other's changes appear live. The app uses a `pendingWrites` guard to prevent race conditions: when you make a change, inbound sync updates for your document are temporarily ignored until your write completes, preventing the "revert on echo" problem.

Saves are debounced (400ms) to avoid excessive Firestore writes during rapid clicking.
