# CLAUDE.md

Context document for Claude Code. This captures the intent, architecture, key decisions, and roadmap for TrackBlender so that AI-assisted development sessions start with full context.

## What This Is

TrackBlender is a league track ownership manager for iRacing. It helps racing leagues figure out which tracks their members own, plan season schedules around maximum ownership overlap, and optimize purchase recommendations so the league gets the most value out of each member's content budget.

Live at: https://twr-chris.github.io/trackblender/
Licensed MIT. Other leagues are welcome to fork and deploy their own instances.

## Tech Stack

- React 18 + Vite
- Firebase Auth (Google sign-in) + Firestore (real-time sync)
- GitHub Pages via GitHub Actions (static hosting, auto-deploys on push to main)
- No CSS framework — inline styles with a custom dark theme (color constants in `src/lib/shared.js`)
- No server component — entirely client-side; Firebase handles auth and persistence

## Project Structure

```
src/
  App.jsx              — Shell, auth flow, data loading, tab routing
  main.jsx             — React entry point
  firebase.js          — Firebase config, auth, Firestore CRUD + real-time subscriptions
  tracks.js            — Default iRacing track database (148 tracks, multi-category, free flags)
  lib/
    shared.js          — Color constants, category definitions, shared style objects
    solver.js          — Branch-and-bound purchase optimizer
    parser.js          — iRacing paste parser + track name alias map
  components/
    shared.jsx         — Reusable UI atoms: CatTags, Badges, StatCard, Empty
    auth.jsx           — SignIn, CreateLeague, Claim, FullScreen, UserName
    Grid.jsx           — Ownership grid + toggle logic
    Schedule.jsx       — Season schedule builder
    BuyRecs.jsx        — Purchase optimizer UI + best-value recommendations
    Stats.jsx          — Overview / stats dashboard
    Editor.jsx         — Track editor (admin-only)
    LeagueAdmin.jsx    — Admin panel (member management, permissions)
    ImportModal.jsx    — iRacing track paste importer
```

The codebase was originally a single-file monolith (App.jsx at ~1,340 lines). It was refactored into 16 modules with single responsibilities. No file exceeds ~215 lines. No logic changed during the split — it was a pure structural refactor.

## Firestore Data Model

```
leagues/{leagueId}/
  data/
    config    — { name, adminUids[], createdAt }
    tracks    — { list: [...track objects] }
    schedule  — { rounds: [...track names] }
  members/
    {uid}     — { displayName, email, ownership: {trackName: status}, racing: bool, joinedAt }
```

`leagueId` is currently `"default"`. The namespace exists to support multi-tenancy later without a data migration.

### Key data conventions

- Track ownership statuses: `"owned"`, `"unowned"`, `"buy"` (set by the optimizer only, never by manual toggle)
- Each track object: `{ name, cats: string[], configs: number|null, free: boolean }`
- The `racing` flag on members controls inclusion in calculations. Non-racing members appear dimmed in the grid but are excluded from the optimizer, schedule builder counts, and buy recommendations.

## Real-Time Sync

All data syncs via Firestore `onSnapshot` listeners. A `pendingWrites` guard prevents the "revert on echo" race condition: when a user makes a change, inbound sync updates for their document are temporarily suppressed until the write completes. Saves are debounced at 400ms.

## Authentication & Permissions

- First user to sign in creates the league and becomes admin.
- Members can edit their own ownership column and rename themselves.
- Admins can edit any member's data, manage the schedule, edit tracks, and administer the league.
- Firestore security rules enforce this — members can only write their own document, admins can write anything. The `isAdmin` check reads the config document (costs one extra Firestore read per write, negligible at this scale).
- The Firebase API key in source is intentionally public — it's a client-side project identifier, not a secret. Security comes from Firestore rules.

## Key Design Decisions and Their Rationale

### Branch-and-bound optimizer (not greedy)

The purchase optimizer started as a greedy algorithm (always pick the cheapest track next). This failed in practice: greedy could find 5 promotable tracks but miss that a different combination including a slightly more expensive track would promote 6. The solver was replaced with branch-and-bound, which explores the full solution space with aggressive pruning. It's seeded with the greedy solution as a lower bound so even if it hits the 500K iteration safety cap, it returns at minimum the greedy result.

The optimizer supports forced tracks (must be included regardless of cost) and excluded tracks (invisible to the solver). Force and exclude are mutually exclusive per track.

### "Buy" state is optimizer-only

