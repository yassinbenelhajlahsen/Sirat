# 🔐 Google Maps API Migration Plan

## Secure Backend Migration for Google Maps API Key

**Status:** Planning  
**Priority:** High (Security Enhancement)  
**Estimated Time:** 3-4 hours  
**Branch:** `feat/dua` → `feat/secure-maps-api`

---

## 📋 Overview

### Security Benefits

- ✅ API key no longer exposed in client-side code
- ✅ API key not bundled in app binary (prevents extraction via reverse engineering)
- ✅ Centralized rate limiting and request validation
- ✅ Ability to add authentication/authorization checks
- ✅ Better monitoring and logging of API usage
- ✅ Single point of control for API quota management

### Current State

- Google Maps API key stored in `frontend/app.config.js`
- Key exposed via `Constants.expoConfig.extra` in React Native
- Direct API calls from mobile app to Google Maps API
- No rate limiting or request validation

### Target State

- API key stored securely in backend `.env`
- Frontend proxies requests through backend `/api/mosque/nearby` endpoint
- Backend validates requests and implements rate limiting
- Centralized error handling and logging

---

## 🏗️ Phase 1: Backend Setup

### 1.1 Add Google Maps API Key to Backend Environment

**File:** `backend/.env`

```env
# Existing variables...
OPENAI_API_KEY=your_openai_key
PORT=3001

# Add this:
GOOGLE_MAPS_API_KEY=your_actual_google_maps_api_key
```

**⚠️ Important:** Never commit `.env` file to git!

---

### 1.2 Update Backend ENV Configuration

**File:** `backend/src/config/env.ts`

```typescript
export const ENV = {
  PORT: process.env.PORT || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",
  OPENAI_MODEL: process.env.OPENAI_MODEL || "gpt-4-turbo",
  GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY || "", // ADD THIS
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:8081",
  LOG_LEVEL: process.env.LOG_LEVEL || "info",
} as const;

// Add validation warning
if (!ENV.GOOGLE_MAPS_API_KEY) {
  console.warn("⚠️  GOOGLE_MAPS_API_KEY is not set. Mosque search will fail.");
}

if (!ENV.OPENAI_API_KEY) {
  console.warn(
    "⚠️  OPENAI_API_KEY is not set. Dua selection will use random fallback.",
  );
}
```

---

### 1.3 Create Google Maps Service (Backend)

**File:** `backend/src/services/googleMapsService.ts` _(new file)_

