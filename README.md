# Sirat Monorepo

Sirat is a mobile-first Islamic companion app with an Expo frontend and a Node/Express backend.

## Repository Structure

```text
/
├── frontend/   # Expo + React Native mobile app
├── backend/    # Express API for dua matching + service proxy routes
├── docs/       # Public website + privacy policy
├── plans/      # Implementation/migration planning docs
└── README.md
```

## Current Feature Set

- Prayer times via backend-proxied Aladhan data with auto-location or manual city fallback
- Qibla direction screen using device sensors + location permissions
- Quran reader with local text data, audio streaming, search, bookmarks, and resume progress
- Nearby mosque map/list using backend-proxied Google Places Nearby Search
- Prayer notifications with per-prayer toggles and optional Adhan sound
- Islamic calendar with backend holiday proxying and Ramadan missed-fast tracking
- Dua matching with local regex-first logic and backend AI fallback

## Quick Start

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Server default: `http://localhost:3001`

### 2. Frontend

```bash
cd frontend
npm install
npm start
```

## Environment Variables

### Frontend (`frontend/.env`)

```env
EXPO_PUBLIC_API_URL=http://localhost:3001
```

- `EXPO_PUBLIC_API_URL` is used for backend APIs; if omitted, frontend defaults to `http://localhost:3001`.

### Backend (`backend/.env`)

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:8081
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4-turbo
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

- If `OPENAI_API_KEY` is missing, backend still works and falls back to random dua selection.
- `GOOGLE_MAPS_API_KEY` is required for mosque lookup.

## Docs

- Backend details: `backend/README.md`
- Frontend details: `frontend/README.md`
- Agent/onboarding guidance: `.github/copilot-instructions.md`
- Site + privacy pages: `docs/`
