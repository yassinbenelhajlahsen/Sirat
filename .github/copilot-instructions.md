# Copilot Instructions for Sirat

## Project Overview

**Sirat** is a mono-repo containing:

- **Frontend:** React Native + Expo mobile app (`frontend/`)
- **Backend:** Node.js + Express API server (`backend/`)

The mobile app provides Islamic utilities: prayer times, Qibla direction, Quran reading with audio, mosque discovery, and prayer notifications. The backend provides AI-powered dua search via OpenAI.

The frontend architecture emphasizes modular services, context-based state management, and Expo's ecosystem integration.

## Mono-Repo Structure

All frontend code is located in `frontend/`:

- `frontend/app/` - Expo Router screens and components
- `frontend/services/` - Business logic and API integrations
- `frontend/hooks/` - Custom React hooks
- `frontend/context/` - React context providers
- `frontend/constants/` - Theme and design tokens
- `frontend/assets/` - Images, fonts, sounds, data files
- `frontend/util/` - Helper functions

All backend code is located in `backend/`:

- `backend/src/` - Express server, routes, controllers
- `backend/public/` - Static assets (dua database)

## Key Architecture Patterns

### Service Layer

- **Location-independent services** in `frontend/services/`: `prayerTimes.ts`, `notificationService.ts`, `quranData.ts`, `quranAudio.ts`
- Services handle **device permissions, caching, and external API calls** (Aladhan, Google Places)
- Each service manages its own **AsyncStorage keys** for persistence (e.g., `prayerSettings`, `notif_enabled_v1`)
- Use **DeviceEventEmitter** for cross-component events (e.g., `SETTINGS_CHANGED_EVENT`, `NOTIF_PREFS_UPDATED_EVENT`)

### Context Providers

- `QuranAudioProvider` in `frontend/context/`: Manages Quran playback state, surah metadata, and session coordination
- Exposed via custom hooks (e.g., `useQuranAudio`) to avoid prop drilling
- Complex state transitions (loading, playing, paused) are handled here, not in components

### Routing & Navigation

- **Expo Router** (`frontend/app/` directory) with file-based routing
- Tab-based layout in `frontend/app/(tabs)/` with 5 main screens: Home, Mosques, Qibla, Quran, Calendar
- Use relative imports with `@/` alias pointing to `frontend/` root (configured in `frontend/tsconfig.json`)

### Styling & UI

- **NativeWind** (Tailwind CSS for React Native) for consistent design
- **Central theme** in `frontend/constants/theme.ts`: colors, opacity helpers, and design tokens
- Predefined color palette with semantic names (primary, accent, success, danger)
- Use `withOpacity()` helper for dynamic alpha transparency

### Data Handling Patterns

**Prayer Settings & Caching:**

- Settings stored as `PrayerSettings` object: `{useLocation, method, city?}`
- Calendar data cached per year with composite key: `year + settingsKey` (separates manual vs location-based)
- Aladhan API returns ISO times; format to 12-hour via `formatTo12Hour()`

**Quran Data Pipeline:**

- Raw data shipped as JSON assets (`frontend/assets/data/quran/quran.json`, `meta.json`)
- Normalized via `NormalizedAyah` & `NormalizedSurahMeta` types in `frontend/services/quranData.ts`
- Surah audio URLs constructed via `getSurahAudioUrl()` with fallback handling for offline

**Notification Scheduling:**

- Rolling 10-14 day horizon (OS-dependent) with platform-specific limits
- Separate caches for location-based vs manual city notifications
- Tracks "seen" notifications by `"Label_YYYY-MM-DDTHH:MM"` to prevent duplicates

## Development Workflows

### Build & Run

```bash
# Navigate to frontend directory
cd frontend

# Expo development server
npm start

# Platform-specific
npm run ios      # iOS simulator/device
npm run android  # Android emulator/device
npm run web      # Web (limited feature set)

# Lint
npm run lint     # Expo ESLint config
```

### Testing Locations & Notifications

- Manually set city in Settings → override location-based detection
- Use Notification Settings component to toggle per-prayer notifications
- Test offline mode by disabling network; verify cached data loads

