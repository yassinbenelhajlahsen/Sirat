# Ramadan Fasting Tracker Implementation Plan

## Overview

This plan details the implementation of a **local-only, privacy-first Ramadan fasting tracker** for the Sirat mobile app. The tracker:

- Stores per-Gregorian-date fasting status (`"fasted"` or `"not_fasted"`)
- Uses Ramadan dates from the holiday service as a visibility hint only
- Applies a ±3 day buffer for universal compatibility
- Has no configuration, no backend, no religious enforcement
- Integrates seamlessly with existing Calendar and CalendarDetail components
- Preserves all existing animations, navigation, and UI patterns

---

## Architecture Analysis

### Existing Components

#### 1. **Calendar.tsx** (`frontend/app/(tabs)/Calendar.tsx`)

- **Purpose:** Monthly calendar grid view with Islamic holidays
- **Key Features:**
  - Month matrix generation via `getMonthMatrix(year, month)`
  - Swipe animations using `PanResponder` + `Animated.Value`
  - Holiday loading via `getHolidayMapForYear(viewYear)`
  - Navigation to date detail via `handleDatePress()`
  - "Back to Today" button rendered conditionally
- **State Management:**
  - `viewYear`, `viewMonth` for current calendar view
  - `holidayMap: Record<string, string>` loaded per year
  - `navigating` flag to prevent double-press
  - `fadeAnim` and `translateX` for swipe/slide transitions
- **Styling:**
  - LinearGradient background: `colors.primaryDeep → colors.primary → colors.primaryLift`
  - Islamic pattern overlay at 0.05 opacity
  - PressableScale for all interactive elements
  - Today indicator: `colors.accent` background
  - Holiday indicator: `colors.primaryBorder` background with `colors.accent` border

#### 2. **[date].tsx** (`frontend/app/components/[date].tsx` - CalendarDetail)

- **Purpose:** Detail view for a selected date showing Islamic date, holidays, and prayer times
- **Key Features:**
  - Route params: `date` (ISO string), `month`, `year`, `holiday` (optional)
  - Prayer times fetching with retry logic and error handling
  - Next prayer countdown (today only)
  - Fade + slide animations when changing dates
  - Animated back navigation to calendar
- **State Management:**
  - `selectedDate: Date | null`
  - `holiday: string | null` (computed from holidayMap if not passed)
  - `prayerTimes: PrayerTime[]`
  - `nextPrayer` with countdown
  - `loading`, `error` (typed as `UIError`)
  - `fadeAnim`, `slideAnim` for transitions
- **UI Layout (top to bottom):**
  1. Back button to Calendar
  2. Prev/Next date navigation
  3. Date display (Gregorian + Islamic)
  4. **Holiday Box** (if holiday exists) - styled with:
     - `backgroundColor: colors.primarySurface`
     - `borderRadius: 12`
     - `padding: 16`
     - `marginBottom: 20`
     - `borderWidth: 2, borderColor: colors.accent`
     - `shadowColor: colors.accent, shadowOpacity: 0.6, shadowRadius: 8`
  5. "Prayer Times" title
  6. Error/Loading/Empty states
  7. PrayerTimesList component in styled container
  8. Next prayer countdown (if today)

#### 3. **holidayService.ts** (`frontend/services/holidayService.ts`)

- **API:** Aladhan `gToHCalendar` endpoint
- **Data Structure:**
  ```typescript
  interface Holiday {
    date: string; // "YYYY-MM-DD"
    name: string; // e.g. "Eid al-Adha"
  }
  ```
- **Key Functions:**
  - `getHolidaysForYear(year)`: Fetches all Islamic holidays for a Gregorian year
  - `getHolidayMapForYear(year)`: Returns `Record<string, string>` for O(1) lookup
  - `dateKeyFromDate(date)`: Converts Date to "YYYY-MM-DD" string
- **Caching:**
  - In-memory cache: `cachedHolidays: Record<number, Holiday[]>`
  - AsyncStorage: `holidays-${year}`
- **Ramadan Detection:**
  - Ramadan is returned as a holiday for the first day of Ramadan only
  - Example: `{ date: "2026-02-18", name: "Ramadan" }`
  - To get the full month, we need to detect the start and compute end (29-30 days later)

#### 4. **AsyncStorage Patterns**

