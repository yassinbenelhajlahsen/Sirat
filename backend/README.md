# Sirat Backend

Express + TypeScript API used by Sirat for dua selection.

## What It Does

- Loads dua data from `backend/public/duas.json`
- Accepts natural-language user requests
- Uses OpenAI to select the best matching dua ID (metadata-only context)
- Falls back to a random dua if AI is unavailable/fails

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
- `radius` (optional, default `3000`, min `1`, max `50000`)

Returns nearby mosques from Google Places through backend proxying.

### `GET /api/mosque/health`

Returns mosque service status and timestamp.

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
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

Notes:

- `OPENAI_API_KEY` is optional for runtime continuity; without it, the API uses fallback matching.
- `GOOGLE_MAPS_API_KEY` is required for `/api/mosque/nearby`.
- CORS allows `FRONTEND_URL` plus local Expo dev origins.

## Source Map

- `src/index.ts` - app setup, CORS, routing, health/404/error middleware
- `src/routes/dua.ts` - dua routes
- `src/controllers/duaController.ts` - request validation + flow control
- `src/services/openaiService.ts` - OpenAI chat completion call
- `src/utils/duaDatabase.ts` - load/cache/query dua dataset
- `src/config/env.ts` - env parsing/defaults
