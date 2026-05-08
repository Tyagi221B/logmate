# HOS Rules Reference — 70hr/8-day Property Carrier

> Source: FMCSA guide + Schneider YouTube tutorial (confirmed)

## The Core Limits

| Rule | Limit |
|---|---|
| Max driving per shift | 11 hours |
| On-duty window | 14 hours from first on-duty moment |
| 30-min break requirement | After 8 hrs driving with no 30-min non-driving break |
| Rest between shifts | 10 consecutive hours (Off Duty + Sleeper combined) |
| Rolling 8-day cap | 70 hours total on-duty |

## The 30-Minute Break Rule (FMCSR 395.3) — CONFIRMED
"A consecutive 30-minute interruption of driving status may be satisfied either by
off-duty, sleeper berth or on-duty not driving time or by a combination."

**This means:**
- Pre-trip (30 min On Duty) → resets the 8-hr driving clock ✅
- Pickup/Dropoff (1 hr On Duty) → resets the 8-hr driving clock ✅
- Fuel stop (30 min On Duty) → resets the 8-hr driving clock ✅
- Only insert explicit Off Duty break if driver reaches 8 hrs driving with NO natural stop ≥ 30 min

## The 14-Hour Window
- Starts the moment driver goes On Duty (pre-trip)
- Does NOT pause for breaks or stops
- After 14 hrs from window start → must rest 10 hours, no exceptions
- Can only drive 11 of those 14 hours

## End of Day Pattern (CONFIRMED from video)
1. Driving → On Duty (post-trip/TIV, 30 min)
2. On Duty → Off Duty (brief, ~1-1.5 hrs personal time)
3. Off Duty → Sleeper Berth (rest of night)
Both Off Duty + Sleeper count toward 10-hour rest minimum.

## Rest Crossing Midnight (CONFIRMED)
- Log is always midnight to midnight
- If rest starts at 9 PM: Day 1 gets 9PM→midnight as Sleeper, Day 2 gets midnight→rest-end as Sleeper
- Next day driving starts exactly when 10-hr rest completes

## Duty Statuses (4 rows on log sheet)
1. Off Duty — not working, not in sleeper
2. Sleeper Berth — resting in sleeper compartment (location, not activity)
3. Driving — operating the vehicle
4. On Duty (not driving) — pre/post trip, fueling, pickup, dropoff, scaling

## Our App Assumptions (fixed)
- Property-carrying driver
- 70 hrs / 8 days cycle
- No adverse driving conditions
- Fuel stop every 1,000 miles (30 min On Duty)
- 1 hour for pickup (On Duty)
- 1 hour for dropoff (On Duty)
- Pre-trip: 30 min On Duty
- Post-trip: 30 min On Duty
- Average speed: 55 mph
- Day starts: calculated from when 10-hr rest ends (first day = 6:00 AM)
- Date: use real current date for Day 1
