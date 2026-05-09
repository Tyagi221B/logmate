# Architecture

> System design decisions for the Spotter ELD Trip Planner.

## Stack

| Layer | Choice | Reason |
|---|---|---|
| Backend | Django + DRF | Required by assessment |
| Frontend | React + Vite | Fast dev, Vercel-ready |
| Python pkg mgr | uv | Faster than pip, lockfile support |
| Map/Routing API | OpenRouteService | Free, no CC required, good docs |
| Log sheet render | SVG (React) | Precise pixel control, no canvas state mgmt |
| Backend deploy | DigitalOcean | User preference |
| Frontend deploy | Vercel | Free, zero config for Vite |

## Data Flow

```
User fills form
    ↓
React → POST /api/trip/ → Django
    ↓
Django calls ORS API (current → pickup → dropoff)
    ↓
Django runs HOS scheduler → generates daily schedule
    ↓
Returns JSON: { route, stops, days: [{date, segments}] }
    ↓
React renders:
  - Map with route + stop markers (ORS + Leaflet)
  - ELD log sheets (SVG, one per day)
```

## Django App Structure (planned)
```
backend/
├── pyproject.toml          ← uv managed
├── manage.py
└── spotter/
    ├── settings.py
    ├── urls.py
    └── trips/
        ├── views.py        ← TripPlanView (POST)
        ├── serializers.py
        ├── hos_calculator.py ← core HOS scheduling logic
        ├── ors_client.py   ← OpenRouteService wrapper
        └── log_generator.py← generates log sheet data
```

## React App Structure (planned)
```
frontend/
├── src/
│   ├── App.jsx
│   ├── components/
│   │   ├── TripForm.jsx     ← inputs
│   │   ├── RouteMap.jsx     ← Leaflet map
│   │   └── LogSheet.jsx     ← SVG log sheet renderer
│   └── api.js              ← axios calls to Django
```

## API Contract

### POST /api/trip/
Request:
```json
{
  "current_location": "Chicago, IL",
  "pickup_location": "St. Louis, MO",
  "dropoff_location": "Dallas, TX",
  "current_cycle_hours": 20.5
}
```

Response:
```json
{
  "total_distance_miles": 850,
  "total_duration_hours": 13.5,
  "route_geometry": {...},
  "stops": [
    {"type": "pickup", "location": "St. Louis, MO", "lat": ..., "lng": ...},
    {"type": "fuel", "location": "...", "lat": ..., "lng": ...},
    {"type": "rest", "location": "...", "lat": ..., "lng": ...},
    {"type": "dropoff", "location": "Dallas, TX", "lat": ..., "lng": ...}
  ],
  "days": [
    {
      "date": "2026-05-08",
      "segments": [
        {"status": "on_duty", "start": "06:00", "end": "06:30", "location": "Chicago, IL", "activity": "Pre-trip inspection"},
        {"status": "driving", "start": "06:30", "end": "10:30", "location": "Chicago, IL → St. Louis, MO"},
        ...
      ],
      "totals": {"off_duty": 10.0, "sleeper": 0, "driving": 11.0, "on_duty": 3.0}
    }
  ]
}
```

## V1 Goal — Ship This, Nothing Else
- Form with 4 inputs works
- Backend calculates route + HOS schedule
- Map shows the route with stops
- Log sheets render correctly (grid + totals)
- Hosted and working

No auth, no saved trips, no mobile optimization, no over-engineering.
Ship v1, then optimize.

## Log Sheet Totals Format (from video screenshots)
- Hours and minutes in **separate boxes** — HH:MM not decimal
- Must sum to exactly 24:00
- Total on-duty hours shown separately as decimal (e.g. 10.5) for HOS recap
- Grid is in **15-minute increments** (00, 15, 30, 45)

## TypeScript Config — Single Source of Truth

Vite projects split TypeScript into two configs:
- `tsconfig.json` — root, only holds `references` and `paths`. Has `"files": []` so `tsc --noEmit` alone checks **nothing**.
- `tsconfig.app.json` — the real app config. Has `strict: true`, `erasableSyntaxOnly`, `noUnusedLocals`, etc.

The IDE (VS Code) uses `tsconfig.app.json` directly.  
The build script uses `tsc -b` which honours references → also uses `tsconfig.app.json`.

**Rule:** always run `npm run typecheck` (= `tsc -b`) for the authoritative check.  
Never run bare `tsc --noEmit` — it silently checks nothing.

## Zod v4 API Changes (vs v3)
- `invalid_type_error` / `required_error` options → replaced by unified `error` option
- `z.coerce.number()` has input type `unknown`, output type `number` — different from v3
- With react-hook-form, must use `useForm<FormInput, unknown, FormOutput>` where `FormInput = z.input<typeof schema>` and `FormOutput = z.output<typeof schema>`

