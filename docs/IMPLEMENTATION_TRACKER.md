# JalRakshak implementation tracker

Branch: `feature/login-page-ui`.

## Stage status

- Stages 1–3: existing Incident Queue, lifecycle sync, and navigation persistence retained. User reported the working flow; this change does not claim a full re-test of those stages.
- Stage 4: ✅ shared-hazard implementation and isolated automated verification complete. One smoke check on the user's local installation remains.
- Stage 5: next — complete automatic reroute coordination, backend route invalidation, and responder/citizen notifications.
- Stages 6–20: pending in the user's original priority order. In particular, the complete geographic Admin Live Map and operational NavCat are not part of Stage 4.

## Stage 4 changes

- New `hazard_reports` table in the existing database: GPS, accuracy, type, server timestamps, authenticated reporter/source, optional photo, active/resolved status and resolution audit fields. Existing startup creates this new table without resetting emergency records. Development SQLite persists it; configured PostgreSQL uses the same model.
- Signed-in citizens/responders share `GET /api/v1/hazards?status=active`. `status=resolved` and `status=all` are also supported. No six-hour silent expiry and no browser-local authoritative hazard list.
- `POST /api/v1/hazards` requires a UUID `client_request_id`, kind, latitude and longitude. Accuracy and base64 photo are optional. Repeating the same submission is idempotent. Reporter identity, source and timestamps cannot be supplied by the caller.
- `PATCH /api/v1/hazards/{id}` accepts `{"status":"resolved"}` or `{"status":"active"}`. Only a verified `worker` token can change status (the existing app uses this role for responders/admins).
- `GET /api/v1/hazards/{id}/photo` returns a JPEG data URL only to the reporter or a responder. Photos are checked for actual JPEG/PNG/WebP content, capped at 8 MB/20 megapixels, reduced to 1600 pixels and re-encoded without EXIF metadata. Request streams are capped at 12 MB. Validation errors do not echo image data.
- The existing NavCat attachment picker saves through the API, prevents double submits, retains failed submissions for retry, and uploads the optional photo only after the checkbox is selected. It clearly distinguishes a saved report from a failed route calculation.
- Existing Leaflet hazard markers read the shared feed with a freshness/unavailable label. Worker popups offer photo review and resolution. The full Admin Live Map is still Stage 6; no second map/enhancer was introduced.
- One reference-counted poller refreshes mounted map consumers every five seconds, pauses for hidden documents, and stops when its last consumer leaves. Citizen and responder route calculations always fetch the same active backend feed.
- Route screening checks whole road segments near reports, not just sampled vertices. It refuses to recommend a route when the hazard feed or road-routing service fails. Removed the responder's unscreened straight-line recommendation fallback. Corrected the existing latitude/longitude conversion at responder map boundaries.
- Citizen cached guidance is invalidated when shared reports change; the existing responder monitoring hook consumes backend changes. Full automatic route/ETA/notification coordination remains Stage 5.
- No new enhancer was added. Existing design/CSS is retained, with small additions inside the current report picker and hazard popups.

## Bring the update onto the local Mac

Do not reset or overwrite unrelated local work. From the repository root, while on `feature/login-page-ui`:

```sh
git pull --ff-only origin feature/login-page-ui
```

Stop only the running backend with Ctrl+C in its terminal, then from this repository's `backend` folder (not the older separate backend checkout):

```sh
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload --port 8000
```

In a separate frontend terminal:

```sh
npm install
npm run dev
```

Keep both servers running. Sign in again if the existing 15-minute token has expired. Do not share `.env` screenshots; rotate previously exposed secrets before deployment.

## Automated verification

Verified on an isolated copy of branch commit `0cc2dfa8d6ceb8e2735987f9fdcc946b090361a9`, with no access to or changes to the user's local database:

- 20 backend tests: cross-role reads, resolve/reopen, actual app startup and two-process SQLite restart, authentication and expiry, input validation, sanitized/private photos, idempotency, report throttling, oversized requests.
- 9 frontend tests: shared authenticated reads, polling cleanup, equal-count changes, write/read race, failed save, both roles' segment-interior hazard screening, all-blocked and resolved cases, provider outage, logout, actual picker DOM double-submit/retry/optional-photo behavior.
- Explicit TypeScript check passed with module detection and DOM iterable libraries. Vite production bundling passed. Tested with Python 3.12, TypeScript 5.9.3 and Vite 6.4.3 in an isolated toolchain; this is not a claim about every unpinned dependency version or the user's Mac environment.

To repeat:

```sh
# backend/
python -m pip install -r requirements-dev.txt
python -m pytest tests/test_hazards.py -q

# frontend/
npm install
npm run test:hazards
npx tsc --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --moduleDetection force --jsx react-jsx --lib ES2022,DOM,DOM.Iterable --allowSyntheticDefaultImports --skipLibCheck --types vite/client src/main.tsx
npx vite build
```

The branch has no checked-in TypeScript project configuration; its pre-existing `npm run build` runs `tsc -b`. The explicit check above avoids claiming that missing project setup was repaired in Stage 4.

## One local smoke check (no SOS replay)

In citizen NavCat, use the existing paperclip, select a test road photo, choose the hazard type, optionally check **Also upload this photo**, and submit. Expect **saved to the backend**. Open the citizen Live Map and confirm a shared hazard marker survives a reload/relogin. In the responder view, re-screen an existing route: it should include the shared-report count and reject a candidate passing near that marker. Reports are unverified; an unrelated distant report need not change the route.

Legacy localStorage reports are left untouched and are NOT silently uploaded; submit them again if needed. Existing modeled Houston polygons remain separately labeled prototype data. GPS comes from the device at submission time, not inferred from the image. No external API availability, real-world road safety, production PostgreSQL migration, or full browser visual regression is certified here.

Prototype operational limits: at most 2500 records per feed response (larger feeds fail explicitly rather than silently truncate), ten new reports per reporter/minute, database-stored sanitized photos. Production multi-worker rate limiting, retention policy, moderation, full existing-endpoint security review, and object-storage scaling remain later work.
