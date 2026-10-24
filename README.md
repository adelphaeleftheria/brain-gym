# Brain Gym

A private, local-first brain-training app built with React, strict TypeScript, Vite, Dexie/IndexedDB, Lucide, date-fns and Recharts. Dark by default, with light/system themes and a responsive layout. No backend, account, paid API, ads or analytics.

## Run

Use Node.js 22 or newer (validated here with Node 24).

```sh
npm ci
npm run dev
```

Open the path printed by Vite, including `/brain-gym/`. Navigation uses hashes so refreshing any destination works on GitHub Pages. Do not create an extra Git worktree for normal cloud tasks; the existing checkout is already isolated.

```sh
npm test                 # Vitest + Testing Library, generators, games, storage
npm run test:e2e         # Chromium browser journeys
npm run build           # strict typecheck + production bundle + offline worker
npm run preview -- --port 4174
node scripts/validate-production.mjs
```

Browser tests use `/usr/bin/chromium` when available. Else install Playwright Chromium with `npx playwright install chromium`. Set `CHROMIUM_PATH` to use another executable. The production validation script expects the preview above; set `VALIDATION_URL` to override its URL. In a restricted cloud environment the browser download domain may need permission; an installed browser avoids that dependency.

## What works

- Home, Daily Workout, Train, Challenges, Progress, Achievements, History and Settings.
- Eleven real exercises, each with instructions, difficulties, a defined endpoint, feedback, results and replay: Memory Sequence, Quick Math, Reaction Test, Pattern Logic, Focus Finder, Number Memory, Word Scramble, Spatial Rotation, N-Back Lite, Color & Word and Sequence Builder.
- Deterministic local-date daily workout ordering, five core exercises, checkpoints after each exercise, resume after reload and completion summary. Generated questions vary on replay. Workouts retain their difficulty once started.
- IndexedDB persistence, unique session IDs, reward deduplication, XP, levels, streaks, records, daily/weekly challenges and achievements with derived unlock dates.
- Actual-data charts (lazy loaded), category summaries, 90-day activity heatmap, date/game/category/difficulty filters and paginated searchable history.
- Optional onboarding, local profile, favorite categories, sound/volume, reduced motion, keyboard controls and searchable command palette. Use Ctrl/Cmd+K outside editable fields or the search button.
- Isolated, explicitly labeled sample workspace. Playing in demo does not affect real progress; demo modifications last only for the current page lifetime.
- JSON backup export, validated merge/replace restore, safety download before restore, CSV export and confirmed deletion/reset.
- Production-only offline worker with locally bundled assets, manifest, SVG icon and versioned caches. Offline requires one successful online load to cache the build. A waiting worker updates after existing app tabs close, avoiding mid-session replacement.

## Project map

```
src/app/             application shell, navigation, shared store
src/components/      dashboard, pages, settings, dialogs, result UI
src/games/           typed registry and shared game lifecycle/UI
src/domain/          models, generators, scoring, workouts, progression, demo
src/storage/         Dexie schema, backup validation, merge/export
src/styles/          theme tokens and responsive CSS
src/tests/           domain, storage and interactive game tests
e2e/                 browser journeys
scripts/             build-time offline worker and production validation
.github/workflows/   Pages deployment
```

Generators and scoring are independent of React. The game registry supplies metadata and instructions; `Play` owns the common session lifecycle, timing, input locks and completion. Session persistence and workout progression happen through one state update queue and an IndexedDB transaction that reads the latest persisted state. Cross-tab observers update open screens. A result ID can be recorded only once. Completed results are committed before the UI shows success; a failed save retains a retryable result in memory.

## Scores and progression

Scores describe performance **within each game**, not IQ or a shared measure of ability.

- Base score: round of `0.9 × accuracyPercent + min(10, correct / max(1, seconds) × 10)`, clamped to 0–100. With no correct answers the speed bonus is zero. Invalid score inputs return zero. Incorrect answers and skips count as attempts. Requested Word Scramble hints cost five points each, can be used once per word, and do not alter accuracy; Easy supplies a free first-letter hint.
- Version-2 scores multiply the base score by completed coverage: correct answers divided by the exercise target (10 math, 8 logic/words/spatial/sequence, 16 N-Back, 12 color, 5 number rounds, all focus targets). Memory uses fully recalled span divided by the final target span. Thus a one-answer arithmetic timeout cannot receive a full-session score. Requested word hints subtract five points after coverage. Prior saved results retain their original scores and are labeled as legacy; normalized records use version 2 when available.
- Reaction score: clamp `100 - (averageValidMs - 150) / 8` to 0–100. Each of five valid rounds uses `performance.now()`. Early taps and anticipated responses under 80 ms are false starts, never valid measurements. The average, fastest, slowest, false-start count and individual round times are retained. Browser rendering, displays, input hardware and accessibility tooling affect timing.
- Memory span is the longest fully reproduced sequence. It is kept separately from normalized score and used for memory records. Reaction records use the lowest valid average; other records use the highest score.
- Exercise XP: 20 + floor(accuracy/10) for the first five plays of each game per local day, then 5 XP per completion. Each newly established record earns 10 XP. A daily workout earns 100 XP, each first milestone earns 25 XP, and each completed challenge ID earns 30 XP once. Historical challenge XP remains earned after the calendar changes.
- Level N starts at `100 × (N−1)²` total XP. Core games are never locked.
- Streaks count consecutive local calendar dates with a completed session. An active streak includes yesterday until today ends. No guilt messaging or medical claims.

