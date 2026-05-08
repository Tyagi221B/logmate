# Activity Log

## [2026-05-08] ingest | Assessment requirements from Spotter AI
Extracted requirements from docx. Inputs: current location, pickup, dropoff, cycle hours used. Outputs: map + ELD log sheets. Stack: Django + React.

## [2026-05-08] ingest | HOS rules (70hr/8-day property carrier)
Documented all key limits: 11hr driving, 14hr window, 30min break after 8hrs, 10hr rest, 70hr/8-day rolling cap.

## [2026-05-08] ingest | Log sheet format from blank-paper-log.png + YouTube tutorial
Documented grid structure: 4 rows, 24hr x-axis, 15-min ticks. Status change = dot + vertical drop. Remarks required at each change.

## [2026-05-08] decision | Package manager = uv (not pip)
User prefers uv for all Python package management. Creates venv, installs deps. Never use bare pip.

## [2026-05-08] build | Wiki + project structure scaffolded
Created raw/, wiki/, backend/, frontend/ dirs. CLAUDE.md schema written. All raw source docs ingested.

## [2026-05-09] ingest | FMCSR 395.3 — 30-min break confirmed
Break can be Off Duty, Sleeper, OR On Duty not driving. Pickup/fuel/pre-trip all reset the 8-hr driving clock.

## [2026-05-09] ingest | Log sheet structure fully confirmed from video
Line always starts at midnight. Red dots at status changes. Brackets on Row 3 for stationary periods. End of day = On Duty → Off Duty → Sleeper. Rest splits across midnight.

## [2026-05-09] decision | Unconfirmed items deferred
Recap section format, circled decimal position, From/To = day-level. Will confirm when rendering.

## [2026-05-09] decision | V1 goal = ship first, optimize later
No auth, no saved trips, no over-engineering. Core flow only: form → route → log sheets. Hosted and working.

## [2026-05-09] ingest | Log sheet totals format from video screenshots
Totals are HH:MM in separate boxes, must sum to 24:00. Grid is 15-min increments. Total on-duty shown as decimal (e.g. 10.5) for HOS recap.
