# Sirat Backend

Express + TypeScript API used by Sirat for dua selection and proxy integrations.

## What It Does

- Loads dua data from `backend/public/duas.json`
- Accepts natural-language user requests
- Uses OpenAI to select the best matching dua ID (metadata-only context)
- Falls back to a random dua if AI is unavailable/fails
- Proxies prayer timings plus monthly/yearly calendars from Aladhan with validation, retry, and in-memory cache
- Aggregates yearly holiday data from Aladhan behind a single backend endpoint
- Proxies nearby mosque lookup through Google Places

## API Endpoints

### `GET /`

Basic service health metadata and endpoint list.

### `POST /api/dua`

Request body:

```json
{
  "userRequest": "I feel anxious about exams"
}
```

Success response:

```json
{
  "dua": {
    "id": 12,
    "category": "anxiety",
    "tags": ["anxiety", "worry"],
    "arabic": "...",
    "english": "...",
    "transliteration": "...",
    "reference": "...",
    "source": "..."
  },
  "matchSource": "ai"
}
```

Validation notes:

- `userRequest` is required
- must be a string
- minimum 3 characters

### `GET /api/dua/health`

Returns API status, loaded dua count, and timestamp.

### `GET /api/mosque/nearby`

Query parameters:

- `latitude` (required, -90 to 90)
- `longitude` (required, -180 to 180)
- `radius` (optional, default `3000`; accepted as finite number and clamped to `100..5000`)

Returns nearby mosques from Google Places through backend proxying.

### `GET /api/mosque/health`

Returns mosque service status and timestamp.

### `GET /api/prayer-times/timings`

Query parameters:

- `latitude` (required, -90 to 90)
- `longitude` (required, -180 to 180)
- `method` (required; supported Aladhan method id, or `auto` / `-1`)
- `country` (optional; improves backend auto-method resolution)

Returns sanitized current-day prayer timings in a response envelope:
`{ success, stale, cache, resolvedMethod, resolutionSource, data }`.

### `GET /api/prayer-times/calendar`

Query parameters:

- `latitude` (required, -90 to 90)
- `longitude` (required, -180 to 180)
- `method` (required; supported Aladhan method id, or `auto` / `-1`)
- `country` (optional; improves backend auto-method resolution)
- `month` (required, 1 to 12)
- `year` (required, 1900 to 2100)

Returns sanitized monthly prayer calendar data in a response envelope:
`{ success, stale, cache, resolvedMethod, resolutionSource, data }`.

### `GET /api/prayer-times/calendar/year`

Query parameters:

- `latitude` (required, -90 to 90)
- `longitude` (required, -180 to 180)
- `method` (required; supported Aladhan method id, or `auto` / `-1`)
- `country` (optional; improves backend auto-method resolution)
- `year` (required, 1900 to 2100)

Returns sanitized yearly prayer calendar data in a response envelope:
`{ success, stale, cache, resolvedMethod, resolutionSource, partial, data }`.

### `GET /api/prayer-times/health`

Returns prayer-times service status and timestamp.

### `GET /api/holidays/year`

Query parameters:

- `year` (required, 1900 to 2100)

Fetches all 12 months from Aladhan internally, deduplicates holidays by date, and returns a single yearly payload.

### `GET /api/holidays/health`

Returns holiday service status and timestamp.

## Run Locally

```bash
npm install
npm run dev
```

Default port: `3001`

## Scripts

```bash
npm run dev            # tsx watch
npm run build          # tsc
npm start              # run dist/index.js
npm run lint
npm test
npm run test:watch
npm run test:coverage
```

## Environment Variables

Create `backend/.env`:

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8081
TRUST_PROXY=
LOG_LEVEL=info
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Notes:

- `OPENAI_API_KEY` is optional for runtime continuity; without it, the API uses fallback matching.
- `GOOGLE_MAPS_API_KEY` is required for `/api/mosque/nearby`.
- `TRUST_PROXY` is optional; if omitted, proxy trust is inferred (`1` in production, `false` otherwise).
- `LOG_LEVEL` currently defaults to `info`.
- CORS allows `FRONTEND_URL` plus local Expo dev origins.

## Source Map

- `src/index.ts` - app setup, CORS, routing, health/404/error middleware
- `src/routes/dua.ts` - dua routes
- `src/routes/mosque.ts` - mosque routes
- `src/routes/prayerTimes.ts` - prayer-times routes
- `src/routes/holiday.ts` - holiday routes
- `src/controllers/duaController.ts` - request validation + flow control
- `src/controllers/mosqueController.ts` - mosque request validation + flow control
- `src/controllers/prayerTimesController.ts` - prayer-times parameter validation + flow control
- `src/controllers/holidayController.ts` - holiday year validation + flow control
- `src/services/aladhanService.ts` - Aladhan proxy, retry, validation, caching
- `src/services/openaiService.ts` - OpenAI chat completion call
- `src/services/googleMapsService.ts` - Google Places proxy calls
- `src/utils/duaDatabase.ts` - load/cache/query dua dataset
- `src/config/env.ts` - env parsing/defaults
