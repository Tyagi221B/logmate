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
    {"start_hour": 6.0, "end_hour": 6.5, "location": "Chicago, IL"},
  ],
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

## Unconfirmed (handle when we get there)
- Recap section exact format (70-hr rolling calc)
- Exact pixel position of circled decimal on sheet
- From/To header = assumed to be day-level start/end city

## Last Updated
2026-05-09 — full rewrite after cross-examination
