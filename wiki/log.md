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

## [2026-05-09] build | Fix autocomplete labels + Home Terminal Address

autocomplete(): build label from properties instead of using ORS label field (which uses abbreviated region codes for all countries). Same USA/non-USA logic as reverse_geocode: region_a for USA, full region for others. Format: "City, State, Country". Result: "Roorkee, Uttarakhand, India" instead of "Roorkee, UT, India".

Home Terminal Address on log sheet: was showing raw user input string. Now uses days[0].day_start_location (already reverse geocoded) with raw label as fallback.

Leading-edge debounce confirmed working — first suggestion fires immediately on reaching 3 chars, no 300ms wait. Users noticed it feels significantly faster.

## [2026-05-09] build | Location autocomplete + map legend

Autocomplete: new GET /api/autocomplete/?q= endpoint proxies ORS /geocode/autocomplete. layers=locality only (no states — state centroids break HGV routing, confirmed by testing "Gujarat, India"). LocationInput component with leading-edge debounce (fires immediately on first query, 300ms after), in-memory cache via useRef Map (~55% hit rate in practice). Keyboard nav (arrow/enter/escape), blur delay 150ms so click registers before close.

Map legend: C/P/D marker icons explained in a row below the map with matching colors. Previously users had no way to know what the letters meant.

Lessons: (1) never expose API keys from frontend — backend proxy is the only option, not a choice; (2) restrict autocomplete layers to locality — states are not routable destinations for HGV.

## [2026-05-09] build | Proper error handling implemented across full stack

Custom exceptions in ors_client.py: LocationNotFoundError, RoutingError, RateLimitError, ServiceUnavailableError. views.py catches specific exceptions, returns correct HTTP codes (422/429/503). api.ts: 422 passes through clean backend message, 400 reverts to generic (DRF field errors). No internal URLs or raw library exceptions ever reach the user. Tested: bad location → "Location not found: 'sdadfafa'...", bad route → "Could not calculate a route...", both clean.

## [2026-05-09] incident | Broken error handling — raw internal URLs exposed to user

**What happened:** Tested with "allas, TX" (typo). Error shown: "Routing failed: 404 Client Error: Not Found for url: https://api.openrouteservice.org/v2/directions/driving-hgv/geojson". Internal ORS URL leaked to the user.

**Root cause — two layers of wrong:**
1. Backend: both geocoding and routing failures caught as bare `Exception`, both returned 400, both used `str(e)` which dumps raw `requests` library exception strings including internal URLs.
2. Frontend: attempted fix passed through `err.message` for all 400s without first checking what the backend 400 message actually looked like. Made it worse.

**Why we didn't catch it before:** We never tested the error path. Happy path worked, so we shipped. Never asked "what does the user see when something goes wrong?"

**What the correct approach is:**
- Read ALL affected files before touching anything (we fixed frontend without reading backend error format)
- Never use `str(e)` from a third-party library — always wrap in custom exceptions with clean messages
- Use correct HTTP semantics: 422 for bad user input, 429 for rate limit, 503 for upstream down, 400 only for form validation
- Trace every error scenario end-to-end on paper before writing code

**Fix planned:**
- `ors_client.py`: define 4 custom exceptions (`LocationNotFoundError`, `RoutingError`, `RateLimitError`, `ServiceUnavailableError`), raise them with clean messages
- `views.py`: catch specific exceptions, return correct status codes
- `api.ts`: 400 → generic fallback (DRF field errors), 422 → pass through clean backend message

## [2026-05-09] test | End-to-end live test passed — 34hr restart confirmed working
Tested with Roorkee → West Bengal → Chennai, cycle_hours=66. App returned correct response: 34-hr restart triggered when cycle hit 70hrs, then journey continued. No broken pipe. Parallel geocoding fix (LocationCollector + ThreadPoolExecutor) resolved the 10s timeout issue. All four logic fixes confirmed working in production. App considered feature-complete for V1 assessment submission.

## [2026-05-09] decision | Future improvement: real-time progress via SSE
Trip planning takes ~5s. Current UX is a plain spinner — no feedback on what's happening. Backend has 4 distinct phases: geocode locations → fetch ORS route → run HOS calculator → parallel reverse geocode stops. Two options evaluated:
- Option A (shipped): fake step labels cycling on timers (~1.2s/~2.8s/~4s breakpoints). Zero backend changes, makes wait feel meaningful.
- Option B (not shipped): Server-Sent Events — backend emits real progress events per phase, frontend updates in real time. Accurate but requires replacing POST with SSE stream. Worth doing if request time grows or UX polish is prioritised post-V1.

## [2026-05-09] build | TypeScript strict mode + single source of truth
Added strict: true to tsconfig.app.json. Fixed 3 real bugs surfaced: Zod v4 invalid_type_error→error, z.coerce.number() input/output type split, erasableSyntaxOnly parameter property. Added npm run typecheck = tsc -b as canonical check. Bare tsc --noEmit silently checks nothing in Vite reference projects.

