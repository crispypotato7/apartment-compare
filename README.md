# Apartment Compare

Local-first apartment comparison app for personal apartment hunting. Data stays in a SQLite file on this machine.

## Location
- Project root: `/Users/utkbhard/personal-projects/apartment-compare`
- SQLite database: `data/apartments.db`

## Run
```bash
npm install
npm start
```

Then open `http://127.0.0.1:3000` in a browser.

## What It Does
- Import a Zillow listing URL for best-effort autofill.
- Edit or fill missing apartment details manually.
- Track bedroom square footage and auto-calculate weighted roommate rent splits.
- Store custom factors such as sunlight, noise, or landlord responsiveness.
- Save manual commute times for key destinations.
- Compare multiple apartments side by side.
- Export the current data set to CSV for Excel use.

## Notes
- Zillow import is best-effort and depends on data embedded in the listing page.
- If Zillow blocks or omits some fields, fill them in manually and save.
- iPhone use on the same network works by opening the laptop-hosted app in Safari once the server is running.
- Remote/private access can be added later without changing the local data model.

## Test
```bash
npm test
```

## Live Zillow Verification
Run the live importer check against the current Zillow page for the wired test URL:

```bash
npm run test:live
```

This is opt-in because it depends on Zillow's current response shape and anti-bot behavior.
