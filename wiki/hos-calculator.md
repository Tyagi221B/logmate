# HOS Calculator Spec — v2 (confirmed)

> Updated after full cross-examination of FMCSR rules + Schneider video.

## Key Corrections from v1
1. 30-min break can be satisfied by On Duty time (not just Off Duty)
2. Each day always starts at hour 0.0 (midnight) and ends at hour 24.0
3. Rest crossing midnight splits across pages
4. End of day = On Duty (post-trip) → Off Duty → Sleeper Berth
5. Next day start time = when 10-hr rest actually ends (not always 6 AM)

## State to Track

```python
driving_today          # hours driven this shift (resets after 10-hr rest)
driving_since_break    # hours driven since last 30-min non-driving stop
window_start_hour      # absolute hour when 14-hr clock started
miles_since_fuel       # miles since last fuel stop
cycle_hours_used       # rolling 8-day on-duty total
current_day            # which calendar day we're on (0-indexed)
current_hour           # current time as float (e.g. 14.5 = 2:30 PM)
```

## Break Clock Reset Triggers
Reset driving_since_break = 0 when ANY non-driving segment ≥ 30 min occurs:
- Pre-trip (30 min On Duty) ← resets at start of every day
- Pickup (60 min On Duty)
- Dropoff (60 min On Duty)
- Fuel stop (30 min On Duty)
- Explicit rest break (30 min Off Duty) ← only inserted if needed

## Drive Segment Logic

For each drive segment, compute the nearest limit:

```python
limit = min(
    miles_to_next_fuel / 55,           # fuel every 1000 miles
    (8.0 - driving_since_break),       # break after 8 hrs driving
    (11.0 - driving_today),            # 11-hr driving limit
    (window_start + 14.0) - current_hour,  # 14-hr window
    hours_to_midnight                  # never cross midnight while driving
)
```

Drive for `limit` hours, then handle whatever triggered it.

## End of Day Sequence

```
→ On Duty (post-trip, 0.5 hr)
→ Off Duty (1.0 hr)
→ Sleeper Berth (fills to midnight, continues into next day if needed)
→ [NEW PAGE at midnight]
→ Sleeper Berth continues until 10-hr rest is complete
→ On Duty (pre-trip, 0.5 hr)  ← next shift starts
```

## Day Page Structure (always midnight to midnight)

```python
{
  "date": "2026-05-09",       # real calendar date
  "date_offset": 0,           # 0-indexed
  "segments": [
    # ALWAYS starts at 0.0
    {"status": "sleeper", "start_hour": 0.0, "end_hour": 6.0, ...},
    {"status": "on_duty", "start_hour": 6.0, "end_hour": 6.5, ...},
    # ... more segments ...
    # ALWAYS ends at 24.0
    {"status": "sleeper", "start_hour": 21.0, "end_hour": 24.0, ...},
  ],
  "brackets": [
    # time ranges where truck was stationary (for SVG bracket on Row 3)
    # activity field added so the log sheet can label each bracket correctly
    {"start_hour": 6.0, "end_hour": 6.5, "location": "Chicago, IL", "activity": "Pre-trip/TIV"},
  ],
  # Why activity on brackets? The remarks section draws one diagonal label per bracket.
  # It needs both the city (above line) and the activity (below line).
  # Without activity on the bracket, the renderer had no way to know what the truck was doing
  # at that stationary period — it only had the city.
  "totals": {
    "off_duty": 0.0,
    "sleeper": 9.0,
    "driving": 11.0,
    "on_duty": 4.0    # must all sum to 24.0
  },
  "on_duty_decimal": 15.0,    # driving + on_duty combined, shown circled
  "driving_miles_today": 605.0
}
```

## Status: All bugs fixed (2026-05-09)

All four bugs resolved. See log.md build entry 2026-05-09 for details.

## Known Bugs — RESOLVED (cross-checked 2026-05-09)