Rewards, records, challenge progress and unlock dates are derived from the versioned sessions/workouts, so refreshes and backup restores do not multiply rewards. Backup payloads contain the source data needed to reproduce them, plus profile/preferences, workout checkpoints, schema version and export timestamp. Invalid JSON, unsupported versions, duplicate IDs, invalid metrics or broken workout references are rejected before any write. Replace/merge is one IndexedDB state write.

## GitHub Pages deployment

1. Commit and push the project and lockfile to `main` in `adelphaeleftheria/brain-gym`.
2. In the repository's **Settings → Pages**, select **GitHub Actions** as the source.
3. Enable Actions and allow the workflow's Pages deployment permissions if your organization requires approval.
4. The included workflow checks out code, installs Node 22 and Chromium, runs `npm ci`, unit tests, browser tests, the production build and offline validation, uploads `dist`, then deploys through `actions/deploy-pages`.
5. After the workflow succeeds, verify the actual published site at your repository's Pages URL. Deployment has not been performed from this workspace.

Vite defaults to `/brain-gym/`. The workflow supplies `BASE_PATH=/<repository-name>/`, so repository renames remain supported. For a custom domain or user site build with `BASE_PATH=/ npm run build`. All worker, manifest, icon and asset URLs stay within the configured subpath. Hash routes do not need a server rewrite or custom 404.

## Data, accessibility and limits

Data lives in this browser's IndexedDB (`brain-gym`, schema v1); it does not sync across devices. Clearing site storage can remove it. Export backups regularly. Storage errors are surfaced without silently resetting data. There are no network calls for gameplay.

Buttons support keyboard navigation and visible focus. Native modal dialogs trap focus, support Escape and restore focus to the trigger. Feedback uses live regions; states have text as well as color. Numeric answers support Enter, memory has 1–9 shortcuts on the first nine tiles, and reaction supports Space. Motion follows both system and saved reduced-motion preferences. The color exercise deliberately requires color identification; an accessible ink-color label makes its rule explicit. Spatial puzzles remain visual exercises.

Workout pause/resume is between exercises. Reloading or hiding a tab restarts the unfinished exercise rather than resuming a potentially invalid timing measurement; earlier completed exercises remain saved. Only completed sessions enter history. There is no background push service; optional browser reminders work only while the app is open. Time preference is saved, while the complete daily workout is fixed at five exercises. There is no automatic difficulty adaptation, online competition or cross-device sync. PWA install prompts/icons vary by browser; full native packaging and closed-app reminders are outside this implementation.

The test suite uses deterministic randomness/virtual time for repeatability. Version-2 results retain local date keys so later time-zone changes do not reassign their training days. It verifies mechanics and state transitions, not the precision of any particular display or physical reaction measurement. Actual Pages publication, Safari/Firefox and assistive-technology audits still require their target environments.

## Review and limitations

See [AUDIT.md](AUDIT.md) for the acceptance matrix, fixes, verification coverage and remaining gaps against the original master prompt. These limits mean this release is not a claim that the entire original roadmap is complete.

## Observed validation in this workspace

- `npm ci` completed successfully with the lockfile.
- `npm test`: **37 passed** across domain/storage and all eleven interactive games, including full memory growth, reaction false starts, scoring boundaries and generator regression checks.
- `npm run test:e2e`: **25 passed** in installed Chromium: profile/palette/demo isolation, full daily workout with reload/resume, safe backup/restore and mobile controls for every core game.
- `npm run build`: passed strict TypeScript and production bundling with two JavaScript chunks (charts load separately).
- `node scripts/validate-production.mjs`: passed repository-subpath navigation, hash refresh, theme persistence, chart loading, a completed offline game and persisted offline history. No browser exceptions or failed asset requests.
- Development HTML and main module returned HTTP 200. `npm audit --omit=dev --audit-level=high` reported zero production dependency vulnerabilities.

These are current-machine results, not evidence of a published GitHub Pages deployment or validation in a newly restored cloud task. Cloud `install_script` and `start_skill` were saved as a draft; review and save them in environment settings, then publish the cloud environment to activate its reusable snapshot.
