# Spotter ELD Trip Planner — Wiki Schema

## Project
Full-stack ELD (Electronic Logging Device) trip planner.
- **Assessment by:** Spotter AI
- **Stack:** Django + DRF (backend), React + Vite (frontend)
- **Package manager:** uv (NOT pip). Always use `uv` for Python deps.
- **Deploy:** DigitalOcean (backend), Vercel (frontend)
- **Map API:** OpenRouteService (free tier)

## Wiki Structure

```
spotter/
├── CLAUDE.md              ← this file (schema + conventions)
├── raw/                   ← immutable source docs, never modify
│   ├── assessment.md      ← extracted assessment requirements
│   ├── hos-rules.md       ← HOS 70hr/8-day rules reference
│   └── log-sheet-format.md← how the paper log sheet works
├── wiki/                  ← LLM-maintained, always up to date
│   ├── index.md           ← catalog of all wiki pages
│   ├── log.md             ← append-only activity log
│   ├── architecture.md    ← system design decisions
│   ├── hos-calculator.md  ← HOS scheduling logic spec
│   ├── log-sheet-renderer.md ← how to draw the log sheet
│   └── api-research.md    ← ORS API + other API notes
├── backend/               ← Django project
└── frontend/              ← React + Vite project
```

## Conventions

### Wiki pages
- Every page has a `# Title` and a one-line `> Summary` at the top
- Use `## Last Updated` section at bottom with date
- Cross-reference other wiki pages with `[page](../wiki/page.md)`
- When something changes, update the page — don't create a duplicate

### raw/ files
- Never modify raw/ files
- They are source-of-truth references only

### log.md format
- Every significant action gets a log entry
- Format: `## [YYYY-MM-DD] action | description`
- Actions: `ingest`, `decision`, `build`, `research`

## Workflows

### When we figure something out
1. Update or create the relevant wiki page
2. Add a log entry to wiki/log.md
3. Update wiki/index.md if it's a new page

### When starting a new session
1. Read wiki/index.md to orient
2. Read wiki/log.md (last 5 entries) to see what was done recently
3. Continue from where we left off

### Python / Django
- Use `uv` for all package management
- `uv venv` to create virtualenv
- `uv pip install <pkg>` or add to pyproject.toml and `uv sync`
- Never use bare `pip`

## Git Commits
- Do NOT add "Co-Authored-By" lines
- Keep messages concise and descriptive

## Key Decisions (update as we go)
- See wiki/architecture.md for all architectural decisions