### Bug 1 — 70-Hour Cycle Limit NOT Enforced (CRITICAL)
`_drive_leg` checks daily limits (11hr driving, 14hr window) but NEVER checks `cycle_hours >= 70`.
A driver with 65 hours used who submits a 4-day trip gets a schedule that exceeds 70 hours — invalid.

**Fix:** Add `cycle_hours_remaining = 70.0 - self.cycle_hours` to `_drive_leg` checks.
When exhausted, insert a **34-hour restart** (34hr off-duty/sleeper) and reset `self.cycle_hours = 0`.
34-hour restart is FMCSA's official mechanism to reset the 8-day rolling window.

### Bug 2 — 14-Hour Window Calculation Breaks Across Midnight
`self.hour` resets to 0.0 at midnight. `window_start` does NOT adjust.
If shift starts at 10 PM (`window_start = 22.0`) and we're now at `self.hour = 2.0` next day:
```python
hours_in_window = (22.0 + 14.0) - 2.0 = 34.0   # WRONG — should be 10.0
```
Driver gets 34 hours of perceived window. Actual remaining = 10.

**When it manifests:** Any day where rest ends after ~10 PM — which happens on Day 2+ when
the 14-hr window drains earlier than the Day 1 standard 6 AM start.

**Fix:** Track `self.abs_hour` (monotonically increasing from trip start) for all window/limit math.
`self.hour` stays 0-24 only for grid positions. `window_start` uses `abs_hour`.

### Bug 3 — All Mid-Leg Stops Show Leg Start City
See architecture.md → Known Logic Bugs → Bug 1. Fix = RouteGeoRef.

### Bug 4 — From/To Shows Full Leg Endpoints, Not Day-Level Positions
See architecture.md → Known Logic Bugs → Bug 2. Fix = day_start_location/day_end_location.

## Implementation Priority
1. Absolute time (`abs_hour`) — foundational, fixes Bug 2, required before Bug 1 fix
2. 70-hour cap + 34-hr restart — fixes Bug 1
3. RouteGeoRef + reverse geocode — fixes Bug 3
4. day_start_location / day_end_location on DayLog — fixes Bug 4

## Edge Cases — Decided NOT to Implement (V1)
- Short-haul exemption: N/A, our trips are long-haul
- Adverse driving +2hrs: assessment explicitly says "no adverse driving conditions"
- Split 30-min break (15+15): our stops are already ≥30min, no need to simulate splits
- Waiting at shipper: pickup/dropoff = On Duty ≥1hr, already handled correctly

## Location Awareness — Current Limitation

The calculator is **time/mile only**. It has no knowledge of where on the earth the truck is at any given moment. All stop locations are set to the leg start city (`from_loc`), which is wrong for mid-leg stops.

### Planned fix: RouteGeoRef

Pass ORS route geometry to the scheduler. Add a helper that answers: "given X cumulative miles from trip start, what lat/lng is the truck at?"

```python
class RouteGeoRef:
    def __init__(self, geometry_coords, leg1_miles, leg2_miles):
        # precompute cumulative distances along the LineString
        # geometry_coords = [[lng, lat], [lng, lat], ...] from ORS

    def interpolate(self, cumulative_miles: float) -> tuple[float, float]:
        # walk segments until we pass cumulative_miles
        # linear interpolate between the two bracketing points
        # return (lat, lng)
```

`TripScheduler` gets a `geo_ref: RouteGeoRef | None` and tracks `self.cumulative_miles_driven`. When inserting any stop, calls `geo_ref.interpolate(self.cumulative_miles_driven)` → ORS reverse geocode → city string.

### Day-level From/To

`DayLog` has `day_start_location` and `day_end_location` fields. These are **seeded at every calendar-day boundary** by `_new_day()` using the geo position at the moment of midnight crossing. This way non-driving days (e.g. a full 34-hr restart day with zero driving) also have correct From/To values. Driving days additionally get `day_end_location` refreshed by `_add_driving` after each drive segment. Day 0 is seeded explicitly in `__init__` since `_new_day()`'s seeding logic only runs from days[1:].

