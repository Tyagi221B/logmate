# Log Sheet Renderer Spec — v2 (confirmed)

> Updated after full cross-examination of video + screenshots.

## Confirmed Structure

### Every page:
- Starts at hour 0.0 (midnight), ends at hour 24.0
- Line begins from LEFT EDGE on whatever row was active at midnight
- Red dot at every status change point
- Vertical connector between rows at each status change

### Grid dimensions (our SVG):
```
Total width:   1040px  (label 80px + grid 960px)
Grid width:    960px   (each hour = 40px, 24hrs)
Row height:    36px    (4 rows = 144px grid height)
Header:        ~160px above grid
Remarks:       ~120px below grid
Totals:        right side panel ~100px wide
```

### Row mapping:
```
Row 0: Off Duty      → y = 0
Row 1: Sleeper Berth → y = 36
Row 2: Driving       → y = 72
Row 3: On Duty       → y = 108
```

### X coordinate:
```js
hourToX = (hour) => 80 + (hour / 24) * 960
// e.g. 6.5 hrs = 80 + (6.5/24)*960 = 80 + 260 = 340px
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

### Remarks section:
For each status change with a location:
- Drop a tick mark below the grid at the change x position
- Draw a 45° angled line down-left
- Text at end: "City, State — Activity"
- Rotated text (-45deg)

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

## Last Updated
2026-05-09 — added mobile UX decisions + visual style from reference images
