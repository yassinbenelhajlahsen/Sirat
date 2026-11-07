# Sirat Backend

Express + TypeScript API used by Sirat for proxy integrations, sync, feedback and the Islamic Q&A chat.

## What It Does

- Proxies prayer timings plus monthly/yearly calendars from Aladhan with validation, retry, and in-memory cache
- Aggregates yearly holiday data from Aladhan behind a single backend endpoint
- Proxies nearby mosque lookup through Google Places
- Answers Islamic questions through OpenAI with Quran and hadith search, behind a switch and a monthly quota

## API Endpoints

### `GET /`

Basic service health metadata and endpoint list.

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

### `GET /api/chat/status`

Auth optional. Returns 503 unless `CHAT_ENABLED=1`. Otherwise `{ enabled, allowance, remaining, resetsAt }`; `allowance` and `remaining` are null when signed out, and 15 when the user hasn't asked anything this month.

### `POST /api/chat`

Auth required. Body: `{ message, history, summary, deviceToken }`.

- `message`: 1 to 1,000 characters after trimming
- `history`: up to 20 `{ role: "user" | "assistant", text }` items (user text up to 1,000 characters, assistant up to 4,000)
- `summary`: null or up to 1,500 characters, the `summary` returned by the previous reply
- `deviceToken`: null or an Apple DeviceCheck token

Replies with `kind: "answer"` (answer, citations rendered from stored Quran and hadith text, scholar link for rulings, new summary), `"crisis"`, `"blocked"` or `"limit"`, each with `allowance`, `remaining` and `resetsAt`. Errors: 400 invalid request, 401, 409 `busy` (a reply is already in progress), 429, 502 (failed; the message is refunded), 503 (switched off). Limits: 15 messages per calendar month (UTC), or 5 for a second account on the same device that month or without a device token; 10 per minute per user; 100 per 15 minutes per IP.

Progress stream: send `Accept: application/x-ndjson` to get every 200 as newline-delimited JSON instead. While the answer is prepared it sends `{"type":"stage","stage":"writing"}` at the start of each model round and `{"type":"stage","stage":"searching","source":"quran"|"hadith"|"dua"}` for each search, then exactly one `{"type":"reply", ...}` (the same body as above, `limit` included) or `{"type":"error","status":502,"code":"failed"}`, and ends. The answer text only ever arrives in the reply. Errors before the message is counted (400, 401, 409, 426, 429, 503, and a 502 before the claim) stay plain JSON with the usual status.

### `POST /api/reports`

Auth optional. Body: `{ kind: "dua", input, output: { duaId } }` or `{ kind: "chat", input: question, output: { answer, citationIds } }`. Saved only, never emailed, deleted with the account.

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
npm run import:quran -- ../frontend/assets/data/quran   # chat Quran source
npm run import:hadith                                    # chat hadith source (HadeethEnc); re-run monthly
npm run import:duas                                      # chat dua source (../frontend/assets/data/duas.json); re-run when that file changes
npm run chat:eval -- <questions.md> <out.md>             # pre-launch chat question run
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
OPENAI_MODEL=gpt-6-luna
OPENAI_SERVICE_TIER=fast
CHAT_ENABLED=0
CHAT_DEV_BYPASS=0
CHAT_IDENTITY_SECRET=long_random_string
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Notes:

- Chat is off unless `CHAT_ENABLED=1`. It needs `OPENAI_API_KEY`, `CHAT_IDENTITY_SECRET` and the `DEVICECHECK_*` key (see `.env.example`); `DEVICECHECK_REQUIRED=0` skips DeviceCheck for local development.
- `OPENAI_SERVICE_TIER` picks OpenAI's speed tier for chat answers. `fast` (the default) costs twice as much per token and roughly halves reply time; set `default` to use the standard tier without a code change.
- `GOOGLE_MAPS_API_KEY` is required for `/api/mosque/nearby`.
- `TRUST_PROXY` is optional; if omitted, proxy trust is inferred (`1` in production, `false` otherwise).
- `LOG_LEVEL` currently defaults to `info`.
- CORS allows `FRONTEND_URL` plus local Expo dev origins.

## Source Map

- `src/index.ts` - app setup, CORS, routing, health/404/error middleware
- `src/routes/mosque.ts` - mosque routes
- `src/routes/prayerTimes.ts` - prayer-times routes
- `src/routes/holiday.ts` - holiday routes
- `src/controllers/mosqueController.ts` - mosque request validation + flow control
- `src/controllers/prayerTimesController.ts` - prayer-times parameter validation + flow control
- `src/controllers/holidayController.ts` - holiday year validation + flow control
- `src/services/aladhanService.ts` - Aladhan proxy, retry, validation, caching
- `src/services/googleMapsService.ts` - Google Places proxy calls
- `src/routes/chat.ts`, `src/controllers/chatController.ts` - chat routes, validation and quota flow
- `src/services/chat/` - quota, identity hash, DeviceCheck, OpenAI client, source search (Quran, hadith, duas), answer guards
- `src/config/env.ts` - env parsing/defaults
