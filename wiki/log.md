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

## [2026-05-09] decision | Never assume what a tool installs — always verify first
Before running any install command, check what the tool already installs automatically (e.g. `npx shadcn@latest add form` auto-installs react-hook-form + @hookform/resolvers). Assuming = duplicate deps, version conflicts, wasted time. Cross-question every step.

## [2026-05-09] decision | Log sheet UX — one day at a time, flip navigation
Show one log sheet at a time with prev/next chevrons, like a real log book. Horizontally scrollable on mobile (min-width 900px) with scroll hint. Paper-white background contrasts with dark app to feel like a real document.

## [2026-05-09] decision | Results screen layout confirmed
Order: back button → trip summary card → route map → log sheet (paginated). Max-width 2xl centered, mobile-first.

## [2026-05-09] build | Frontend scaffolded with React + Vite + TypeScript + Tailwind v4
Created frontend/ with Vite React-TS template. Tailwind v4 added via @tailwindcss/vite plugin (CSS-first, no config file). Tailwind import in index.css. Confirmed working. Ready to build TripForm, RouteMap, LogSheet components.

## [2026-05-09] build | Full frontend + backend wired end-to-end
TripForm → POST /api/trip/ → HOS calculator → ORS routing → JSON response. RouteMap (Leaflet), TripSummary, LogSheet (SVG) all rendering. Page-flip navigation for multi-day trips.

## [2026-05-09] decision | Log sheet remarks driven by brackets, not status changes
Each bracket (on-duty-not-driving period) = one diagonal remark label. City name above the line, activity below. Diagonal starts from bottom-left corner of bracket. Length proportional to text. Previously we were generating one remark per status change which was wrong.

## [2026-05-09] decision | Minor ticks drawn at every row boundary
Each row boundary (5 for 4 rows) gets inward ticks at :15/:45 (4px) and :30 (7px). Matches real ELD paper log ruler-edge style. Full-height lines through rows was wrong.

## [2026-05-09] build | Log sheet layout polish
Header date section: label row above, value+underline below with clear gap. Totals panel: 8px margin from grid, wider boxes (30px), named constants BOX_W/COLON_W. On-duty decimal circle: red (#dc2626), radius 19, font 13. All changes are rendering-only, no data logic touched.

## [2026-05-09] incident | Broken pipe — reverse geocode calls sequential, hit 10s timeout
Tested Roorkee → West Bengal → Chennai. Frontend dropped connection before backend finished.
Root cause: reverse geocode calls are sequential inside the calculator loop. 8-10 ORS calls × ~500ms each = 4-5s just for geocoding. Plus routing (~2-3s) + geocoding (1.5s) = 9-12s total. Frontend timeout is 10s.

Why we missed it: calculator is inherently sequential (each stop depends on previous), so the resolver felt natural inline. Missed that the reverse geocode calls are INDEPENDENT of each other — all positions are known after the calculator runs, they don't depend on each other.

Fix: two-phase approach.
  Phase 1 — calculator runs with a LocationCollector (no network). Stores placeholder keys instead of city names.
  Phase 2 — views.py collects all positions, deduplicates by coordinate, fires all reverse geocode calls in parallel via ThreadPoolExecutor. Replaces placeholder keys with real city names.
Result: 8 sequential calls (4s) → 8 parallel calls (~500ms). Total request drops from ~12s to ~5s.

Lesson: decouple data generation from data enrichment. The enrichment (geocoding) doesn't depend on prior enrichment results — only on the positions produced by Phase 1. Always ask: "are these calls independent of each other?" If yes, parallelize.

## [2026-05-09] build | All four HOS logic fixes implemented + committed

Change 1 — abs_hour: self.abs_hour added (monotonically increasing). window_start now stores abs_hour. Fixes 14-hr window calc breaking across midnight.

Change 2 — 70hr cycle cap: MAX_CYCLE_HOURS=70 enforced in _drive_leg. _restart_34hr() inserts 34hr sleeper and resets cycle. Early-exit check at top of loop + miles_to_cycle_limit in min() to prevent mid-chunk overshoot.

Change 3 — RouteGeoRef + reverse geocode: RouteGeoRef class does haversine interpolation along ORS LineString geometry. reverse_geocode() added to ors_client.py. resolve_location injected into TripScheduler (DI — calculator stays pure, no network calls). All intermediate stops (fuel, break, rest) now resolve to real city name.

Change 4 — day_start/end_location: DayLog gets day_start_location + day_end_location. Captured in _add_driving before/after cumulative_miles update. Exposed in to_dict(). trip.ts and LogSheet.tsx updated — From/To header now shows real per-day positions.

## [2026-05-09] decision | Full cross-check: HOS logic vs assessment + FMCSA research
Four bugs confirmed. Two new (found this session): (1) 70-hour cycle limit never enforced in _drive_leg — driver can exceed 70hrs with no stop; fix = add cycle check + 34-hr restart. (2) 14-hr window calc breaks across midnight — window_start stays on previous day's scale when self.hour resets to 0; fix = add abs_hour (monotonically increasing) for all limit math. Two known bugs carry forward (stop city = wrong, From/To = wrong). Also confirmed correct: 30-min break logic, midnight splitting, pickup/dropoff on-duty, end-of-day sequence. Edge cases decided against: adverse driving (assessment says no), short-haul exemption (N/A), split break (not needed). All wiki pages updated: hos-calculator.md, architecture.md, api-research.md, log-sheet-renderer.md.

## [2026-05-09] decision | HOS calculator location-awareness plan
Diagnosed root cause of all stops showing same city: calculator is time/mile only, no geo awareness. `from_loc` (leg start city) is used for every mid-leg stop. Fix: add RouteGeoRef class, pass ORS geometry to scheduler, interpolate position at each stop's cumulative miles, reverse geocode to get city name. Also: DayLog needs day_start_location / day_end_location for log sheet From/To header. Miles-per-day showing same value is NOT a bug (605 = 11hr × 55mph daily cap). Wiki updated.

## [2026-05-09] build | Log sheet SVG layout finalized
Grid, header, totals panel (HH:MM boxes + column headers + footer), minor ticks, bracket-driven diagonal remarks, and on-duty red circle all polished and committed. Layout considered done — remaining work is logic correctness (stops locations, miles per day, etc.).

## [2026-05-09] test | End-to-end live test passed — 34hr restart confirmed working
Tested with Roorkee → West Bengal → Chennai, cycle_hours=66. App returned correct response: 34-hr restart triggered when cycle hit 70hrs, then journey continued. No broken pipe. Parallel geocoding fix (LocationCollector + ThreadPoolExecutor) resolved the 10s timeout issue. All four logic fixes confirmed working in production. App considered feature-complete for V1 assessment submission.

## [2026-05-09] build | TypeScript strict mode + single source of truth
Added strict: true to tsconfig.app.json. Fixed 3 real bugs surfaced: Zod v4 invalid_type_error→error, z.coerce.number() input/output type split, erasableSyntaxOnly parameter property. Added npm run typecheck = tsc -b as canonical check. Bare tsc --noEmit silently checks nothing in Vite reference projects.
