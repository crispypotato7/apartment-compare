# Apartment Compare Implementation Plan

**Goal:** Build a local-first apartment comparison web app with SQLite-backed storage, Zillow import, extensible factors, weighted rent calculations, and a mobile-friendly compare UI.

**Architecture:** Use a Node.js Express server that serves a responsive static frontend and a small JSON API. Persist apartment records in SQLite with relational tables for bedrooms, custom fields, and commute metadata. Keep Zillow import isolated in a parser module so failed scraping degrades into partial prefill plus manual completion instead of blocking the app.

**Constraints:**
- All code and data must remain under `/Users/utkbhard/personal-projects/apartment-compare`.
- No dependency on work repositories or work services.
- Use local SQLite as the source of truth.
- v1 remains local-first; remote exposure is deferred.
- Transit commute values are manual placeholders in v1, but the schema must support later automation.

**Acceptance Signals:**
- `npm test` passes.
- `npm start` launches the app successfully.
- Zillow import endpoint returns normalized partial data for a fixture page.
- Comparison UI renders multiple apartments with derived metrics.
- CSV export endpoint returns apartment data.

## Task 1: Scaffold project and prove baseline

**Step 1: Create project skeleton**
- Files: `package.json`, `src/server.js`, `src/app.js`, `src/db/*`, `src/routes/*`, `src/services/*`, `public/*`, `test/*`

**Step 2: Install runtime and test dependencies**
- Command: `npm install`
- Expected: install completes without errors

**Step 3: Add baseline smoke test**
- Command: `npm test`
- Expected: fail for the right reason because the app routes/modules are not implemented yet

**Step 4: Implement minimal app bootstrap**
- Scope limits: only enough server code to satisfy the smoke test

**Step 5: Verify targeted test**
- Command: `npm test -- --test-name-pattern="serves the app shell"`
- Expected: pass

## Task 2: Define SQLite schema and apartment calculations

**Step 1: Add failing calculation and persistence tests**
- Command: `npm test -- --test-name-pattern="weighted bedroom rents|persists apartments"`
- Expected: fail for missing calculation/database behavior

**Step 2: Implement minimal schema and calculation helpers**
- Scope limits: database initialization, apartment CRUD core path, weighted-rent math only

**Step 3: Verify targeted tests**
- Command: `npm test -- --test-name-pattern="weighted bedroom rents|persists apartments"`
- Expected: pass

**Step 4: Verify broader suite**
- Command: `npm test`
- Expected: pass

## Task 3: Implement Zillow import normalization

**Step 1: Add failing parser and API tests**
- Command: `npm test -- --test-name-pattern="imports Zillow listing data"`
- Expected: fail because parser/import route is incomplete

**Step 2: Implement import service with fixture-backed parser**
- Scope limits: parse embedded structured data or JSON blobs from Zillow HTML fixtures; no live anti-bot workarounds

**Step 3: Verify targeted tests**
- Command: `npm test -- --test-name-pattern="imports Zillow listing data"`
- Expected: pass

**Step 4: Verify broader suite**
- Command: `npm test`
- Expected: pass

## Task 4: Build responsive add/edit/browse/compare UI

**Step 1: Add failing UI-oriented API tests**
- Command: `npm test -- --test-name-pattern="lists apartments for comparison|stores custom factors"`
- Expected: fail because routes or data shape are incomplete

**Step 2: Implement minimal UI and remaining API routes**
- Scope limits: responsive layout, apartment form, compare table/cards, custom factor management, CSV export

**Step 3: Verify targeted tests**
- Command: `npm test -- --test-name-pattern="lists apartments for comparison|stores custom factors"`
- Expected: pass

**Step 4: Verify broader suite**
- Command: `npm test`
- Expected: pass

## Task 5: Manual verification and run instructions

**Step 1: Start the app**
- Command: `npm start`
- Expected: server starts and reports a local URL

**Step 2: Smoke test core flows**
- Command: `curl -I http://127.0.0.1:3000`
- Expected: HTTP 200 response

**Step 3: Document usage**
- Files: `README.md`
- Scope limits: local startup, data location, CSV export, Zillow import caveats, iPhone-on-local-network note

**Step 4: Final verification**
- Command: `npm test`
- Expected: pass
