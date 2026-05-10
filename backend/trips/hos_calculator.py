from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date, timedelta
from math import atan2, cos, radians, sin, sqrt
from typing import Literal

# HOS constants — 70hr/8-day property carrier (all confirmed)
MAX_DRIVING_HOURS = 11.0
MAX_WINDOW_HOURS = 14.0
MAX_CYCLE_HOURS = 70.0
RESTART_DURATION = 34.0
BREAK_TRIGGER_HOURS = 8.0
BREAK_DURATION = 0.5
REST_DURATION = 10.0
FUEL_INTERVAL_MILES = 1000.0
FUEL_DURATION = 0.5        # On Duty
PICKUP_DURATION = 1.0      # On Duty
DROPOFF_DURATION = 1.0     # On Duty
PRETRIP_DURATION = 0.5     # On Duty
POSTTRIP_DURATION = 0.5    # On Duty
END_OF_DAY_OFFDUTY = 1.0   # Off Duty after post-trip before sleeper
AVG_SPEED_MPH = 55.0

DutyStatus = Literal["off_duty", "sleeper", "driving", "on_duty"]


class RouteGeoRef:
    """Maps cumulative trip miles → (lat, lng) by walking ORS route geometry."""

    def __init__(self, coordinates: list[list[float]], total_miles: float) -> None:
        # coordinates = [[lng, lat], ...] — ORS GeoJSON order
        self.coords = coordinates
        self.cum_dist: list[float] = [0.0]
        for i in range(1, len(coordinates)):
            self.cum_dist.append(
                self.cum_dist[-1] + self._haversine(coordinates[i - 1], coordinates[i])
            )
        geo_total = self.cum_dist[-1]
        # Scale factor: reported ORS miles vs our haversine miles (usually close to 1.0)
        self.scale = total_miles / geo_total if geo_total > 0 else 1.0

    @staticmethod
    def _haversine(a: list[float], b: list[float]) -> float:
        R = 3958.8  # Earth radius in miles
        lat1, lon1 = radians(a[1]), radians(a[0])
        lat2, lon2 = radians(b[1]), radians(b[0])
        dlat, dlon = lat2 - lat1, lon2 - lon1
        h = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
        return R * 2 * atan2(sqrt(h), sqrt(1 - h))

    def interpolate(self, miles: float) -> tuple[float, float]:
        """Return (lat, lng) at the given cumulative miles from trip start."""
        target = min(miles / self.scale, self.cum_dist[-1]) if self.scale > 0 else 0.0
        for i in range(1, len(self.cum_dist)):
            if self.cum_dist[i] >= target:
                seg_len = self.cum_dist[i] - self.cum_dist[i - 1]
                t = (target - self.cum_dist[i - 1]) / seg_len if seg_len > 0 else 0.0
                lng = self.coords[i - 1][0] + t * (self.coords[i][0] - self.coords[i - 1][0])
                lat = self.coords[i - 1][1] + t * (self.coords[i][1] - self.coords[i - 1][1])
                return lat, lng
        # Past end of route — return last point
        return self.coords[-1][1], self.coords[-1][0]

STATIONARY_ACTIVITIES = {"Pre-trip/TIV", "Post-trip/TIV", "Pickup", "Dropoff", "Fueling", "30-min break"}


@dataclass
class Segment:
    status: DutyStatus
    start_hour: float
    end_hour: float
    location: str
    activity: str

    @property
    def duration(self) -> float:
        return round(self.end_hour - self.start_hour, 6)


