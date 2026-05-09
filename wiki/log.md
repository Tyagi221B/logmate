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

## [2026-05-09] build | TypeScript strict mode + single source of truth
Added strict: true to tsconfig.app.json. Fixed 3 real bugs surfaced: Zod v4 invalid_type_error→error, z.coerce.number() input/output type split, erasableSyntaxOnly parameter property. Added npm run typecheck = tsc -b as canonical check. Bare tsc --noEmit silently checks nothing in Vite reference projects.