**Load-bearing dependency:** `_drive_leg`'s `miles_to_midnight` clamp ensures `cumulative_miles` is stable at the moment of midnight crossing — so `_loc_at_current_miles()` inside `_new_day()` returns the parked midnight position, not an end-of-drive position. If anyone removes that clamp, midnight seeding would silently corrupt.

The log sheet header uses these fields. `Home Terminal Address` (frontend) derives from `days[0].day_start_location`, so seeding Day 0 also fixes Home Terminal display on cycle-exhausted trips.

## Unconfirmed (handle when we get there)
- Recap section exact format (70-hr rolling calc)
- From/To header confirmed = day-level actual start/end city (not leg endpoints)

## Display Rounding (FMCSA paper-log convention)

FMCSA paper logs use a 15-minute grid — the totals column header on every form
literally says **"MINUTES TO BE 00, 15, 30, 45"**. Real drivers fill in status
changes rounded to quarter-hour boundaries because that's the resolution of the
paper grid.

The calculator runs at floating-point precision internally (e.g. a 19-mile leg
at 55 mph completes at exactly 6:50:42), but `DayLog.to_dict()` quantizes every
time value to the nearest 15-minute increment before serializing. Specifically:

- Segment `start_hour` / `end_hour`
- Bracket `start_hour` / `end_hour`
- Daily totals (recomputed from rounded segment durations so they're internally
  consistent with the chart)
- `on_duty_decimal` (derived from rounded totals)

Sub-15-minute segments that collapse to zero duration after rounding are
filtered out — this incidentally cleans up any tiny floating-point slivers
that the `_drive_leg` `min(..., 0.1)` clamps could produce at limit boundaries.

### Toggle constant

```python
DISPLAY_ROUND_TO_QUARTER_HOUR = True   # at top of hos_calculator.py
```

Set `False` to expose raw precision values — useful for debugging the
scheduler or verifying limit-math edge cases without the rounding artifact.
Internal HOS math (cycle hours, 14-hour window, 8-hour break clock) reads
from `self.abs_hour` and `self.cycle_hours` directly, never from rounded
output, so flipping this constant cannot affect scheduling correctness.

### Invariants preserved

- First segment starts at `0.0`, last ends at `24.0` — both round to themselves
- Adjacent segments share their boundary value, so rounding both ends of a
  boundary produces identical results (no gaps, no overlaps)
- Total day duration always sums to exactly 24:00

## Rest extension across midnight (calendar-day driving cap)

`_rest()` extends its sleeper portion past midnight when the natural 10-hr
rest would otherwise end on the same calendar day it began. Without this,
shift 1 (11 hrs driving) and shift 2 (any remaining driving) can both land
on one log page; the daily driving total then displays >11 hrs even though
each shift is individually compliant with §395.3.

The extension only kicks in when the rest is followed by more driving —
which is always the case for `_rest()` since it's only invoked from inside
`_drive_leg`, and only when there are remaining miles in the current leg.

Legal per §395.3: the 10-hr rest is a *minimum*, not a maximum. Realism
trade-off: in the extension case, the driver "wakes up" at exactly 00:00
and starts pre-trip — accurate to data but unusual in real-world operation.

Trigger logic in code:
```python
natural_end_abs = self.abs_hour + sleeper_needed
next_midnight_abs = (self.day_idx + 1) * 24.0
if natural_end_abs < next_midnight_abs:
    sleeper_needed = next_midnight_abs - self.abs_hour
```

## Last Updated
2026-05-12 — added rest extension in `_rest()` so the next shift always
starts on a fresh calendar page. Prevents two compliant shifts from sharing
a single log day and displaying >11 hrs driving.