Users cannot manually set the "buy" state on a track. It's exclusively written by the purchase optimizer. This keeps buy states meaningful as recommendations rather than wish lists. The grid toggle cycle is: unowned → owned (and buy → owned, for confirming a purchase). The Schedule Builder counts "buy" as owned, so the workflow is: run optimizer → review buy assignments → build season using projected ownership → members purchase and confirm.

### iRacing paste import is destructive

The import modal resets the target member's ownership to only include tracks found in the paste. This is intentional — the iRacing client is the source of truth for what someone owns, so partial imports would create drift. The parser uses a three-tier matching strategy: explicit alias map → normalized string comparison → substring containment fallback. New mismatches get added to `TRACK_ALIASES` in `parser.js`.

### Monolith-first, refactor when it hurts

The app was built as a single file and only split into modules when editing friction became real (str_replace collisions, difficulty navigating 1,300+ lines). The refactor trigger was a feature that touched three tabs simultaneously. This was a deliberate sequencing choice — architecture follows need, not anticipation.

### No backend server

Everything runs client-side. Firebase handles auth, persistence, and real-time sync. This keeps hosting trivially simple (GitHub Pages) and eliminates server costs. The tradeoff is that any future feature requiring server-side logic (scraping, scheduled jobs, API proxying) would need a new layer — likely Firebase Cloud Functions.

## iRacing Track Data

The default track list (148 tracks as of March 2026) is sourced from iracing.com/tracks. Each track has a name, category tags (road, oval, dirt-oval, dirt-road — many tracks span multiple), configuration count, and a free flag. Free tracks are auto-owned for everyone and excluded from purchase recommendations and the optimizer.

The track list is stored in Firestore and editable via the Track Editor. The defaults in `tracks.js` are only used when seeding a new league. Track name mismatches between the iRacing client and the database are handled by the alias map in `parser.js`.

## Roadmap / Future Directions

These are features that have been discussed or considered, roughly ordered by how fleshed-out the thinking is:

### Driver profile slides (designed, not yet built)
A workflow where drivers submit a photo and livery image through TrackBlender, an admin reviews composited slides against a template, and approved slides are pushed to a Google Slides seasonal deck via the Slides API. The design calls for: a driver submission form with Firebase Storage for images, an admin review queue with in-browser preview, and Google OAuth scoped to the admin only. A quadrant layout was specced (driver name + number top-left, driver photo top-right, livery bottom-left, league record bottom-right). The record would auto-populate from existing Firestore data; the admin assigns a subtitle tag.

### "Bring a Trailer Challenge" slide generator (designed, not yet built)
A five-slide reveal sequence for a between-races game segment. Input: two BaT auction URLs. Output: five slides progressing from solo reveal → pair reveal → detail overlay → clean pair → price reveal. The tool would scrape listing data (title, hero image, sale price) and optionally use an LLM to generate spec bullet points. This was explored as a standalone app or a TrackBlender feature — the slide generation pipeline is similar to the driver profile system.

### Season history / archive
Snapshot each season's schedule and ownership state. Would enable trend analysis ("you raced Spa three of four seasons") and smarter recommendations.

### Track voting
Admin proposes a candidate pool, drivers rank preferences, results feed into the schedule builder weighted by both preference and ownership coverage. Shifts schedule-building from admin-driven to league-driven.

### iRacing series awareness
Surface which tracks are in current official series rotation, making buy recommendations account for both league and official race value. Data changes every 12 weeks; would require manual updates or a forum scrape.

### Mobile responsiveness
The auth screens, Buy Recs, and Stats are reasonably usable on mobile. The Ownership Grid and Schedule Builder are fundamentally desktop layouts — a track × member matrix doesn't fit on 375px. A card-based mobile view was discussed but not prioritized.

## Development Notes

### Local dev
```bash
npm install
npm run dev
```
Opens at http://localhost:5173/trackblender/. Local dev connects to the production Firebase project — there's no separate dev database. Changes are live.

### Deploying
Push to `main`. GitHub Actions builds and deploys to GitHub Pages automatically.

### Conventions
- Inline styles throughout, using the `C` color constants from `shared.js`. No CSS files.
- Props are passed explicitly — no React context. This was a conscious choice to keep data flow traceable.
- The app uses a tabbed layout. Each tab is a self-contained component receiving the same core props (`data`, `save`, `names`, `map`, `currentUser`, `isAdmin`).
- Track names are the primary key everywhere. This works because iRacing track names are unique and stable, but it means renaming a track in the editor would orphan ownership data. This is a known limitation.

### Track alias maintenance
When new track name mismatches are discovered (usually after an iRacing content update or when a new member tries to import), add the alias to `TRACK_ALIASES` in `src/lib/parser.js`. The key is the lowercased paste name, the value is the exact database name.