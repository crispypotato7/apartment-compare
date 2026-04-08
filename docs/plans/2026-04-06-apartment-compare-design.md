# Apartment Compare Design

**Date:** 2026-04-06

## Goal
Build a personal, local-first apartment comparison web app that stores apartment data in a local SQLite database, supports best-effort Zillow import, calculates shared-cost metrics, and works well on desktop and iPhone browsers.

## Scope
- Run locally from a dedicated personal directory outside work repositories.
- Mobile-friendly responsive web UI.
- Add apartment records by Zillow URL or manual form entry.
- Extract whatever structured listing data is available from Zillow pages, then prompt for missing values.
- Store apartment records, user-entered bedroom sizes, and extensible custom factors locally.
- Calculate per-bedroom weighted rent shares from bedroom square footage.
- Compare two or more saved apartments side by side.
- Export/import CSV for spreadsheet use outside the app.

## Non-Goals
- Public hosting or remote exposure in v1.
- Fully automatic public-transit commute calculation in v1.
- OCR extraction from floorplan images in v1.
- Perfect Zillow support for every listing layout or anti-bot condition.

## Constraints
- Keep all project files under `/Users/utkbhard/personal-projects/apartment-compare`.
- Do not depend on any work repository or shared work code.
- Use software that is free and installable on this machine.
- Design for schema evolution so new apartment factors can be added later.
- Assume Zillow import is best-effort and can fail partially.

## Architecture
- Node.js application with an Express server.
- SQLite database stored as a local file under `data/apartments.db`.
- Static frontend using HTML, CSS, and client-side JavaScript for a lightweight local-first setup.
- Server-side import module that fetches a Zillow page, parses embedded data when possible, and normalizes it into the local schema.
- Database model split into stable apartment fields plus flexible custom attribute rows.

## Data Model
- `apartments`: core fields like address, url, neighborhood, bedrooms, bathrooms, total square footage, rent, laundry, pets, parking, den flag, notes, and imported metadata.
- `bedrooms`: one row per bedroom with optional name and square footage.
- `commute_targets`: seeded destinations for future commute support.
- `apartment_commutes`: manual commute values for v1, API-backed later.
- `custom_fields`: user-defined field definitions.
- `apartment_custom_values`: per-apartment values for those custom fields.

## Risks
- Zillow scraping may fail or return partial data.
- Bedroom-level square footage is commonly unavailable and will require manual entry.
- CSV import/export must preserve enough structure to remain useful without trying to encode every relational detail into one sheet.

## Acceptance Criteria
- User can paste a Zillow URL and get a prefilled edit form.
- User can manually complete and save any missing fields.
- Weighted per-bedroom rent allocations are computed automatically from room square footage.
- User can browse apartments and compare multiple saved records.
- User can add custom factors and fill them in per apartment.
- UI is usable on iPhone Safari.
- Data persists locally in SQLite and can be exported to CSV.

## Verification Approach
- Unit tests for normalization and calculation logic.
- API tests for create/import/update/export flows.
- Manual responsive smoke test in a desktop browser sized to phone dimensions.
