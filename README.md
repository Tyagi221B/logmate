# LogMate — ELD Trip Planner

A full-stack Hours-of-Service trip planner for property-carrying drivers. Given a current location, pickup, dropoff, and cycle hours used, the app produces an FMCSA-compliant schedule with a route map and one Driver's Daily Log sheet per calendar day.

| | |
|---|---|
| **Live app** | [logmate.asmittyagi.com](https://logmate.asmittyagi.com) |
| **API** | [api.asmittyagi.com](https://api.asmittyagi.com) |
| **Repo** | [github.com/Tyagi221B/logmate](https://github.com/Tyagi221B/logmate) |

---

## What it does

The driver provides four inputs:

| Input | Example |
|---|---|
| Current location | `Chicago, IL` |
| Pickup location | `St. Louis, MO` |
| Dropoff location | `Dallas, TX` |
| Cycle hours used (last 8 days) | `20` |

The app returns:

1. A route map (Leaflet) with markers for current, pickup, and dropoff.
2. One Driver's Daily Log sheet per calendar day — rendered as paper-grade SVG, filled out with every duty-status transition, totals panel, and diagonal remarks.

The scheduler enforces FMCSA 70-hour / 8-day property-carrier rules:

- 11-hour driving limit per shift
- 14-hour on-duty window from first on-duty moment
- 30-minute break required after 8 hours of consecutive driving (FMCSR §395.3)
- 10-hour off-duty rest between shifts (sleeper + off-duty combined)
- 70-hour rolling 8-day cycle cap
- 34-hour restart inserted automatically when the cycle is exhausted

Fixed assumptions per the spec: 1 hour for pickup, 1 hour for dropoff, 30 minutes of fueling every 1,000 miles, 30 minutes for pre-trip / post-trip inspections, 55 mph average speed.

---

## Tech stack

| Layer | Stack |
|---|---|
| Frontend | React 19, Vite, TypeScript (strict), Tailwind CSS v4, shadcn/ui, react-hook-form + Zod, Leaflet |
| Backend | Django 6, Django REST Framework, Python 3.13, [uv](https://github.com/astral-sh/uv) |
| Routing / Geocoding | [OpenRouteService](https://openrouteservice.org) — `driving-hgv` profile for truck-suitable routes |
| Hosting | Vercel (frontend), DigitalOcean droplet behind nginx + gunicorn (backend) |
| CI/CD | GitHub Actions — auto-deploys backend on every push to `main` that touches `backend/**` |
| Testing | pytest (HOS scheduler), TypeScript strict mode + Zod runtime validation |

---

## Architecture

Request flow for `POST /api/trip/`:

```
TripForm (React)
   │
   ▼
Django + DRF (api.asmittyagi.com)
   ├─ Forward-geocode 3 user locations
   ├─ Fetch HGV route from ORS Directions API
   ├─ Run HOS scheduler in-process (pure Python)
   │     · time-and-mile simulation across legs
   │     · enforces: 11h drive · 14h window · 8h break clock · 70h cycle · fuel-1000mi
   │     · location-aware via RouteGeoRef (interpolates lat/lng at cumulative miles)
   │     · records placeholder keys for stop locations — no network calls during scheduling
   ├─ Reverse-geocode all unique stop coordinates in parallel (ThreadPoolExecutor)
   └─ Substitute placeholder keys with resolved "City, ST" strings
       │
       ▼
Response: { route, locations, days[] }
   │
   ▼
SVG log sheets + Leaflet map (React)
```

### Design decisions

**Two-phase geocoding for parallel resolution.** The scheduler first runs as pure math, collecting stop positions as opaque placeholder keys. After the schedule is built, all unique coordinates are reverse-geocoded in parallel via `ThreadPoolExecutor`. Cut request time from ~12s (sequential) to ~5s.

**Day-level locations.** Each `DayLog` exposes `day_start_location` and `day_end_location`, seeded at every calendar-day boundary inside `_new_day()` — including restart days where no driving happens. The log sheet "From / To" header reflects per-day driver position rather than trip-level origin / destination, matching real driver convention.

**Quarter-hour display rounding.** The scheduler runs at full floating-point precision internally for all HOS limit math (`abs_hour`, `cycle_hours`). `DayLog.to_dict()` quantizes segment times to the nearest 15 minutes for display, because the FMCSA paper-log form header literally reads *"MINUTES TO BE 00, 15, 30, 45"*. A module-level toggle (`DISPLAY_ROUND_TO_QUARTER_HOUR`) flips this off for debugging.

**Production-hardened settings.** `SECRET_KEY` required from environment (no fallback default), `DEBUG` defaults to False, HTTPS hardening block (HSTS, secure cookies, proxy SSL header, SSL redirect) wrapped in `if not DEBUG:` so local dev is unaffected. Admin route deliberately not exposed — no models, no superuser flow.

**Polished autocomplete UX.** Leading-edge debounce (first suggestion fires immediately on reaching 3 chars), in-memory cache via `useRef`, abort-controller cancellation of in-flight requests, stale-response guard. Locality-only ORS filter to prevent state-centroid suggestions that break HGV routing.

---

## Local development

### Backend

```bash
cd backend
uv venv
source .venv/bin/activate
uv pip install -r requirements.txt

# Set up environment
cat > .env <<EOF
ORS_API_KEY=<get a free key at openrouteservice.org>
SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
EOF

python manage.py migrate
python manage.py runserver
```

Backend serves at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
echo "VITE_API_URL=http://localhost:8000" > .env.local
npm run dev
```

Frontend serves at `http://localhost:5173`.

### Tests

```bash
cd backend
uv run pytest -v
```

Eight tests covering HOS rule compliance (11-hour drive limit, 70-hour cycle, 30-min break trigger), day-page invariants (midnight continuity, 24-hour sum), and regression guards for recent fixes.

```bash
cd frontend
npm run typecheck
```

TypeScript strict mode catches most frontend invariants at compile time.

---

## Repository layout

```
spotter/
├── backend/        Django + DRF API server
│   ├── spotter/    Project settings, URLs, WSGI
│   └── trips/      Views, serializers, HOS scheduler, ORS client, tests
├── frontend/       React + Vite SPA
│   └── src/
│       ├── components/   TripForm, RouteMap, LogSheet, etc.
│       ├── lib/          API client, utilities
│       └── hooks/        useLocationAutocomplete, etc.
├── wiki/           Long-form design documentation (kept current)
├── raw/            Source-of-truth references (FMCSA rules, log sheet format)
└── CLAUDE.md       Repo conventions and workflows
```

### Deep documentation

The `wiki/` folder is the long-form documentation. If you want to understand *why* something is the way it is, start there:

- [wiki/architecture.md](wiki/architecture.md) — system design and stack decisions
- [wiki/hos-calculator.md](wiki/hos-calculator.md) — HOS scheduling algorithm spec
- [wiki/log-sheet-renderer.md](wiki/log-sheet-renderer.md) — SVG rendering approach
- [wiki/api-research.md](wiki/api-research.md) — OpenRouteService integration notes
- [wiki/log.md](wiki/log.md) — chronological log of every meaningful change

---

## Deployment

| Component | Where | How |
|---|---|---|
| Frontend | Vercel, root directory `frontend/` | Auto-deploys on every push. `VITE_API_URL` set as Vercel env var. |
| Backend | DigitalOcean droplet, Ubuntu 24.04 | gunicorn (3 workers, Unix socket) behind nginx + Let's Encrypt. Systemd-managed. |
| CI/CD | GitHub Actions | `.github/workflows/deploy-backend.yml` SSHes in on push to `main` when `backend/**` changes, pulls, syncs deps via uv, migrates, restarts gunicorn. |
| DNS | Cloudflare | A record for `api.asmittyagi.com` (DNS only), CNAME for `logmate.asmittyagi.com` → Vercel. |
