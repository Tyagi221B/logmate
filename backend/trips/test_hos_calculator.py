"""HOS calculator tests — guard against regressions in scheduling rules and recent fixes.

Run from backend/: `pytest -v`  (or `uv run pytest -v`)

Coverage:
    1. Happy path — single-day trip totals sum to 24:00
    2. FMCSA 11-hour driving limit (per shift)
    3. FMCSA 70-hour 8-day cycle limit + 34-hr restart insertion
    4. FMCSA 395.3 — 30-min break required after 8 hours of driving
    5. Day-page invariant — segments span 0:00 → 24:00 with no gaps
    6. B3 regression — restart days have day_start/end_location populated
    7. B7 regression — all display times quantized to 15-minute increments
    8. B1 regression — final Post-trip uses resolved Dropoff location

Future tests worth adding:
    - 14-hour driving window enforcement (incl. midnight crossings)
    - 10-hour rest between consecutive driving shifts
    - Mid-trip cycle exhaustion triggering 34-hr restart between legs
"""
from trips.hos_calculator import calculate_schedule, MAX_DRIVING_HOURS


def _trip(**overrides):
    """Helper: default trip kwargs; override individual fields per test."""
    base = dict(
        current_location="Chicago, IL",
        pickup_location="Joliet, IL",
        dropoff_location="St. Louis, MO",
        current_to_pickup_miles=40.0,
        pickup_to_dropoff_miles=300.0,
        current_cycle_hours=0.0,
    )
    base.update(overrides)
    return base


# ─── 1. Happy path — totals invariant ────────────────────────────────────────

def test_short_trip_single_day_totals_sum_to_24():
    """cycle=0, ~340mi — completes in one day, totals sum to exactly 24:00."""
    days = calculate_schedule(**_trip())
    assert len(days) == 1
    total = sum(days[0]["totals"].values())
    assert abs(total - 24.0) < 0.01, f"Day totals should sum to 24.0, got {total}"


# ─── 2. FMCSA 11-hour driving limit per shift ────────────────────────────────

def test_no_day_exceeds_11_hour_driving():
    """Long multi-day trip — no calendar day exceeds 11 hours of driving."""
    days = calculate_schedule(**_trip(
        current_to_pickup_miles=400.0,
        pickup_to_dropoff_miles=1100.0,
        current_cycle_hours=20.0,
    ))
    assert len(days) >= 2
    for i, day in enumerate(days):
        driving = day["totals"]["driving"]
        assert driving <= MAX_DRIVING_HOURS + 0.01, (
            f"Day {i+1} drove {driving}h, exceeds {MAX_DRIVING_HOURS}h limit"
        )


# ─── 3. FMCSA 70-hour cycle + 34-hour restart ────────────────────────────────

def test_cycle_exhausted_triggers_initial_restart():
    """cycle=70 — calculator must insert a 34-hr restart before the first drive."""
    days = calculate_schedule(**_trip(current_cycle_hours=70.0))
    activities = [s["activity"] for day in days for s in day["segments"]]
    assert "34-hr restart" in activities, (
        "Expected '34-hr restart' segment when cycle is exhausted"
    )


# ─── 4. FMCSA 395.3 — 30-min break after 8 hours driving ─────────────────────

def test_30_min_break_after_8_hours_driving():
    """A trip requiring 8+ hours of pure driving must insert a 30-min break."""
    days = calculate_schedule(**_trip(
        current_to_pickup_miles=50.0,
        pickup_to_dropoff_miles=550.0,
    ))
    activities = [s["activity"] for day in days for s in day["segments"]]
    assert "30-min break" in activities, (
        "Expected '30-min break' after 8 hours of driving without a natural stop"
    )


# ─── 5. Day-page invariant — 0:00 → 24:00 continuous ─────────────────────────

def test_each_day_continuous_midnight_to_midnight():
    """Every calendar day's segments form an unbroken 0:00 → 24:00 timeline."""
    days = calculate_schedule(**_trip(
        current_to_pickup_miles=100.0,
        pickup_to_dropoff_miles=900.0,
    ))
    for d_idx, day in enumerate(days):
        segs = day["segments"]
        assert segs[0]["start_hour"] == 0.0, (
            f"Day {d_idx+1} first segment must start at 0:00, got {segs[0]['start_hour']}"
        )
        assert segs[-1]["end_hour"] == 24.0, (
            f"Day {d_idx+1} last segment must end at 24:00, got {segs[-1]['end_hour']}"
        )
        for i in range(len(segs) - 1):
            assert segs[i]["end_hour"] == segs[i + 1]["start_hour"], (
                f"Day {d_idx+1}: gap between segments {i} and {i+1} "
                f"({segs[i]['end_hour']} → {segs[i+1]['start_hour']})"
            )


# ─── 6. B3 regression — restart-day locations populated ──────────────────────

def test_restart_day_locations_populated():
    """B3 regression: 100%-sleeper restart days still have From/To populated."""
    days = calculate_schedule(**_trip(current_cycle_hours=70.0))
    assert days[0]["day_start_location"], (
        "Day 0 day_start_location must be populated even on restart day"
    )
    assert days[0]["day_end_location"], (
        "Day 0 day_end_location must be populated even on restart day"
    )


# ─── 7. B7 regression — quarter-hour rounding ────────────────────────────────

def test_all_segment_times_quarter_hour_aligned():
    """B7 regression: every segment start/end is a multiple of 0.25 hr."""
    # 19-mile leg → raw end at 6:50:42 — must snap to a quarter-hour boundary.
    days = calculate_schedule(**_trip(current_to_pickup_miles=19.0))
    for d_idx, day in enumerate(days):
        for s in day["segments"]:
            for field in ("start_hour", "end_hour"):
                quantized = round(s[field] * 4) / 4
                assert abs(s[field] - quantized) < 0.001, (
                    f"Day {d_idx+1} segment {s['activity']!r} {field}={s[field]} "
                    f"is not on a quarter-hour (expected {quantized})"
                )


# ─── 8. B1 regression — post-trip uses resolved dropoff ──────────────────────

def test_post_trip_location_matches_dropoff():
    """B1 regression: final Post-trip/TIV uses same location string as final Dropoff."""
    days = calculate_schedule(**_trip())
    brackets = [b for day in days for b in day["brackets"]]
    post_trips = [b for b in brackets if b["activity"] == "Post-trip/TIV"]
    dropoffs = [b for b in brackets if b["activity"] == "Dropoff"]
    assert post_trips, "Expected at least one Post-trip/TIV bracket"
    assert dropoffs, "Expected at least one Dropoff bracket"
    assert post_trips[-1]["location"] == dropoffs[-1]["location"], (
        f"Final post-trip location {post_trips[-1]['location']!r} "
        f"differs from dropoff {dropoffs[-1]['location']!r}"
    )