## Log Sheet Remarks — One Per Bracket
Remarks (diagonal labels below grid) are driven by **brackets**, not status changes.
- Bracket = on-duty-not-driving period (vehicle stationary)
- One diagonal per bracket: city name above the line, activity below
- Diagonal originates from the bottom-left corner of the bracket shape
- Diagonal length is proportional to text length (city × 4.8px/char, activity × 4.2px/char)

## Log Sheet Minor Ticks
15/30/45-minute ticks are drawn at every **row boundary** (5 positions for 4 rows), pointing inward into each row. `:30` mark is 7px, `:15`/`:45` are 4px. This matches the real ELD paper log ruler-edge style.

## Known Logic Bugs (as of 2026-05-09)

### Bug 1 — All mid-leg stops show leg start city (CRITICAL)
`_drive_leg(from_loc, to_loc)` uses `from_loc` for every stop location — fuel, break, rest — regardless of how far into the leg the truck has traveled.
Example: Leg 2 is `Haridwar → Kanyakumari`. A fuel stop at mile 400 still says "Haridwar" as its location.

**Root cause:** `hos_calculator.py` is time/mile-only, no geographic awareness.

**Fix planned:** Pass ORS route geometry to the calculator. Track cumulative miles driven. Interpolate position along geometry at each stop → reverse geocode → real city name.

### Bug 2 — Driving segment From/To shows full leg endpoints, not day-level positions
On Day 2 of a multi-day trip, driving still logs as `"Haridwar → Kanyakumari"` even though the driver started the day somewhere in the middle of that leg. Log sheet header From/To fields are wrong.

**Fix planned:** Record actual interpolated position at each day's first and last driving segment. Expose as `day_start_location` / `day_end_location` on DayLog.

### Bug 3 — 70-Hour Cycle Limit NOT Enforced (CRITICAL, newly found)
`_drive_leg` checks daily limits (11hr driving, 14hr window) but has zero check for `cycle_hours >= 70`.
Driver with 65 cycle hours used + 4-day trip → calculator generates a 90-hour schedule. Invalid.

**Fix:** Add cycle remaining to `_drive_leg` limits. When exhausted, insert 34-hour restart (FMCSA standard reset mechanism), reset `cycle_hours = 0`.

### Bug 4 — 14-Hour Window Calculation Breaks Across Midnight (newly found)
`self.hour` resets to 0 at midnight. `window_start` is not adjusted. If shift starts at 10 PM and crosses midnight, the calculator computes 34 hours of window remaining instead of ~10.

**Fix:** Add `self.abs_hour` (monotonically increasing). Use it for all window/limit math. Keep `self.hour` only for 0-24 grid positions.

### Bug 5 — Miles per day (NOT a bug)
Both Day 1 and Day 2 can show 605 miles. This is correct: 11 hrs × 55 mph = 605 miles max/day. Expected behavior when the trip is long enough to exhaust the driving limit each day.

## Reverse Geocode — Two-Phase Architecture (performance fix)

**Problem:** Inline sequential resolver causes 4-5s latency from 8-10 ORS calls.

**Solution — LocationCollector pattern:**
```
Phase 1: Calculator runs with LocationCollector as resolver
  - No network calls
  - Each stop position stored as placeholder key ("__geo_0__", "__geo_1__", ...)
  - Returns immediately

Phase 2: views.py resolves all positions in parallel
  - Collect all (lat, lng) positions from collector
  - Deduplicate by rounded coordinate (same position = one API call)
  - ThreadPoolExecutor fires all calls simultaneously
  - Substitute real city names back into output
```

**LocationCollector lives in views.py** (not calculator — keeps calculator pure).
**reverse_geocode stays in ors_client.py** — injected at the views layer.
**No changes to frontend.**

Result: 8 × 500ms sequential → 8 × 500ms parallel = ~500ms total geocoding.

## Location-Aware HOS Plan (HLD)

The fix requires adding a `RouteGeoRef` layer between ORS and the calculator:

```
ORS returns geometry (LineString [[lng,lat], ...]) + leg distances
    ↓
RouteGeoRef: precomputes cumulative km/mile along each geometry segment
    ↓
TripScheduler: tracks self.cumulative_miles_driven
    ↓
On each stop: RouteGeoRef.interpolate(cumulative_miles) → (lat, lng)
    ↓
ORS reverse geocode (lat, lng) → "City, State/Country"
    ↓
Stop location label = real city
```

Components to build:
1. `RouteGeoRef` class in `hos_calculator.py` — geometry interpolation
2. `reverse_geocode(lat, lng) → str` in `ors_client.py` — ORS reverse geocode endpoint
3. `TripScheduler` tracks `cumulative_miles_driven`, calls `_location_at_miles()` for stops
4. `views.py` builds `RouteGeoRef` and passes it to `calculate_schedule`
5. `DayLog` gets `day_start_location` / `day_end_location` fields

## Last Updated
2026-05-09 — Added Bugs 3+4 (cycle limit, midnight window), confirmed correct behaviors, edge case decisions
