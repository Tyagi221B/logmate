# Log Sheet Renderer Spec — v2 (confirmed)

> Updated after full cross-examination of video + screenshots.

## Confirmed Structure

### Every page:
- Starts at hour 0.0 (midnight), ends at hour 24.0
- Line begins from LEFT EDGE on whatever row was active at midnight
- Red dot at every status change point
- Vertical connector between rows at each status change

### Grid dimensions (actual SVG constants in LogSheet.tsx):
```
W (total SVG width):  1100px
LABEL_W:              148px   (left column — row labels)
GRID_W:               828px   (24hrs × 34.5px/hr)
ROW_H:                44px
GRID_H:               ROW_H × 4 = 176px
HEADER_H:             190px
REMARKS_H:            140px
SVG_H:                HEADER_H + GRID_H + REMARKS_H + 40 ≈ 546px

TOTALS PANEL:
  panelX = LABEL_W + GRID_W + 32 = 1008px
  BOX_W = 30px, COLON_W = 10px, PANEL_W = 70px
```

### Row Y midpoints (absolute, from SVG top):
```
off_duty:  HEADER_H + ROW_H*0 + ROW_H/2  = 212px
sleeper:   HEADER_H + ROW_H*1 + ROW_H/2  = 256px
driving:   HEADER_H + ROW_H*2 + ROW_H/2  = 300px
on_duty:   HEADER_H + ROW_H*3 + ROW_H/2  = 344px
```

### X coordinate:
```js
hourToX = (hour) => LABEL_W + (hour / 24) * GRID_W
// e.g. hour 6.5 = 148 + (6.5/24)*828 = 148 + 224.25 = 372.25px
```

## What to Draw

### For each segment:
1. `x1 = hourToX(start_hour)`, `x2 = hourToX(end_hour)`
2. `y = rowY[status] + 18` (middle of row)
3. Horizontal line: `<line x1 y1 x2 y2 strokeWidth=2 />`
4. Red dot at start: `<circle cx=x1 cy=y r=4 fill=red />`
5. If previous segment exists: vertical connector from prev_y to current_y at x1

### Bracket (confirmed: Row 2 / Driving row):
For each entry in `brackets[]`:
```
x1 = hourToX(start_hour)
x2 = hourToX(end_hour)
y_top = rowY[driving] + 4
y_bottom = rowY[driving] + 32
Draw: vertical line down at x1, horizontal line at bottom, vertical line up at x2
Shape: |__| (cup/bracket)
```

### Tick marks on grid:
- Major tick (hour) every 40px, height = 12px
- Minor tick (15 min) every 10px, height = 6px
- Both at top AND bottom of grid

### Remarks section (bracket-driven — confirmed from ELD video):
One diagonal remark per **bracket** (on-duty-not-driving stationary period). NOT per status change.
- Diagonal originates from bottom-left corner of the bracket shape
- City name above the diagonal line, activity below
- Diagonal length proportional to text width (city × 4.8px/char, activity × 4.2px/char)
- Spacing enforced: MIN_GAP between consecutive anchor points to prevent overlap

**Why brackets, not status changes?**
A bracket represents the truck being stationary (pre-trip, pickup, fuel, dropoff, etc.). These are the real-world stops that need to be annotated on the paper log. A status change from Driving → On Duty is meaningless without knowing what the driver was doing at that location. The bracket already carries both the time range and the activity.

## Header Fields (left side)
- Driver Number: "N/A"
- Driver Initials: "N/A"  
- Co-Driver: "N/A"
- Home Terminal: use current_location from input

## Header Fields (right side)
- Date: real calendar date (MM/DD/YY)
- Vehicle Numbers: "N/A"
- Total Driving Miles Today: from route data
- Total Truck Mileage Today: same as driving miles (no co-driver)
- Carrier: "N/A"

## Totals Panel (right of grid)
```
Row 1 (Off Duty):    [HH] [MM]
Row 2 (Sleeper):     [HH] [MM]
Row 3 (Driving):     [HH] [MM]
Row 4 (On Duty):     [HH] [MM]
─────────────────────────────
Total:               [HH] [MM]  ← should be 24:00

Circled decimal: (driving_hrs + on_duty_hrs) as X.X  ← circled
```

## From/To Header
- From: start location that day (first non-rest location)
- To: end location that day (last location before rest)

## Things to Confirm When Rendering
- Exact position of circled decimal
- Recap section layout (bottom)
- Bracket exact pixel thickness

## Mobile UX Decision
- Log sheet is wide (24 hrs) — cannot be compressed on mobile
- Show inside `overflow-x-auto` container with `min-width: 900px`
- Subtle "← Scroll sideways →" hint shown only on small screens
- One day at a time — prev/next chevron buttons (like flipping a real log book)
- Paper look: white/cream background, blue grid lines — contrasts with dark app

## Visual Style (confirmed from reference images)
- Background: white/cream (#fafaf7 or similar)
- Grid lines: blue (#3b82f6 at ~30% opacity, like real paper forms)
- Status lines: thick black (stroke-width 2.5)
- Status change dots: red (#ef4444), radius 4
- Vertical connectors: black, stroke-width 1.5
- Remark lines: black, angled 45° down-left
- Remark text: two lines per change — location + activity, rotated -45°
- Row labels left-aligned: "1: OFF DUTY", "2: SLEEPER BERTH", "3: DRIVING", "4: ON DUTY (NOT DRIVING)"
- Time labels: Midnight, 1, 2 … 11, Noon, 1 … 11, Midnight

## Minor Ticks (ruler-edge style — confirmed from ELD video)
Drawn at every **row boundary** (5 positions: top + between each of the 4 rows + bottom).
- `:30` mark = 7px inward tick
- `:15` and `:45` marks = 4px inward tick
- Ticks point INTO the row above and below the boundary (bidirectional)

**Why ruler-edge style?** Real paper ELD logs have a ruler edge at each row boundary so drivers can draw accurate lines. The ticks help visually align time marks without cluttering the grid with full-height lines.

## ORS Geometry → Leaflet
The `/geojson` endpoint returns a GeoJSON LineString directly. React-Leaflet's `<Polyline>` accepts `positions={coordinates.map(([lng, lat]) => [lat, lng])}` — note the lat/lng swap since ORS uses [lng, lat] order but Leaflet uses [lat, lng].

## Last Updated
2026-05-09 — corrected SVG constants, bracket-driven remarks, minor tick spec, ORS geometry note
