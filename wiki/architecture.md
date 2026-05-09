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

## Last Updated
2026-05-09 — TypeScript single source of truth, Zod v4 notes, log sheet remarks + ticks