- Used throughout services: `prayerTimes.ts`, `quranProgress.ts`, `duaService.ts`, `holidayService.ts`
- Pattern:
  ```typescript
  const key = "feature_name_v1";
  const raw = await AsyncStorage.getItem(key);
  const data = raw ? JSON.parse(raw) : defaultValue;
  await AsyncStorage.setItem(key, JSON.stringify(data));
  ```
- Versioned keys prevent stale data conflicts

#### 5. **PressableScale Component**

- Animated Pressable with spring scale animation
- Default `scaleTo={0.95}`
- Used for all interactive buttons throughout the app
- Pattern:
  ```tsx
  <PressableScale onPress={handler}>
    <Text style={...}>Button</Text>
  </PressableScale>
  ```

#### 6. **Theme System** (`frontend/constants/theme.ts`)

- Color palette with semantic names
- `withOpacity(hexColor, alpha)` helper for dynamic transparency
- Key colors:
  - `primary`: "#134b0a"
  - `primarySurface`: "#1a5f0e"
  - `primaryDark`: "#0c3605"
  - `accent`: "#DABA69"
  - `white`: "#ffffff"

---

## Implementation Plan

### Phase 1: Storage Service Layer

#### File: `frontend/services/ramadanTracker.ts` (NEW)

**Purpose:** Manage Ramadan fasting status per Gregorian date

**Implementation:**

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

// Two-state model: explicitly tracked or null (not yet marked)
export type RamadanStatus = "fasted" | "not_fasted";

// Storage key (versioned)
const RAMADAN_TRACKER_KEY = "ramadan_tracker_v1";

/**
 * Convert Date to local date key "YYYY-MM-DD"
 * Matches holidayService.ts dateKeyFromDate pattern
 */
function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get all Ramadan statuses from storage
 * @returns Record mapping "YYYY-MM-DD" to RamadanStatus
 */