### Hot Reloading

- Changes to JS/TSX reload instantly; native plugin changes require full rebuild
- AsyncStorage changes may require app restart to reflect

## Project-Specific Conventions

### Storage Keys

- Use versioned keys to avoid stale data conflicts: `notif_enabled_v1`, `prayerSettings`
- Document storage structure in service files for clarity

### API Error Handling

- Aladhan API: Always provide fallback city or handle network timeout gracefully
- Google Maps/Places: Wrap in try-catch; show cached results if API fails
- Network detection via `expo-network`; display offline indicator via `offlinePillVisible` flag

### Permission Flows

- **Location:** Check foreground → request if undecided → check if services enabled (global toggle)
- **Notifications:** Request at first app launch in `_layout.tsx` via `syncLocationPermissionToSettings()`
- Store OS permission status separately from user preference (dual state model)

### Time & Date Utilities

- All prayer times: ISO format from API → 12-hour string via `formatTo12Hour()`
- Use `dateKey()` helper (`YYYY-MM-DD`) for calendar caching keys
- Hijri date support via `hijri-date` library; used in Calendar screen

### Event Emission Pattern

```typescript
// Emit settings change across screens
DeviceEventEmitter.emit(SETTINGS_CHANGED_EVENT);

// Listen in components
useEffect(() => {
  const sub = DeviceEventEmitter.addListener(SETTINGS_CHANGED_EVENT, () => {
    // refetch or reload
  });
  return () => sub.remove();
}, []);
```

## Critical Integration Points

### Quran Audio Playback

- `useQuranAudio` hook initializes `expo-audio` player and monitors network status
- Surah completion triggers context update to auto-advance to next surah
- Mini player portal (`QuranMiniPlayerPortal`) floats above tab bar; state persists across navigation

### Prayer Notifications

- Scheduled via `expo-notifications` with rolling 10-14 day horizon
- Triggers at exact prayer time; respects user's per-prayer toggle preferences
- Midnight refresh reschedules notifications for next day (handles day boundaries)

### Location Services

- Dual mode: **location-based** (device GPS) or **manual city selection**
- If location permission denied, system prompts fallback to manual selection
- City resolution: autocomplete via city search modal (`CitySearchModal.tsx`)

## Common Patterns to Replicate

**Service initialization with error handling:**

```typescript
// Fetch with fallback and cache
const cached = await AsyncStorage.getItem(key);
try {
  const fresh = await axiosGet(url);
  await AsyncStorage.setItem(key, JSON.stringify(fresh));
  return fresh;
} catch {
  return cached ? JSON.parse(cached) : fallbackData;
}
```

**Component with event subscription:**

```typescript
useEffect(() => {
  const subscription = DeviceEventEmitter.addListener(EVENT_NAME, handler);
  return () => subscription.remove();
}, []);
```

## File Organization Rules

- **Components:** Reusable UI in `frontend/app/components/`; screen-level logic stays in `frontend/app/(tabs)/`
- **Services:** Business logic, API calls, caching → `frontend/services/`
- **Hooks:** Custom React hooks that wrap services → `frontend/hooks/`
- **Utilities:** Pure functions (time formatting, city lookups) → `frontend/util/`
- **Context & Providers:** Global state → `frontend/context/`
- **Types:** Leverage TypeScript; define inline or in service files (avoid separate `types/` unless complex)

## Debugging Tips

- Use `console.log()` during development; outputs appear in terminal running `npm start`
- Inspect AsyncStorage via Expo DevTools (check Settings or notification state)
- Test Android/iOS notification timing with manual clock adjustments in emulator
- Verify Aladhan API responses match expected calculation method via browser

## When Modifying Existing Features

1. **Prayer times:** Check `frontend/services/prayerTimes.ts` for caching strategy; update composite cache key if settings structure changes
2. **Notifications:** Review `frontend/services/notificationService.ts` for scheduling logic and platform-specific limits before adding prayers
3. **Quran:** Ensure audio URLs remain valid and normalization matches asset structure in `frontend/services/quranData.ts`
4. **UI:** Maintain theme color usage; avoid hardcoded hex values; respect safe area in layouts