@dataclass
class DayLog:
    date_str: str
    date_offset: int
    segments: list[Segment] = field(default_factory=list)
    brackets: list[dict] = field(default_factory=list)
    driving_miles: float = 0.0
    day_start_location: str = ""   # city where driving began this calendar day
    day_end_location: str = ""     # city where driving ended this calendar day

    def add_segment(self, seg: Segment):
        self.segments.append(seg)
        if seg.activity in STATIONARY_ACTIVITIES:
            self.brackets.append({
                "start_hour": seg.start_hour,
                "end_hour": seg.end_hour,
                "location": seg.location,
                "activity": seg.activity,
            })

    @property
    def totals(self) -> dict:
        t = {"off_duty": 0.0, "sleeper": 0.0, "driving": 0.0, "on_duty": 0.0}
        for seg in self.segments:
            t[seg.status] = round(t[seg.status] + seg.duration, 6)
        return {k: round(v, 2) for k, v in t.items()}

    @property
    def on_duty_decimal(self) -> float:
        t = self.totals
        return round(t["driving"] + t["on_duty"], 2)

    def to_dict(self) -> dict:
        return {
            "date": self.date_str,
            "date_offset": self.date_offset,
            "segments": [
                {
                    "status": s.status,
                    "start_hour": round(s.start_hour, 4),
                    "end_hour": round(s.end_hour, 4),
                    "location": s.location,
                    "activity": s.activity,
                }
                for s in self.segments
            ],
            "brackets": self.brackets,
            "totals": self.totals,
            "on_duty_decimal": self.on_duty_decimal,
            "driving_miles_today": round(self.driving_miles, 1),
            "day_start_location": self.day_start_location,
            "day_end_location": self.day_end_location,
        }