## [2026-05-09] incident | Dropdown selection broken — uncontrolled-to-controlled transition
LocationInput dropdown worked for typing but selecting a suggestion did nothing. Root cause: useForm called without explicit defaultValues for location fields → field.value = undefined on first render → Base UI's useControlled marks input as uncontrolled. When handleSelect called field.onChange(label), value went from undefined to string → Base UI threw error and broke the click handler. Fix: seed defaultValues with { current_location: '', pickup_location: '', dropoff_location: '' } so inputs are always controlled from first render.

## [2026-05-09] build | Autocomplete request cancellation
Added AbortController to useLocationAutocomplete. Previous in-flight request is aborted before firing a new one. fetchAutocomplete now accepts optional AbortSignal. Combined with existing stale-response guard (lastFired ref), two layers of protection: network request cancelled + stale response discarded. Verified appleboy/ssh-action v1.2.5 (not v1.0.3) and uv full path (/root/.local/bin/uv) required in non-interactive SSH sessions.

## [2026-05-09] build | Step-based loading screen
Replaced plain spinner with 4-step progress screen: "Geocoding locations → Calculating route → Building HOS schedule → Resolving stop locations". Steps advance on timers (1.2s / 2.8s / 4.0s) matching actual backend phases. LoadingScreen component in App.tsx. Form no longer shows during loading — clean separation of states.

## [2026-05-09] build | Backend deployed to DigitalOcean
Server: Ubuntu 24.04, $6/mo, BLR1, IP 206.189.133.119. Stack: uv venv + gunicorn (3 workers, unix socket) + nginx + Let's Encrypt SSL. Domain: api.asmittyagi.com (Cloudflare A record, DNS only — not proxied). Certbot auto-renewal configured. gunicorn runs as systemd service, auto-starts on reboot.

## [2026-05-09] build | Frontend deployed to Vercel
Domain: logmate.asmittyagi.com. Root directory set to frontend/ so Vercel only sees the Vite app. VITE_API_URL=https://api.asmittyagi.com set as env var. Vercel auto-added CNAME to Cloudflare. Auto-deploys on every push to main.

## [2026-05-09] build | CORS fix — production frontend was blocked
CORS_ALLOWED_ORIGINS in settings.py only had localhost origins. Added https://logmate.asmittyagi.com. Without this, browser blocked all API calls from production frontend (mixed content + CORS). Pushed and pulled on server, restarted gunicorn.