```typescript
import { ENV } from "../config/env.js";

export interface Mosque {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

export interface NearbyMosquesParams {
  latitude: number;
  longitude: number;
  radius?: number;
}

/**
 * Fetch nearby mosques from Google Maps Places API
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param radius - Search radius in meters (default: 3000, max: 50000)
 * @returns Array of nearby mosques
 * @throws Error if API request fails
 */
export async function getNearbyMosques({
  latitude,
  longitude,
  radius = 3000,
}: NearbyMosquesParams): Promise<Mosque[]> {
  if (!ENV.GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Maps API key is not configured");
  }

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&type=mosque&key=${ENV.GOOGLE_MAPS_API_KEY}`;

  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Google Maps API error: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();

  // Handle Google Maps API error responses
  if (json.status !== "OK" && json.status !== "ZERO_RESULTS") {
    console.error("Google Maps API error:", json.status, json.error_message);
    throw new Error(
      `Google Maps API error: ${json.status} - ${json.error_message || "Unknown error"}`,
    );
  }

  if (!json.results || json.results.length === 0) {
    return [];
  }

  return json.results.map((r: any) => ({
    id: r.place_id,
    name: r.name,
    address: r.vicinity || r.formatted_address || "No address available",
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}
```

---

### 1.4 Create Mosque Controller

**File:** `backend/src/controllers/mosqueController.ts` _(new file)_

```typescript
import { Request, Response } from "express";
import { getNearbyMosques } from "../services/googleMapsService.js";

/**
 * Handler for GET /api/mosque/nearby
 * Query params:
 *  - latitude: number (required, -90 to 90)
 *  - longitude: number (required, -180 to 180)
 *  - radius: number (optional, 1 to 50000 meters, default: 3000)
 */
export async function getNearbyMosquesHandler(req: Request, res: Response) {
  try {
    const { latitude, longitude, radius } = req.query;

    // Validation
    if (!latitude || !longitude) {
      return res.status(400).json({
        error: "Missing required parameters: latitude and longitude",
      });
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    const rad = radius ? parseInt(radius as string, 10) : 3000;

    // Validate coordinate ranges
    if (
      isNaN(lat) ||
      isNaN(lng) ||
      lat < -90 ||
      lat > 90 ||
      lng < -180 ||
      lng > 180
    ) {
      return res.status(400).json({
        error:
          "Invalid latitude or longitude values. Latitude must be between -90 and 90, longitude between -180 and 180.",
      });
    }

    // Validate radius
    if (isNaN(rad) || rad < 1 || rad > 50000) {
      return res.status(400).json({
        error: "Invalid radius (must be between 1 and 50000 meters)",
      });
    }

    const mosques = await getNearbyMosques({
      latitude: lat,
      longitude: lng,
      radius: rad,
    });

    return res.json({
      success: true,
      count: mosques.length,
      data: mosques,
    });
  } catch (error) {
    console.error("Error fetching nearby mosques:", error);
    return res.status(500).json({
      error: "Failed to fetch nearby mosques",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
```

---

### 1.5 Create Mosque Routes

**File:** `backend/src/routes/mosque.ts` _(new file)_

```typescript
import express from "express";
import { getNearbyMosquesHandler } from "../controllers/mosqueController.js";

const router = express.Router();

/**
 * GET /api/mosque/nearby
 * Fetch nearby mosques by latitude and longitude
 */
router.get("/nearby", getNearbyMosquesHandler);

/**
 * GET /api/mosque/health
 * Health check for mosque service
 */
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "mosque",
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

---

### 1.6 Register Routes in Express App

**File:** `backend/src/index.ts`

**Add import at top:**

```typescript
import mosqueRoutes from "./routes/mosque.js";
```

**Register route (after dua routes):**

```typescript
// Routes
app.use("/api/dua", duaRoutes);
app.use("/api/mosque", mosqueRoutes); // ADD THIS
```

**Update root endpoint documentation:**

```typescript
app.get("/", (req, res) => {
  res.json({
    name: "🕌 Sirat Backend",
    version: "1.0.0",
    status: "running",
    endpoints: {
      "POST /api/dua/match": "Match user request to a dua",
      "GET /api/dua/health": "Health check",
      "GET /api/mosque/nearby": "Get nearby mosques by lat/lng", // ADD THIS
      "GET /api/mosque/health": "Mosque service health check", // ADD THIS
    },
  });
});
```

---

## 🎨 Phase 2: Frontend Migration

### 2.1 Update Frontend Service

**File:** `frontend/services/getNearbyMosques.ts`

**Replace entire file content:**

```typescript
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const BACKEND_URL =
  Constants.expoConfig?.extra?.BACKEND_URL || "http://localhost:3001";

export interface Mosque {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

/**
 * Fetch nearby mosques via backend API
 * - Requests location permission if not granted
 * - Uses provided coordinates or fetches current location
 * - Calls backend /api/mosque/nearby endpoint
 * @param lat - Optional latitude
 * @param lng - Optional longitude
 * @returns Array of nearby mosques
 * @throws Error if permission denied or API call fails
 */
export async function getNearbyMosques(
  lat?: number,
  lng?: number,
): Promise<Mosque[]> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== "granted") throw new Error("Permission denied");

  let latitude = lat;
  let longitude = lng;

  if (!latitude || !longitude) {
    const loc = await Location.getCurrentPositionAsync({});
    latitude = loc.coords.latitude;
    longitude = loc.coords.longitude;
  }

  // Call backend API instead of Google Maps directly
  const url = `${BACKEND_URL}/api/mosque/nearby?latitude=${latitude}&longitude=${longitude}&radius=3000`;
  const res = await fetch(url);

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Backend API error:", res.status, errorText);
    throw new Error(`Backend API error: ${res.status}`);
  }

  const json = await res.json();

  if (!json.success || !json.data) {
    throw new Error("Invalid response from backend");
  }

  return json.data;
}

/**
 * Cached wrapper for getNearbyMosques()
 * - Stores results in AsyncStorage
 * - Returns cached data instantly if still valid
 * - Falls back to live fetch if expired or not found
 * @param lat - Optional latitude
 * @param lng - Optional longitude
 * @param cacheDurationMs - Cache validity duration (default: 24 hours)
 * @returns Array of nearby mosques
 */
export async function getCachedMosques(
  lat?: number,
  lng?: number,
  cacheDurationMs = 86400000,
): Promise<Mosque[]> {
  try {
    let latitude = lat;
    let longitude = lng;

    if (!latitude || !longitude) {
      const loc = await Location.getCurrentPositionAsync({});
      latitude = loc.coords.latitude;
      longitude = loc.coords.longitude;
    }

    const cacheKey = `mosques_${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
    const cached = await AsyncStorage.getItem(cacheKey);

    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < cacheDurationMs) {
        return data;
      }
    }
    const freshData = await getNearbyMosques(latitude, longitude);
    await AsyncStorage.setItem(
      cacheKey,
      JSON.stringify({ data: freshData, timestamp: Date.now() }),
    );
    return freshData;
  } catch (error) {
    console.error("Error fetching cached mosques:", error);
    return [];
  }
}
```

---

### 2.2 Add Backend URL to App Config

**File:** `frontend/app.config.js`

**Update the `extra` section:**

```javascript
extra: {
  fullName: "Sirat - The Path to Your Deen",
  BACKEND_URL: process.env.BACKEND_URL || "http://localhost:3001", // ADD THIS
  // REMOVE THIS LINE:
  // GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY,
  router: {},
  eas: {
    projectId: "cf8d4247-0a70-4fe4-bd59-43ea9efac019",
  },
},
```

---

### 2.3 Update Frontend Environment

**File:** `frontend/.env`

**Remove:**

```env
# GOOGLE_MAPS_API_KEY=your_key_here  # REMOVE THIS
```

**Add:**

```env
# Backend API URL
BACKEND_URL=http://localhost:3001
```

**For production builds, set in EAS:**

```bash
eas secret:create --name BACKEND_URL --value https://your-production-backend.com
```

---

## 🧪 Phase 3: Testing

### 3.1 Create Backend Tests

**File:** `backend/__tests__/mosqueController.test.ts` _(new file)_

```typescript
import request from "supertest";
import express from "express";
import mosqueRoutes from "../src/routes/mosque";

const app = express();
app.use(express.json());
app.use("/api/mosque", mosqueRoutes);

describe("Mosque Controller", () => {
  describe("GET /api/mosque/nearby", () => {
    it("should return 400 if latitude is missing", async () => {
      const res = await request(app)
        .get("/api/mosque/nearby")
        .query({ longitude: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("latitude");
    });

    it("should return 400 if longitude is missing", async () => {
      const res = await request(app)
        .get("/api/mosque/nearby")
        .query({ latitude: 40 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("longitude");
    });

    it("should return 400 for invalid latitude", async () => {
      const res = await request(app)
        .get("/api/mosque/nearby")
        .query({ latitude: 999, longitude: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid");
    });

    it("should return 400 for invalid longitude", async () => {
      const res = await request(app)
        .get("/api/mosque/nearby")
        .query({ latitude: 40, longitude: 999 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid");
    });

    it("should return 400 for invalid radius", async () => {
      const res = await request(app)
        .get("/api/mosque/nearby")
        .query({ latitude: 40, longitude: 10, radius: 100000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("radius");
    });

    it("should return 200 with valid coordinates", async () => {
      const res = await request(app)
        .get("/api/mosque/nearby")
        .query({ latitude: 40.7128, longitude: -74.006 });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success");
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("GET /api/mosque/health", () => {
    it("should return health status", async () => {
      const res = await request(app).get("/api/mosque/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.service).toBe("mosque");
    });
  });
});
```

**File:** `backend/__tests__/googleMapsService.test.ts` _(new file)_

```typescript
import { getNearbyMosques } from "../src/services/googleMapsService";

describe("Google Maps Service", () => {
  it("should throw error if API key is not set", async () => {
    // Temporarily clear API key
    const originalKey = process.env.GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;

    await expect(
      getNearbyMosques({ latitude: 40, longitude: 10 }),
    ).rejects.toThrow("Google Maps API key is not configured");

    // Restore
    process.env.GOOGLE_MAPS_API_KEY = originalKey;
  });

  it("should return empty array for ZERO_RESULTS", async () => {
    // Test with coordinates in middle of ocean (no mosques)
    const result = await getNearbyMosques({
      latitude: 0,
      longitude: 0,
      radius: 1000,
    });

    expect(Array.isArray(result)).toBe(true);
  });
});
```

---

### 3.2 Manual Testing Checklist

#### Backend Testing

```bash
# Start backend server
cd backend
npm run dev
```

**Test endpoint manually:**

```bash
# Test valid request (New York)
curl "http://localhost:3001/api/mosque/nearby?latitude=40.7128&longitude=-74.0060"

# Test missing latitude
curl "http://localhost:3001/api/mosque/nearby?longitude=-74.0060"

# Test invalid coordinates
curl "http://localhost:3001/api/mosque/nearby?latitude=999&longitude=999"

# Test health check
curl "http://localhost:3001/api/mosque/health"

# Test root endpoint (check documentation)
curl "http://localhost:3001/"
```

**Expected responses:**

- ✅ Valid request: 200 with mosque data
- ✅ Missing param: 400 with error message
- ✅ Invalid coords: 400 with error message
- ✅ Health: 200 with status ok

#### Frontend Testing

```bash
# Start frontend
cd frontend
npm start
```

**Test in app:**

- [ ] Open Mosques tab
- [ ] Grant location permission when prompted
- [ ] Verify nearby mosques load
- [ ] Tap a mosque card to view map
- [ ] Verify map markers appear
- [ ] Tap "Get Directions" button
- [ ] Move map and tap "Search this area"
- [ ] Verify new mosques load for new location
- [ ] Test with airplane mode (should show cached results)
- [ ] Force quit app and reopen (cache should persist)

#### Edge Cases

- [ ] Test with location services disabled
- [ ] Test with no network connection
- [ ] Test in area with no nearby mosques
- [ ] Test rapid location changes
- [ ] Test with invalid backend URL

---

## 🧹 Phase 4: Cleanup & Security

### 4.1 Remove API Key from Frontend

**Files to update:**

1. ✅ `frontend/app.config.js` - Remove `GOOGLE_MAPS_API_KEY`
2. ✅ `frontend/.env` - Remove API key
3. ✅ `frontend/.env.example` - Update documentation
4. ✅ `frontend/README.md` - Update setup instructions

**File:** `frontend/.env.example`

```env
# Backend API URL
BACKEND_URL=http://localhost:3001

# NOTE: Google Maps API key is now handled by the backend
# You do NOT need to add it here anymore
```

---

### 4.2 Update Documentation

**File:** `README.md`

**Environment Variables section:**

````markdown
### Backend Environment Variables

Create `backend/.env`:

```env
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
PORT=3001
NODE_ENV=development
```
````

- `OPENAI_API_KEY` - OpenAI API key for AI-powered dua search
- `GOOGLE_MAPS_API_KEY` - Google Maps API key for mosque location services
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

### Frontend Environment Variables

Create `frontend/.env`:

```env
BACKEND_URL=http://localhost:3001
```

- `BACKEND_URL` - Backend API URL (default: http://localhost:3001)

**Note:** The Google Maps API key is now securely stored on the backend only.

````

**File:** `frontend/README.md`

Update the setup section to remove Google Maps API key requirements:

```markdown
## Setup

1. Install dependencies:
   ```bash
   npm install
````

2. Create `.env` file:

   ```bash
   cp .env.example .env
   ```

3. Update `.env` with your backend URL:

   ```
   BACKEND_URL=http://localhost:3001
   ```

4. Ensure backend is running (see backend README)

5. Start development server:
   ```bash
   npm start
   ```

**Note:** Google Maps API integration is now handled by the backend. You no longer need to add a Google Maps API key in the frontend configuration.

````

---

### 4.3 Add Rate Limiting (Recommended)

**Install dependencies:**

```bash
cd backend
npm install express-rate-limit
npm install --save-dev @types/express-rate-limit
````

**File:** `backend/src/routes/mosque.ts`

```typescript
import express from "express";
import rateLimit from "express-rate-limit";
import { getNearbyMosquesHandler } from "../controllers/mosqueController.js";

const router = express.Router();

// Rate limiter: 100 requests per 15 minutes per IP
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

/**
 * GET /api/mosque/nearby
 * Fetch nearby mosques by latitude and longitude
 * Rate limited: 100 requests per 15 minutes
 */
router.get("/nearby", limiter, getNearbyMosquesHandler);

/**
 * GET /api/mosque/health
 * Health check for mosque service
 */
router.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "mosque",
    timestamp: new Date().toISOString(),
  });
});

export default router;
```

---

### 4.4 Add Request Logging (Optional)

**File:** `backend/src/controllers/mosqueController.ts`

Add logging to track usage:

```typescript
export async function getNearbyMosquesHandler(req: Request, res: Response) {
  const startTime = Date.now();

  try {
    const { latitude, longitude, radius } = req.query;

    // Log request
    console.log(
      `[Mosque API] Request from ${req.ip}: lat=${latitude}, lng=${longitude}, radius=${radius || 3000}`,
    );

    // ... existing validation and logic ...

    const mosques = await getNearbyMosques({
      latitude: lat,
      longitude: lng,
      radius: rad,
    });

    const duration = Date.now() - startTime;
    console.log(
      `[Mosque API] Success: ${mosques.length} mosques found in ${duration}ms`,
    );

    return res.json({
      success: true,
      count: mosques.length,
      data: mosques,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Mosque API] Error after ${duration}ms:`, error);

    return res.status(500).json({
      error: "Failed to fetch nearby mosques",
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
```

---

## 🚀 Phase 5: Deployment

### 5.1 Backend Deployment

#### For Railway/Render/Heroku:

1. Add environment variable in hosting dashboard:

   ```
   GOOGLE_MAPS_API_KEY=your_actual_key_here
   ```

2. Deploy backend:

   ```bash
   git push origin feat/dua
   ```

3. Verify deployment:
   ```bash
   curl https://your-backend.com/api/mosque/health
   ```

#### For Docker:

**File:** `backend/.dockerignore` (if not exists)

```
node_modules
.env
.env.local
npm-debug.log
.git
```

**File:** `backend/Dockerfile` (if not exists)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["node", "dist/index.js"]
```

**Build and run:**

```bash
docker build -t sirat-backend .
docker run -p 3001:3001 \
  -e GOOGLE_MAPS_API_KEY=your_key \
  -e OPENAI_API_KEY=your_key \
  sirat-backend
```

---

### 5.2 Frontend Deployment

#### Update EAS secrets:

```bash
cd frontend

# Set backend URL for production
eas secret:create --name BACKEND_URL --value https://your-production-backend.com --scope project

# Remove old Google Maps key (if it exists)
eas secret:delete --name GOOGLE_MAPS_API_KEY
```

#### Build and submit:

```bash
# Build for iOS and Android
eas build --platform all

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

#### For OTA updates:

```bash
# Update production branch
eas update --branch production --message "Migrate Google Maps API to backend for security"

# Update preview branch
eas update --branch preview --message "Migrate Google Maps API to backend"
```

---

### 5.3 Verify Production

**Test production backend:**

```bash
curl "https://your-backend.com/api/mosque/nearby?latitude=40.7128&longitude=-74.0060"
```

**Test production app:**

1. Install app from TestFlight/Play Store internal testing
2. Open Mosques tab
3. Verify mosques load correctly
4. Check network requests in proxy tool (Charles/Proxyman)
5. Confirm requests go to your backend, not directly to Google Maps

---

## ✅ Final Migration Checklist

### Backend Tasks

- [ ] Add `GOOGLE_MAPS_API_KEY` to `backend/.env`
- [ ] Update `backend/src/config/env.ts` with Google Maps key
- [ ] Create `backend/src/services/googleMapsService.ts`
- [ ] Create `backend/src/controllers/mosqueController.ts`
- [ ] Create `backend/src/routes/mosque.ts`
- [ ] Register routes in `backend/src/index.ts`
- [ ] Add rate limiting to mosque routes
- [ ] Create tests: `backend/__tests__/mosqueController.test.ts`
- [ ] Create tests: `backend/__tests__/googleMapsService.test.ts`
- [ ] Run tests: `npm run test`
- [ ] Test backend endpoint manually with curl
- [ ] Deploy backend to production
- [ ] Add `GOOGLE_MAPS_API_KEY` to production environment

### Frontend Tasks

- [ ] Add `BACKEND_URL` to `frontend/.env`
- [ ] Update `frontend/app.config.js` (add BACKEND_URL)
- [ ] Remove `GOOGLE_MAPS_API_KEY` from `frontend/app.config.js`
- [ ] Update `frontend/services/getNearbyMosques.ts` to use backend API
- [ ] Test Mosques screen with location enabled
- [ ] Test Mosques screen with location denied
- [ ] Test map view (`frontend/app/components/map.tsx`)
- [ ] Test "Search this area" functionality
- [ ] Test offline caching
- [ ] Update EAS secret: `eas secret:create --name BACKEND_URL`
- [ ] Remove old secret: `eas secret:delete --name GOOGLE_MAPS_API_KEY`
- [ ] Build new version: `eas build --platform all`
- [ ] Submit to app stores

### Documentation Tasks

- [ ] Update `README.md` environment variables section
- [ ] Update `frontend/README.md` setup instructions
- [ ] Update `frontend/.env.example`
- [ ] Remove Google Maps API key references from docs
- [ ] Document new backend endpoint in API docs

### Cleanup Tasks

- [ ] Remove `GOOGLE_MAPS_API_KEY` from all frontend files
- [ ] Remove from `frontend/.env`
- [ ] Remove from `frontend/.env.example`
- [ ] Remove from `frontend/app.config.js`
- [ ] Verify no hardcoded API keys in codebase:
  ```bash
  grep -r "AIza" frontend/  # Google Maps keys start with AIza
  ```

### Testing Tasks

- [ ] Backend unit tests pass
- [ ] Backend integration tests pass
- [ ] Manual API testing with curl/Postman
- [ ] Frontend Mosques tab loads correctly
- [ ] Map view loads correctly
- [ ] Location permission flow works
- [ ] Caching works as expected
- [ ] Error handling works (no network, invalid coords, etc.)
- [ ] Rate limiting works (test with many requests)
- [ ] Production deployment verified

---

## 📊 Metrics to Monitor

After deployment, monitor:

1. **API Usage:**
   - Number of mosque search requests per day
   - Average response time
   - Error rate (4xx, 5xx)

2. **Google Maps Quota:**
   - Places API Nearby Search requests
   - Ensure staying within free tier or budget

3. **Backend Performance:**
   - Response times for `/api/mosque/nearby`
   - Memory usage
   - CPU usage

4. **Frontend Experience:**
   - Time to first mosque load
   - Cache hit rate
   - User-reported issues

---

## 🔄 Rollback Plan

If issues occur:

### Quick Rollback (Frontend Only)

1. Revert frontend changes:

   ```bash
   git revert <commit-hash>
   eas update --branch production --message "Rollback maps migration"
   ```

2. Re-add `GOOGLE_MAPS_API_KEY` to EAS:
   ```bash
   eas secret:create --name GOOGLE_MAPS_API_KEY --value your_key
   ```

### Full Rollback (Backend + Frontend)

1. Revert backend changes
2. Redeploy previous backend version
3. Revert frontend changes
4. Push OTA update or release new build

---

## 📝 Notes

- **Estimated total time:** 3-4 hours
- **Breaking change:** Yes (requires backend deployment first)
- **Backwards compatible:** No (old app versions will break after backend deployment)
- **Migration strategy:** Deploy backend first, then update frontend
- **Testing priority:** High (affects core mosque discovery feature)

---

## 🎯 Success Criteria

Migration is successful when:

1. ✅ Google Maps API key is not exposed in frontend code
2. ✅ Backend successfully proxies mosque search requests
3. ✅ Frontend Mosques tab works identically to before
4. ✅ Map view works identically to before
5. ✅ Caching continues to work
6. ✅ Rate limiting prevents abuse
7. ✅ All tests pass
8. ✅ Production app works without issues
9. ✅ No increase in API quota usage
10. ✅ No degradation in user experience

---

## 📞 Troubleshooting

### Backend Issues

**Issue:** `GOOGLE_MAPS_API_KEY is not set`

- **Solution:** Add key to `.env` and restart server

**Issue:** `Google Maps API error: REQUEST_DENIED`

- **Solution:** Check API key is valid and has Places API enabled

**Issue:** Rate limit exceeded

- **Solution:** Adjust rate limiter settings or upgrade Google Maps quota

### Frontend Issues

**Issue:** `Failed to fetch nearby mosques`

- **Solution:** Check `BACKEND_URL` is correct and backend is running

**Issue:** Mosques don't load

- **Solution:** Check network tab for failed requests, verify backend URL

**Issue:** Old cached data showing

- **Solution:** Clear AsyncStorage or wait for cache expiration (24h)

---

**Last Updated:** January 19, 2026  
**Author:** Sirat Development Team  
**Status:** Ready for Implementation