export async function getRamadanMap(): Promise<Record<string, RamadanStatus>> {
  try {
    const raw = await AsyncStorage.getItem(RAMADAN_TRACKER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn("Failed to load Ramadan tracker data:", e);
    return {};
  }
}

/**
 * Get Ramadan status for a specific date
 * @returns RamadanStatus if marked, null if not yet tracked
 */
export async function getRamadanStatus(
  date: Date,
): Promise<RamadanStatus | null> {
  const map = await getRamadanMap();
  return map[dateKey(date)] ?? null;
}

/**
 * Set Ramadan status for a specific date
 * @param date - Date to mark
 * @param status - "fasted" or "not_fasted"
 */
export async function setRamadanStatus(
  date: Date,
  status: RamadanStatus,
): Promise<void> {
  try {
    const map = await getRamadanMap();
    map[dateKey(date)] = status;
    await AsyncStorage.setItem(RAMADAN_TRACKER_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save Ramadan status:", e);
    throw e;
  }
}
```

**Storage Structure Example:**

```json
{
  "2026-02-18": "fasted",
  "2026-02-19": "fasted",
  "2026-02-20": "not_fasted",
  "2026-02-21": "fasted"
}
```

**Key Design Decisions:**

- Uses same date key format as `holidayService.ts` for consistency
- Null status means user hasn't marked this date (not the same as "not fasted")
- Versioned key allows future schema changes without migration code
- Error handling logs warnings but doesn't crash app

---

### Phase 2: Ramadan Detection Helper

#### File: `frontend/services/ramadanTracker.ts` (EXTEND)

**Purpose:** Determine if a date falls within the Ramadan visibility window

**Implementation:**

Add to existing `ramadanTracker.ts`:

```typescript
// Buffer days before/after Ramadan for universal compatibility
const RAMADAN_BUFFER_DAYS = 3;

/**
 * Check if a date is within the Ramadan visibility window
 * Applies ±3 day buffer to accommodate different madhabs and moon sightings
 *
 * @param date - Date to check
 * @param ramadanStart - First day of Ramadan (from holiday service)
 * @param ramadanEnd - Last day of Ramadan (computed as start + 29 days)
 * @returns true if date is within buffered window
 */
export function isInRamadanWindow(
  date: Date,
  ramadanStart: Date,
  ramadanEnd: Date,
): boolean {
  // Clone dates to avoid mutation
  const start = new Date(ramadanStart);
  const end = new Date(ramadanEnd);

  // Apply buffer
  start.setDate(start.getDate() - RAMADAN_BUFFER_DAYS);
  end.setDate(end.getDate() + RAMADAN_BUFFER_DAYS);

  // Reset time parts for date-only comparison
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return checkDate >= start && checkDate <= end;
}

/**
 * Extract Ramadan start date from holiday list
 * @param holidays - Array of holidays for the year
 * @returns Date object for first day of Ramadan, or null if not found
 */
export function findRamadanStart(holidays: Holiday[]): Date | null {
  const ramadanHoliday = holidays.find((h) => /^ramadan$/i.test(h.name.trim()));
  return ramadanHoliday ? new Date(ramadanHoliday.date) : null;
}

/**
 * Compute Ramadan end date (start + 29 days)
 * Ramadan is 29-30 days; we use 29 to be conservative with buffer
 * @param ramadanStart - First day of Ramadan
 * @returns Date object for estimated last day
 */
export function computeRamadanEnd(ramadanStart: Date): Date {
  const end = new Date(ramadanStart);
  end.setDate(end.getDate() + 29);
  return end;
}
```

**Import Addition:**

```typescript
import { Holiday } from "./holidayService";
```

**Why 29 days?**

- Ramadan is 29-30 days depending on moon sighting
- Using 29 + 3-day buffer = covers up to day 32, which is safe
- Avoids false positives in Shawwal (next month)

---

### Phase 3: Monthly Summary Helper

#### File: `frontend/services/ramadanTracker.ts` (EXTEND)

**Purpose:** Compute summary statistics for Calendar screen

**Implementation:**

Add to existing `ramadanTracker.ts`:

```typescript
/**
 * Get Ramadan summary for a specific month
 * @param map - Full Ramadan status map
 * @param year - Gregorian year
 * @param month - Gregorian month (0-indexed, 0 = January)
 * @returns Summary with missed count and day numbers
 */
export function getMonthRamadanSummary(
  map: Record<string, RamadanStatus>,
  year: number,
  month: number,
): {
  totalMissed: number;
  missedDays: number[];
} {
  const missed: string[] = [];

  for (const [dateStr, status] of Object.entries(map)) {
    if (status !== "not_fasted") continue;

    const date = new Date(dateStr);
    if (date.getFullYear() === year && date.getMonth() === month) {
      missed.push(dateStr);
    }
  }

  return {
    totalMissed: missed.length,
    missedDays: missed.map((d) => new Date(d).getDate()).sort((a, b) => a - b),
  };
}
```

**Output Example:**

```javascript
{
  totalMissed: 4,
  missedDays: [19, 20, 24, 27]
}
```

---

### Phase 4: CalendarDetail Integration

#### File: `frontend/app/components/[date].tsx` (MODIFY)

**Purpose:** Add Ramadan fasting status UI card between Holiday box and Prayer Times

**Changes:**

##### 4.1 Add Imports

**Location:** Top of file (after existing imports)

```typescript
// ADD THESE IMPORTS
import {
  getRamadanStatus,
  setRamadanStatus,
  RamadanStatus,
  isInRamadanWindow,
  findRamadanStart,
  computeRamadanEnd,
} from "../../services/ramadanTracker";
import { getHolidaysForYear } from "../../services/holidayService";
```

##### 4.2 Add State Variables

**Location:** Inside `CalendarDetail()` function, after existing `useState` declarations (~line 60)

**Insertion Point:**

```typescript
const [fetchNonce, setFetchNonce] = useState(0);

// ADD THESE STATE VARIABLES
const [ramadanStatus, setRamadanStatusState] = useState<RamadanStatus | null>(
  null,
);
const [isRamadan, setIsRamadan] = useState(false);
const [loadingRamadan, setLoadingRamadan] = useState(false);
```

##### 4.3 Add Ramadan Status Loading Effect

**Location:** After the `selectedDate` setup effect (~line 80), before prayer times effect

**Insertion Point:**

```typescript
useEffect(() => {
  let mounted = true;
  (async () => {
    if (!selectedDate || hasHolidayParam) return;
    try {
      const map = await getHolidayMapForYear(selectedDate.getFullYear());
      const key = dateKeyFromDate(selectedDate);
      const computed = map[key] ?? null;
      if (mounted) setHoliday(computed);
    } catch (e) {
      console.warn("Failed to resolve holiday:", e);
    }
  })();
  return () => {
    mounted = false;
  };
}, [selectedDate, hasHolidayParam]);

// ADD THIS EFFECT
useEffect(() => {
  let mounted = true;
  (async () => {
    if (!selectedDate) return;
    setLoadingRamadan(true);
    try {
      // Load status for this date
      const status = await getRamadanStatus(selectedDate);

      // Check if date is in Ramadan window
      const holidays = await getHolidaysForYear(selectedDate.getFullYear());
      const ramadanStart = findRamadanStart(holidays);

      if (ramadanStart) {
        const ramadanEnd = computeRamadanEnd(ramadanStart);
        const inWindow = isInRamadanWindow(
          selectedDate,
          ramadanStart,
          ramadanEnd,
        );
        if (mounted) {
          setIsRamadan(inWindow);
          setRamadanStatusState(status);
        }
      } else {
        if (mounted) {
          setIsRamadan(false);
          setRamadanStatusState(null);
        }
      }
    } catch (e) {
      console.warn("Failed to load Ramadan status:", e);
      if (mounted) {
        setIsRamadan(false);
        setRamadanStatusState(null);
      }
    } finally {
      if (mounted) setLoadingRamadan(false);
    }
  })();
  return () => {
    mounted = false;
  };
}, [selectedDate]);
```

##### 4.4 Add Status Update Handler

**Location:** After existing helper functions (~line 140), before `if (!selectedDate) return null;`

**Insertion Point:**

```typescript
const openSettings = async () => {
  try {
    if (Platform.OS === "ios") {
      await Linking.openURL("app-settings:");
    } else {
      await Linking.openSettings();
    }
  } catch {}
};

// ADD THIS HANDLER
const handleRamadanStatusChange = async (status: RamadanStatus) => {
  if (!selectedDate) return;
  try {
    await setRamadanStatus(selectedDate, status);
    setRamadanStatusState(status);
  } catch (e) {
    console.error("Failed to update Ramadan status:", e);
    // Optionally show error toast here
  }
};
```

##### 4.5 Add Ramadan Card UI Component

**Location:** Inside return statement, **between Holiday Box and Prayer Times title** (~line 640)

**Exact Insertion Point:**

```tsx
{
  /* Holiday Box */
}
{
  holiday && (
    <View
      style={{
        backgroundColor: colors.primarySurface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 2,
        borderColor: colors.accent,
        shadowColor: colors.accent,
        shadowOpacity: 0.6,
        shadowRadius: 8,
        elevation: 4,
      }}
    >
      <Text
        style={{
          color: colors.accent,
          fontSize: 18,
          textAlign: "center",
        }}
      >
        {holiday}
      </Text>
    </View>
  );
}

{
  /* ADD RAMADAN TRACKER CARD HERE */
}
{
  isRamadan && !loadingRamadan && (
    <View
      style={{
        backgroundColor: withOpacity(colors.black, 0.2),
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: withOpacity(colors.white, 0.08),
      }}
    >
      <Text
        style={{
          color: colors.white,
          fontSize: 18,
          fontFamily: "SFProDisplay-Semibold",
          textAlign: "center",
          marginBottom: 14,
        }}
      >
        Ramadan Fast Status
      </Text>

      <View
        style={{
          flexDirection: "row",
          gap: 12,
          justifyContent: "center",
        }}
      >
        <PressableScale
          onPress={() => handleRamadanStatusChange("fasted")}
          style={{
            flex: 1,
            backgroundColor:
              ramadanStatus === "fasted" ? colors.accent : colors.primaryDark,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color:
                ramadanStatus === "fasted" ? colors.primaryDark : colors.white,
              fontSize: 16,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Fasted
          </Text>
        </PressableScale>

        <PressableScale
          onPress={() => handleRamadanStatusChange("not_fasted")}
          style={{
            flex: 1,
            backgroundColor:
              ramadanStatus === "not_fasted"
                ? colors.accent
                : colors.primaryDark,
            paddingVertical: 12,
            paddingHorizontal: 20,
            borderRadius: 10,
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color:
                ramadanStatus === "not_fasted"
                  ? colors.primaryDark
                  : colors.white,
              fontSize: 16,
              fontFamily: "SFProDisplay-Semibold",
            }}
          >
            Not Fasted
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

{
  /* Section title */
}
<Text
  style={{
    color: colors.white,
    fontSize: 20,
    marginBottom: 10,
    textAlign: "center",
  }}
>
  Prayer Times
</Text>;
```

**Styling Notes:**

- Card matches existing prayer times container styling (translucent black with subtle border)
- Button states use existing color scheme (accent for active, primaryDark for inactive)
- PressableScale provides consistent interaction feedback
- No loading spinner for status change (instant feedback via optimistic update)
- Card only visible when `isRamadan && !loadingRamadan`

---

### Phase 5: Calendar Monthly Summary

#### File: `frontend/app/(tabs)/Calendar.tsx` (MODIFY)

**Purpose:** Show Ramadan summary for the visible month

**Changes:**

##### 5.1 Add Imports

**Location:** Top of file (after existing imports)

```typescript
// ADD THESE IMPORTS
import {
  getRamadanMap,
  getMonthRamadanSummary,
  findRamadanStart,
  computeRamadanEnd,
  isInRamadanWindow,
} from "../../services/ramadanTracker";
import { getHolidaysForYear } from "../../services/holidayService";
```

##### 5.2 Add State Variables

**Location:** Inside `CalendarScreen()` function, after existing `useState` declarations (~line 50)

**Insertion Point:**

```typescript
const [navigating, setNavigating] = useState(false);

// ADD THESE STATE VARIABLES
const [ramadanMap, setRamadanMap] = useState<Record<string, string>>({});
const [ramadanMonthActive, setRamadanMonthActive] = useState(false);
```

##### 5.3 Add Ramadan Data Loading Effect

**Location:** After holiday loading effect (~line 90)

**Insertion Point:**

```typescript
// Load holidays for the visible year
useEffect(() => {
  let mounted = true;
  (async () => {
    setLoadingHolidays(true);
    try {
      const map = await getHolidayMapForYear(viewYear);
      if (mounted) setHolidayMap(map);
    } catch (err) {
      console.error("Failed to load holidays:", err);
      if (mounted) setHolidayMap({});
    } finally {
      if (mounted) setLoadingHolidays(false);
    }
  })();
  return () => {
    mounted = false;
  };
}, [viewYear]);

// ADD THIS EFFECT
useEffect(() => {
  let mounted = true;
  (async () => {
    try {
      // Load Ramadan tracker data
      const map = await getRamadanMap();
      if (mounted) setRamadanMap(map);

      // Check if current month is in Ramadan window
      const holidays = await getHolidaysForYear(viewYear);
      const ramadanStart = findRamadanStart(holidays);

      if (ramadanStart) {
        const ramadanEnd = computeRamadanEnd(ramadanStart);
        const firstOfMonth = new Date(viewYear, viewMonth, 1);
        const lastOfMonth = new Date(viewYear, viewMonth + 1, 0);

        // Month is "Ramadan active" if any day in the month is in window
        const monthInWindow =
          isInRamadanWindow(firstOfMonth, ramadanStart, ramadanEnd) ||
          isInRamadanWindow(lastOfMonth, ramadanStart, ramadanEnd);

        if (mounted) setRamadanMonthActive(monthInWindow);
      } else {
        if (mounted) setRamadanMonthActive(false);
      }
    } catch (e) {
      console.warn("Failed to load Ramadan data:", e);
      if (mounted) {
        setRamadanMap({});
        setRamadanMonthActive(false);
      }
    }
  })();
  return () => {
    mounted = false;
  };
}, [viewYear, viewMonth]);
```

##### 5.4 Add Summary Computation (Memoized)

**Location:** After `matrix` and `monthName` useMemo hooks (~line 85)

**Insertion Point:**

```typescript
const monthName = useMemo(
  () =>
    new Date(viewYear, viewMonth).toLocaleString("default", {
      month: "long",
    }),
  [viewYear, viewMonth],
);

// ADD THIS MEMO
const ramadanSummary = useMemo(() => {
  if (!ramadanMonthActive) return null;
  return getMonthRamadanSummary(ramadanMap, viewYear, viewMonth);
}, [ramadanMap, viewYear, viewMonth, ramadanMonthActive]);
```

##### 5.5 Add Summary UI Component

**Location:** Inside return statement, **below month name, above calendar grid** (~line 340)

**Exact Insertion Point:**

```tsx
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <PressableScale
              onPress={goToPreviousMonth}
              disabled={new Date(viewYear, viewMonth - 1) < minDate}
            >
              <Ionicons
                name="chevron-back"
                size={28}
                color={
                  new Date(viewYear, viewMonth - 1) < minDate
                    ? colors.grayDark
                    : colors.accent
                }
              />
            </PressableScale>

            <Text
              style={{
                color: colors.white,
                fontSize: 22,
                fontFamily: "SFProDisplay-Semibold",
              }}
            >
              {monthName} {viewYear}
            </Text>

            <PressableScale
              onPress={goToNextMonth}
              disabled={new Date(viewYear, viewMonth + 1) > maxDate}
            >
              <Ionicons
                name="chevron-forward"
                size={28}
                color={
                  new Date(viewYear, viewMonth + 1) > maxDate
                    ? colors.grayDark
                    : colors.accent
                }
              />
            </PressableScale>
          </View>

          {/* ADD RAMADAN SUMMARY HERE */}
          {ramadanSummary && ramadanSummary.totalMissed > 0 && (
            <View
              style={{
                backgroundColor: withOpacity(colors.black, 0.25),
                borderRadius: 10,
                padding: 12,
                marginBottom: 14,
                borderWidth: 1,
                borderColor: withOpacity(colors.accent, 0.3),
              }}
            >
              <Text
                style={{
                  color: colors.accent,
                  fontSize: 14,
                  fontFamily: "SFProDisplay-Semibold",
                  marginBottom: 6,
                }}
              >
                Ramadan Summary
              </Text>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 13,
                  fontFamily: "SFProDisplay-Regular",
                }}
              >
                Missed: {ramadanSummary.totalMissed}
              </Text>
              <Text
                style={{
                  color: colors.white,
                  fontSize: 13,
                  fontFamily: "SFProDisplay-Regular",
                  marginTop: 2,
                }}
              >
                Days: {ramadanSummary.missedDays.join(", ")}
              </Text>
            </View>
          )}
        </View>
```

**Styling Notes:**

- Compact card design to not interfere with calendar grid
- Only shows if there are missed days (progressive disclosure)
- Uses translucent styling to blend with existing design
- Positioned above calendar grid for visibility

---

## Testing Checklist

### Unit Testing (Manual)

#### Storage Layer Tests

- [ ] `getRamadanMap()` returns empty object on first run
- [ ] `setRamadanStatus()` persists data correctly
- [ ] `getRamadanStatus()` returns null for untracked dates
- [ ] `getRamadanStatus()` returns correct status after setting
- [ ] Storage survives app restart

#### Ramadan Window Tests

- [ ] `findRamadanStart()` correctly extracts Ramadan date from holidays
- [ ] `computeRamadanEnd()` calculates 29 days after start
- [ ] `isInRamadanWindow()` returns true for dates within buffer
- [ ] `isInRamadanWindow()` returns false for dates outside buffer
- [ ] Buffer works across month boundaries

#### Monthly Summary Tests

- [ ] `getMonthRamadanSummary()` returns 0 missed for empty month
- [ ] `getMonthRamadanSummary()` correctly counts missed days
- [ ] `getMonthRamadanSummary()` sorts day numbers ascending
- [ ] Summary ignores days marked as "fasted"
- [ ] Summary only includes current month

### Integration Testing

#### CalendarDetail Screen

- [ ] Ramadan card only visible during Ramadan window
- [ ] Ramadan card hidden outside Ramadan window
- [ ] Card shows correct initial status (null, fasted, not_fasted)
- [ ] Tapping "Fasted" updates status immediately
- [ ] Tapping "Not Fasted" updates status immediately
- [ ] Status persists when navigating away and back
- [ ] Card positioned correctly between Holiday box and Prayer Times
- [ ] Animations not affected by new card
- [ ] No performance issues when loading

#### Calendar Screen

- [ ] Summary only visible during Ramadan month
- [ ] Summary hidden when no missed days
- [ ] Summary shows correct count and day numbers
- [ ] Summary updates when month changes
- [ ] Summary positioned correctly above calendar grid
- [ ] No layout shifts when summary appears/disappears

### Cross-Feature Testing

- [ ] Calendar navigation still works (swipe, arrows)
- [ ] Date detail navigation still works
- [ ] Prayer times still load correctly
- [ ] Holiday display unchanged
- [ ] Back to Today button still works
- [ ] All animations smooth and consistent

### Edge Cases

- [ ] Ramadan spanning two months (e.g., Feb-Mar)
- [ ] Ramadan in different years (Gregorian shift)
- [ ] First/last days of Ramadan with buffer
- [ ] Switching between years with/without Ramadan data
- [ ] App works if holiday API fails (no crash)
- [ ] App works if storage fails (graceful degradation)

### Performance Testing

- [ ] No lag when loading CalendarDetail
- [ ] No lag when swiping Calendar months
- [ ] AsyncStorage operations don't block UI
- [ ] Memory usage stable after repeated navigation

---

## Migration & Rollback

### Migration Strategy

- **No data migration needed** (new feature)
- Storage key is versioned (`ramadan_tracker_v1`)
- Feature is additive; no existing code broken
- Can be feature-flagged if needed

### Rollback Plan

If issues arise:

1. Remove imports from `Calendar.tsx` and `[date].tsx`
2. Remove state variables and effects
3. Remove UI components
4. Delete `ramadanTracker.ts`
5. Data remains in storage (harmless) or clear via:
   ```typescript
   await AsyncStorage.removeItem("ramadan_tracker_v1");
   ```

---

## Code Review Checklist

### Architecture

- [ ] Service layer separated from UI
- [ ] No business logic in components
- [ ] Consistent with existing service patterns
- [ ] Type-safe interfaces

### UI/UX

- [ ] Matches existing design language
- [ ] PressableScale used for all buttons
- [ ] Color palette respected
- [ ] Animations preserved
- [ ] No layout shifts
- [ ] Responsive design

### Performance

- [ ] AsyncStorage operations async
- [ ] useMemo for expensive computations
- [ ] No unnecessary re-renders
- [ ] Effect cleanup functions present

### Code Quality

- [ ] TypeScript types correct
- [ ] No `any` types
- [ ] Error handling present
- [ ] Console warnings for failures (not errors that crash)
- [ ] Consistent code style

### Testing

- [ ] All checklist items verified
- [ ] Tested on iOS and Android
- [ ] Tested with different Ramadan dates
- [ ] Tested edge cases

---

## Timeline

- **Phase 1 (Storage Layer):** 30 minutes
- **Phase 2 (Ramadan Detection):** 20 minutes
- **Phase 3 (Monthly Summary):** 15 minutes
- **Phase 4 (CalendarDetail Integration):** 45 minutes
- **Phase 5 (Calendar Summary):** 30 minutes
- **Testing:** 60 minutes
- **Code Review & Refinement:** 30 minutes

**Total Estimated Time:** 3.5-4 hours

---

## Future Enhancements (Out of Scope)

- Export/backup of fasting data
- Year-over-year statistics
- Motivational quotes or reminders
- Integration with notification service
- Widget support
- Accessibility improvements (VoiceOver/TalkBack)

---

## Notes

### Design Philosophy

This implementation follows Sirat's core principles:

- **Privacy-first:** All data stored locally
- **Respectful:** No religious enforcement or judgment
- **Universal:** Works for all madhabs via buffer system
- **Seamless:** Feels like a natural extension, not a bolt-on
- **Robust:** Graceful degradation when APIs fail

### Religious Sensitivity

- No medical or menstrual framing
- No "streak" gamification
- No social sharing features
- No mandatory usage
- Simple binary states (fasted/not fasted)
- Quiet and respectful design

### Technical Debt

- None introduced
- Follows existing patterns exactly
- Service layer can be unit tested independently
- UI components can be feature-flagged

---

## Appendix: Type Definitions

### ramadanTracker.ts Types

```typescript
export type RamadanStatus = "fasted" | "not_fasted";
```

### Storage Schema

```typescript
type RamadanTrackerStorage = Record<string, RamadanStatus>;
// Example:
// {
//   "2026-02-18": "fasted",
//   "2026-02-19": "not_fasted"
// }
```

### Component State Types

```typescript
// CalendarDetail
const [ramadanStatus, setRamadanStatusState] = useState<RamadanStatus | null>(
  null,
);
const [isRamadan, setIsRamadan] = useState(false);
const [loadingRamadan, setLoadingRamadan] = useState(false);

// Calendar
const [ramadanMap, setRamadanMap] = useState<Record<string, string>>({});
const [ramadanMonthActive, setRamadanMonthActive] = useState(false);
```

---

## Conclusion

This plan provides a complete, production-ready implementation of a Ramadan fasting tracker that:

- ✅ Respects user privacy (local-only storage)
- ✅ Works universally (±3 day buffer)
- ✅ Integrates seamlessly (matches existing patterns)
- ✅ Preserves all animations and navigation
- ✅ Requires no configuration or backend
- ✅ Handles errors gracefully
- ✅ Is fully testable and maintainable

The implementation is ready for execution following the exact file locations, insertion points, and code blocks specified above.