class TripScheduler:
    def __init__(
        self,
        current_location: str,
        pickup_location: str,
        dropoff_location: str,
        leg1_miles: float,
        leg2_miles: float,
        cycle_hours_used: float,
        start_date: date,
        geo_ref: RouteGeoRef | None = None,
        resolve_location: Callable[[float, float], str] | None = None,
    ):
        self.locations = {
            "current": current_location,
            "pickup": pickup_location,
            "dropoff": dropoff_location,
        }
        self.leg1_miles = leg1_miles
        self.leg2_miles = leg2_miles
        self.start_date = start_date
        self.geo_ref = geo_ref
        self._resolve = resolve_location

        # Driver state
        self.cycle_hours = cycle_hours_used
        self.driving_today = 0.0
        self.driving_since_break = 0.0
        self.window_start = 0.0       # abs_hour when current 14-hr window started
        self.miles_since_fuel = 0.0
        self.cumulative_miles = 0.0   # total miles driven from trip start

        # Current position in time
        self.day_idx = 0
        self.hour = 0.0               # 0-24, grid position only — resets at midnight
        self.abs_hour = 0.0           # monotonically increasing, never resets — use for all limit math

        # Days list
        self.days: list[DayLog] = []
        self._new_day()

        # First day: driver was sleeping midnight → 6:00 AM
        self._add("sleeper", 6.0, current_location, "Sleeping")
        self.hour = 6.0

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _new_day(self):
        d = self.start_date + timedelta(days=self.day_idx)
        self.days.append(DayLog(
            date_str=d.strftime("%m/%d/%Y"),
            date_offset=self.day_idx,
        ))

    @property
    def _day(self) -> DayLog:
        return self.days[self.day_idx]

    def _add(self, status: DutyStatus, duration: float, location: str, activity: str):
        """Add a segment, splitting at midnight if needed."""
        if duration <= 0:
            return

        remaining = duration
        while remaining > 0.0001:
            hours_to_midnight = round(24.0 - self.hour, 6)

            if remaining <= hours_to_midnight + 0.0001:
                # Fits in current day
                seg = Segment(status, self.hour, round(self.hour + remaining, 6), location, activity)
                self._day.add_segment(seg)
                self.hour = seg.end_hour
                remaining = 0.0
            else:
                # Crosses midnight — fill to midnight then start new page
                if hours_to_midnight > 0.0001:
                    seg = Segment(status, self.hour, 24.0, location, activity)
                    self._day.add_segment(seg)

                # Start new day
                self.day_idx += 1
                self._new_day()
                self.hour = 0.0
                remaining = round(remaining - hours_to_midnight, 6)

        # Track on-duty/driving hours
        if status in ("on_duty", "driving"):
            self.cycle_hours = round(self.cycle_hours + duration, 6)
        if status == "driving":
            self.driving_today = round(self.driving_today + duration, 6)
            self.driving_since_break = round(self.driving_since_break + duration, 6)

        # Reset break clock if non-driving ≥ 30 min
        if status != "driving" and duration >= BREAK_DURATION:
            self.driving_since_break = 0.0

        self.abs_hour = round(self.abs_hour + duration, 6)

    def _add_on_duty(self, duration: float, location: str, activity: str):
        self._add("on_duty", duration, location, activity)

    def _add_driving(self, duration: float, from_loc: str, to_loc: str):
        miles = duration * AVG_SPEED_MPH

        # Capture day_start_location before moving (position at drive start)
        if not self._day.day_start_location:
            self._day.day_start_location = self._loc_at_current_miles() or from_loc

        self._day.driving_miles = round(self._day.driving_miles + miles, 1)
        self.cumulative_miles = round(self.cumulative_miles + miles, 2)
        self._add("driving", duration, f"{from_loc} → {to_loc}", "Driving")

        # Update day_end_location after moving (position at drive end)
        self._day.day_end_location = self._loc_at_current_miles() or to_loc

    def _loc_at_current_miles(self) -> str:
        """Resolve current geographic position to a city string. Returns '' if geo unavailable."""
        if self.geo_ref is None or self._resolve is None:
            return ""
        lat, lng = self.geo_ref.interpolate(self.cumulative_miles)
        return self._resolve(lat, lng)

    def _restart_34hr(self, location: str):
        """34-hour off-duty restart — resets the 8-day cycle window to zero."""
        self._add("sleeper", 34.0, location, "34-hr restart")
        self.cycle_hours = 0.0
        self.driving_today = 0.0
        self.driving_since_break = 0.0
        self.window_start = self.abs_hour

    def _rest(self, location: str):
        """10-hour rest: post-trip → off-duty → sleeper (splits across midnight if needed)."""
        self._add_on_duty(POSTTRIP_DURATION, location, "Post-trip/TIV")
        self._add("off_duty", END_OF_DAY_OFFDUTY, location, "Off duty")
        sleeper_needed = REST_DURATION - END_OF_DAY_OFFDUTY - POSTTRIP_DURATION
        self._add("sleeper", sleeper_needed, location, "Sleeping")

        # Reset shift counters
        self.driving_today = 0.0
        self.driving_since_break = 0.0
        self.window_start = self.abs_hour

    def _drive_leg(self, total_miles: float, from_loc: str, to_loc: str):
        """Drive a full leg, inserting breaks/fuel/rests as needed."""
        remaining_miles = total_miles

        while remaining_miles > 0.1:
            # Cycle limit check first — before any other computation
            if self.cycle_hours >= MAX_CYCLE_HOURS - 0.01:
                stop_loc = self._loc_at_current_miles() or from_loc
                self._restart_34hr(stop_loc)
                self._add_on_duty(PRETRIP_DURATION, stop_loc, "Pre-trip/TIV")
                continue

            # How many miles until each limit?
            miles_to_fuel = FUEL_INTERVAL_MILES - self.miles_since_fuel
            miles_to_break = (BREAK_TRIGGER_HOURS - self.driving_since_break) * AVG_SPEED_MPH
            miles_to_drive_limit = (MAX_DRIVING_HOURS - self.driving_today) * AVG_SPEED_MPH
            hours_in_window = (self.window_start + MAX_WINDOW_HOURS) - self.abs_hour
            miles_to_window = hours_in_window * AVG_SPEED_MPH
            hours_to_midnight = 24.0 - self.hour
            miles_to_midnight = hours_to_midnight * AVG_SPEED_MPH
            # Conservative: treat all remaining cycle hours as drivable
            miles_to_cycle_limit = max(MAX_CYCLE_HOURS - self.cycle_hours, 0.0) * AVG_SPEED_MPH

            # Can't drive at all — must rest first
            if miles_to_drive_limit <= 0.1 or hours_in_window <= 0.01:
                stop_loc = self._loc_at_current_miles() or from_loc
                self._rest(stop_loc)
                self._add_on_duty(PRETRIP_DURATION, stop_loc, "Pre-trip/TIV")
                continue

            # How far can we go before something happens?
            drive_miles = min(
                remaining_miles,
                max(miles_to_fuel, 0.1),
                max(miles_to_break, 0.1),
                max(miles_to_drive_limit, 0.1),
                max(miles_to_window, 0.1),
                max(miles_to_midnight, 0.1),
                max(miles_to_cycle_limit, 0.1),
            )
            drive_miles = max(drive_miles, 0.1)
            drive_hours = drive_miles / AVG_SPEED_MPH

            self._add_driving(drive_hours, from_loc, to_loc)
            self.miles_since_fuel = round(self.miles_since_fuel + drive_miles, 2)
            remaining_miles = round(remaining_miles - drive_miles, 2)

            if remaining_miles <= 0.1:
                break

            # Resolve stop location once — used by whichever condition triggered
            stop_loc = self._loc_at_current_miles() or from_loc

            # Handle what triggered the stop
            if self.miles_since_fuel >= FUEL_INTERVAL_MILES - 0.1:
                self._add_on_duty(FUEL_DURATION, stop_loc, "Fueling")
                self.miles_since_fuel = 0.0

            elif self.driving_since_break >= BREAK_TRIGGER_HOURS - 0.01:
                self._add("off_duty", BREAK_DURATION, stop_loc, "30-min break")

            elif self.driving_today >= MAX_DRIVING_HOURS - 0.01:
                self._rest(stop_loc)
                self._add_on_duty(PRETRIP_DURATION, stop_loc, "Pre-trip/TIV")

            elif hours_in_window <= 0.01:
                self._rest(stop_loc)
                self._add_on_duty(PRETRIP_DURATION, stop_loc, "Pre-trip/TIV")

            elif self.hour >= 23.99:
                # Hit midnight while driving — new page continues same status
                pass

    def _fill_day(self, location: str):
        """Fill remaining hours of current day page as sleeper."""
        remaining = round(24.0 - self.hour, 6)
        if remaining > 0.0001:
            self._add("sleeper", remaining, location, "Sleeping")

    # ------------------------------------------------------------------
    # Main entry point
    # ------------------------------------------------------------------

    def run(self) -> list[dict]:
        current = self.locations["current"]
        pickup = self.locations["pickup"]
        dropoff = self.locations["dropoff"]

        # If cycle is exhausted, driver cannot do pre-trip — restart first
        if self.cycle_hours >= MAX_CYCLE_HOURS - PRETRIP_DURATION:
            restart_loc = self._loc_at_current_miles() or current
            self._restart_34hr(restart_loc)

        # Pre-trip inspection — 14-hr window starts now
        self.window_start = self.abs_hour
        start_loc = self._loc_at_current_miles() or current
        self._add_on_duty(PRETRIP_DURATION, start_loc, "Pre-trip/TIV")

        # Leg 1: current → pickup
        self._drive_leg(self.leg1_miles, current, pickup)

        # Pickup
        pickup_loc = self._loc_at_current_miles() or pickup
        self._add_on_duty(PICKUP_DURATION, pickup_loc, "Pickup")

        # Leg 2: pickup → dropoff
        self._drive_leg(self.leg2_miles, pickup, dropoff)

        # Dropoff
        dropoff_loc = self._loc_at_current_miles() or dropoff
        self._add_on_duty(DROPOFF_DURATION, dropoff_loc, "Dropoff")

        # End of trip — post-trip + rest
        self._add_on_duty(POSTTRIP_DURATION, dropoff_loc, "Post-trip/TIV")
        self._add("off_duty", END_OF_DAY_OFFDUTY, dropoff_loc, "Off duty")

        # Fill remaining day
        self._fill_day(dropoff_loc)

        return [d.to_dict() for d in self.days]


def calculate_schedule(
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
    current_to_pickup_miles: float,
    pickup_to_dropoff_miles: float,
    current_cycle_hours: float,
    geo_ref: RouteGeoRef | None = None,
    resolve_location: Callable[[float, float], str] | None = None,
) -> list[dict]:
    scheduler = TripScheduler(
        current_location=current_location,
        pickup_location=pickup_location,
        dropoff_location=dropoff_location,
        leg1_miles=current_to_pickup_miles,
        leg2_miles=pickup_to_dropoff_miles,
        cycle_hours_used=current_cycle_hours,
        start_date=date.today(),
        geo_ref=geo_ref,
        resolve_location=resolve_location,
    )
    return scheduler.run()
