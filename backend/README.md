# Backend — Django + DRF

See the [project README](../README.md) for architecture, design decisions, and the full request flow.

## Quick start

```bash
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

## Tests

```bash
uv run pytest -v
```

Eight tests cover FMCSA rule enforcement (11h driving limit, 70h cycle, 30-min break) plus day-page invariants and regression guards.

## Layout

```
backend/
├── spotter/                Django project — settings, URLs, WSGI
└── trips/
    ├── hos_calculator.py   Pure-Python scheduler (FMCSA 70/8 rules)
    ├── ors_client.py       OpenRouteService HTTP client (geocode, route, reverse)
    ├── views.py            DRF views, two-phase parallel geocoding
    ├── serializers.py      Input validation
    └── test_hos_calculator.py    pytest suite
```

## Key endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health/` | Health check — returns `{"status": "ok"}` |
| `GET` | `/api/autocomplete/?q=<query>` | Location autocomplete proxy (locality-only) |
| `POST` | `/api/trip/` | Plan a trip — returns route, locations, per-day log data |

## Notes

- The HOS scheduler is pure Python — no Django imports, no DB. The pytest suite runs without Django machinery in ~10ms.
- ORS API key is held server-side only. The frontend never sees it.
- Production deploys run with `DEBUG=False`, which auto-enables the HTTPS hardening block in `settings.py`.