## [2026-05-09] build | GitHub Actions CI/CD for backend
.github/workflows/deploy-backend.yml: triggers on push to backend/** only (frontend changes handled by Vercel). SSHes into server using SSH_PRIVATE_KEY secret, git pulls, installs deps via uv, runs migrations, restarts gunicorn. Uses appleboy/ssh-action@v1.2.5. uv called via full path /root/.local/bin/uv (not in PATH in non-interactive SSH sessions). Verified working with health endpoint commit.

## [2026-05-09] build | Health check endpoint
Added GET /api/health/ → {"status": "ok", "version": "1.0.0"}. Used to verify backend is responding after deploys. Also served as first CI/CD pipeline test.

## [2026-05-09] build | GitHub repo published
Public repo: github.com/Tyagi221B/logmate. Includes backend/, frontend/, wiki/, raw/, CLAUDE.md. No secrets committed. wiki/ included intentionally — shows systematic thinking and AI fluency (both valued in the JD). .gitignore covers .env, *.env.local, .venv/, node_modules/, db.sqlite3.

## [2026-05-10] incident | Two bugs found via cycle_hours=70 audit

Bug 1 — hos_calculator.py: pre-trip inspection was added before the cycle limit check in run(). At cycle_hours=70, pre-trip pushed cycle to 70.5 (illegal — FMCSA 49 CFR §395.3 prohibits ANY on-duty activity after 70hrs). Fix: added cycle check before pre-trip in run(). Threshold = MAX_CYCLE_HOURS - PRETRIP_DURATION = 69.5 — covers all cases where pre-trip would push driver to/over 70hrs.

Bug 2 — TripSummary.tsx: cycleAfter calculation used cycleHoursUsed (e.g. 70) as the base even after a 34hr restart reset cycle to 0. "Cycle Remaining" showed 0:00 instead of the correct ~59hrs. Fix: detect initial restart from days[0] segments (activity === "34-hr restart"), use 0 as effectiveCycleStart if restart found.

UI addition: amber warning notice in TripSummary when initial restart detected — "A 34-hr restart was required before this trip — your cycle hours were exhausted."

## [2026-05-10] decision | Systematic audit process confirmed
Full audit before fix: read all affected files, trace execution path line by line, verify against FMCSA source (49 CFR §395.3), write HLD + LLD before touching code. Found second bug (frontend cycleAfter) during UI/UX cross-check that would have been missed with a narrow fix.

## [2026-05-10] build | Fix B1 — post-trip log uses resolved city, not raw input
hos_calculator.py:392-396: post-trip, off-duty, and fill_day segments at end of run() were using the raw user-typed `dropoff` string while the Pickup/Dropoff segments above used the resolved `dropoff_loc`. Visible symptom: Dropoff bracket showed "Surat, Gujarat" while Post-trip/TIV bracket directly next to it showed "Surat, Gujarat, India" — same city, two different formats, on the same log sheet. Fix: replace `dropoff` with `dropoff_loc` on lines 392, 393, 396. Verified in browser with Mumbai trip: all three diagonals on final-day sheet now show consistent "Mumbai, Maharashtra" format.

## [2026-05-10] research | FMCSA 49 CFR 395.8 — From/To NOT regulated, vendor convention only
Web-searched primary sources before fixing B3. Key finding: 49 CFR 395.8(d) lists 11 required RODS fields — From/To is NOT among them. The regulation only requires location at every duty status change (our REMARKS / brackets / diagonals). From/To are vendor-added fields on most blank paper forms (JJ Keller, Schneider, etc.) with no FMCSA-mandated semantics. Driver-community convention: From = day's driving start city, To = day's furthest point / driving end city. For non-driving days no firm convention — most drivers write the stationary parked city. This validates our day-level interpretation (locked in 2026-05-09 wiki decision) and the B3 fix approach (seed parked city for restart days). Sources: ecfr.io/Title-49/Section-395.8, law.cornell.edu/cfr/text/49/395.8, thetruckersreport.com/how-to-fill-out-a-truck-driver-log-book.

## [2026-05-10] build | Fix B3 — restart-day From / To / Home Terminal show resolved city
Bug: when cycle_hours=70 triggers an initial 34-hr restart, Day 0 is a 100% sleeper-berth day with no `_add_driving` call. `day_start_location` and `day_end_location` stayed empty (only ever set inside `_add_driving`). Frontend fallback chain in LogSheet.tsx + App.tsx then displayed the raw user-typed input ("Roorkee, Uttarakhand, India") on Day 0's From/To AND on Home Terminal Address across all pages — while Days 1+ correctly showed the resolved "Roorkee, Uttarakhand". Visible inconsistency on every restart-triggered trip.

Fix in hos_calculator.py:
1. `_new_day()` now seeds `day.day_start_location` and seals `prev.day_end_location` from `_loc_at_current_miles()` at the moment of midnight crossing. Safe because `_drive_leg`'s `miles_to_midnight` clamp keeps `cumulative_miles` stable at the cross — load-bearing dependency, documented inline.
2. `__init__` explicitly seeds `days[0].day_start_location` right after first `_new_day()` (since `_new_day`'s seeding only runs for days[1:]).

Fallback chain: `_loc_at_current_miles()` (resolved placeholder) → `prev.day_end_location` → `prev.day_start_location` → `current_location` (raw). Empty only if all three resolve to "" (test mode without geo_ref).

Bonus: Home Terminal Address auto-fixes too, since it derives from `days[0].day_start_location` via App.tsx:172 → LogSheet.tsx:141. Three UI fixes from one backend change.

Verified live with cycle=70 Roorkee → Mumbai → Surat trip: all 4 days now show consistent `City, State` format on From, To, and Home Terminal Address fields. cycle=0 path unchanged (the new pre-seed produces the same value `_add_driving` would have set; existing guard at line 242 makes it a no-op).

## [2026-05-11] build | Display rounding to 15-minute increments (FMCSA paper-log convention)
Bug surfaced via cycle=4 Roorkee → Hardwar → Kolkata test: Hardwar is only ~19 miles from Roorkee, drive completes at `6:30 + 19/55 hr ≈ 6:50:42`. Result: status-change dots landed between the 6:45 and 7:00 tick marks, and Day 2 totals showed `14:18` sleeper / `06:42` driving — fractional minutes that real paper logs never display ("MINUTES TO BE 00, 15, 30, 45" per the form header).

Fix in `hos_calculator.py`:
1. Added module-level constant `DISPLAY_ROUND_TO_QUARTER_HOUR = True` and helper `_round_for_display(h)` that quantizes to nearest 0.25 hr.
2. Refactored `DayLog.to_dict()` to round segment start/end, bracket start/end, totals (recomputed from rounded durations for consistency), and `on_duty_decimal`. Zero-duration segments after rounding are filtered out — cleanly handles the tiny floating-point slivers that `_drive_leg`'s `min(..., 0.1)` clamps can produce at limit boundaries.

Invariants preserved: first segment starts at 0.0, last ends at 24.0 (both round to themselves), adjacent boundaries share values so rounding both ends produces identical results, total always sums to 24:00.

Internal scheduler math (cycle hours, 14-hour window, 8-hour break clock) reads from `self.abs_hour` / `self.cycle_hours` directly — never from rounded `to_dict()` output. Flipping the toggle to `False` exposes raw floating-point precision without affecting scheduling correctness, useful for debugging.

Side benefit: B2 (0.1-mile sliver segments under FP edge cases) is implicitly resolved — slivers collapse to zero duration after rounding and are filtered out.
