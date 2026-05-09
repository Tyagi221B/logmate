import type { DayLog, Segment } from '@/types/trip'

interface Props {
  day: DayLog
  driverLocation: string  // home terminal / current location
}

// ─── Layout constants ────────────────────────────────────────────────────────
const W = 1100          // total SVG width
const LABEL_W = 148     // left column for row labels
const GRID_W = 828      // 24 hrs × 34.5px

const HEADER_H = 190    // header section height
const ROW_H = 44        // each status row height
const GRID_H = ROW_H * 4
const REMARKS_H = 140
const SVG_H = HEADER_H + GRID_H + REMARKS_H + 40  // ~550

// Row Y midpoints (relative to HEADER_H)
const ROW_Y: Record<Segment['status'], number> = {
  off_duty: HEADER_H + ROW_H * 0 + ROW_H / 2,
  sleeper:  HEADER_H + ROW_H * 1 + ROW_H / 2,
  driving:  HEADER_H + ROW_H * 2 + ROW_H / 2,
  on_duty:  HEADER_H + ROW_H * 3 + ROW_H / 2,
}

const GRID_TOP = HEADER_H
const GRID_BOTTOM = HEADER_H + GRID_H

function hourToX(h: number): number {
  return LABEL_W + (h / 24) * GRID_W
}

function toHHMM(decimal: number): { h: string; m: string } {
  const h = Math.floor(decimal)
  const m = Math.round((decimal - h) * 60)
  return { h: String(h).padStart(2, '0'), m: String(m).padStart(2, '0') }
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function LogSheet({ day, driverLocation }: Props) {
  const { segments, brackets, totals, on_duty_decimal, driving_miles_today, date } = day

  // derive From / To from segments
  const fromLabel = day.day_start_location || driverLocation
  const toLabel   = day.day_end_location   || driverLocation

  return (
    <svg
      viewBox={`0 0 ${W} ${SVG_H}`}
      width={W}
      height={SVG_H}
      fontFamily="Arial, Helvetica, sans-serif"
      style={{ display: 'block', background: '#fdfcf7' }}
    >
      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <Header date={date} fromLabel={fromLabel} toLabel={toLabel}
              driverLocation={driverLocation} drivingMiles={driving_miles_today} />

      {/* ── GRID BACKGROUND ─────────────────────────────────────────── */}
      <GridBackground />

      {/* ── ROW LABELS ──────────────────────────────────────────────── */}
      <RowLabels />

      {/* ── HOUR TICKS (top + bottom) ────────────────────────────────── */}
      <HourTicks />

      {/* ── TIME LABELS ─────────────────────────────────────────────── */}
      <TimeLabels />

      {/* ── STATUS LINES ─────────────────────────────────────────────── */}
      <StatusLines segments={segments} />

      {/* ── BRACKETS (stationary periods on driving row) ─────────────── */}
      <Brackets brackets={brackets} />

      {/* ── REMARKS ──────────────────────────────────────────────────── */}
      <Remarks brackets={brackets} />

      {/* ── TOTALS PANEL ─────────────────────────────────────────────── */}
      <TotalsPanel totals={totals} onDutyDecimal={on_duty_decimal} />

      {/* Outer border */}
      <rect x={0} y={0} width={W} height={SVG_H} fill="none" stroke="#94a3b8" strokeWidth={1} />
    </svg>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Header({ date, fromLabel, toLabel, driverLocation, drivingMiles }: {
  date: string; fromLabel: string; toLabel: string; driverLocation: string; drivingMiles: number
}) {
  const [month, day, year] = date.split('/')
  return (
    <g>
      {/* Title */}
      <text x={LABEL_W} y={24} fontSize={15} fontWeight="bold" fill="#1e3a5f">Drivers Daily Log</text>
      <text x={LABEL_W + 205} y={24} fontSize={10} fill="#475569">(24 hours)</text>

      {/* Date — label on top line, value + underline below with clear gap */}
      <text x={LABEL_W + 368} y={13} fontSize={8} fill="#64748b">Month</text>
      <text x={LABEL_W + 418} y={13} fontSize={8} fill="#64748b">Day</text>
      <text x={LABEL_W + 460} y={13} fontSize={8} fill="#64748b">Year</text>
      <text x={LABEL_W + 380} y={25} fontSize={12} fontWeight="bold" fill="#0f172a" textAnchor="middle">{month}</text>
      <line x1={LABEL_W + 358} y1={27} x2={LABEL_W + 404} y2={27} stroke="#475569" strokeWidth={0.8} />
      <text x={LABEL_W + 428} y={25} fontSize={12} fontWeight="bold" fill="#0f172a" textAnchor="middle">{day}</text>
      <line x1={LABEL_W + 410} y1={27} x2={LABEL_W + 448} y2={27} stroke="#475569" strokeWidth={0.8} />
      <text x={LABEL_W + 475} y={25} fontSize={12} fontWeight="bold" fill="#0f172a" textAnchor="middle">{year}</text>
      <line x1={LABEL_W + 453} y1={27} x2={LABEL_W + 500} y2={27} stroke="#475569" strokeWidth={0.8} />

      {/* Original / Duplicate note */}
      <text x={LABEL_W + 520} y={16} fontSize={8} fill="#64748b">Original - File at home terminal.</text>
      <text x={LABEL_W + 520} y={27} fontSize={8} fill="#64748b">Duplicate - Driver retains in his/her possession for 8 days.</text>

      {/* From / To */}
      <text x={LABEL_W} y={44} fontSize={10} fontWeight="bold" fill="#1e3a5f">From:</text>
      <line x1={LABEL_W + 34} y1={45} x2={LABEL_W + 240} y2={45} stroke="#94a3b8" strokeWidth={0.8} />
      <text x={LABEL_W + 36} y={44} fontSize={10} fill="#0f172a">{fromLabel}</text>

      <text x={LABEL_W + 260} y={44} fontSize={10} fontWeight="bold" fill="#1e3a5f">To:</text>
      <line x1={LABEL_W + 278} y1={45} x2={LABEL_W + 480} y2={45} stroke="#94a3b8" strokeWidth={0.8} />
      <text x={LABEL_W + 280} y={44} fontSize={10} fill="#0f172a">{toLabel}</text>

      {/* Miles boxes */}
      <rect x={LABEL_W} y={54} width={90} height={24} fill="none" stroke="#94a3b8" strokeWidth={0.8} />
      <rect x={LABEL_W + 96} y={54} width={90} height={24} fill="none" stroke="#94a3b8" strokeWidth={0.8} />
      <text x={LABEL_W + 2} y={63} fontSize={7} fill="#64748b">Total Miles Driving Today</text>
      <text x={LABEL_W + 98} y={63} fontSize={7} fill="#64748b">Total Mileage Today</text>
      <text x={LABEL_W + 45} y={74} fontSize={12} fontWeight="bold" fill="#0f172a" textAnchor="middle">{Math.round(drivingMiles)}</text>
      <text x={LABEL_W + 141} y={74} fontSize={12} fontWeight="bold" fill="#0f172a" textAnchor="middle">{Math.round(drivingMiles)}</text>

      {/* Carrier info */}
      <text x={LABEL_W + 260} y={64} fontSize={9} fill="#64748b">Name of Carrier or Carriers</text>
      <line x1={LABEL_W + 260} y1={78} x2={LABEL_W + 580} y2={78} stroke="#94a3b8" strokeWidth={0.8} />
      <text x={LABEL_W + 260} y={77} fontSize={9} fill="#94a3b8">N/A</text>

      <text x={LABEL_W + 260} y={90} fontSize={9} fill="#64748b">Home Terminal Address</text>
      <line x1={LABEL_W + 260} y1={104} x2={LABEL_W + 580} y2={104} stroke="#94a3b8" strokeWidth={0.8} />
      <text x={LABEL_W + 260} y={103} fontSize={9} fill="#0f172a">{driverLocation}</text>

      {/* Vehicle numbers */}
      <text x={LABEL_W} y={102} fontSize={8} fill="#64748b">Truck/Tractor and Trailer Numbers or</text>
      <text x={LABEL_W} y={112} fontSize={8} fill="#64748b">License Plates(s)/State (show each unit)</text>
      <line x1={LABEL_W} y1={125} x2={LABEL_W + 240} y2={125} stroke="#94a3b8" strokeWidth={0.8} />
      <text x={LABEL_W + 2} y={124} fontSize={9} fill="#94a3b8">N/A</text>
    </g>
  )
}

function GridBackground() {
  const rows = ['off_duty', 'sleeper', 'driving', 'on_duty'] as const
  return (
    <g>
      {/* Row backgrounds — alternating subtle tint */}
      {rows.map((_, i) => (
        <rect
          key={i}
          x={LABEL_W}
          y={GRID_TOP + i * ROW_H}
          width={GRID_W}
          height={ROW_H}
          fill={i % 2 === 0 ? '#f8faff' : '#f0f4ff'}
        />
      ))}

      {/* Vertical hour lines */}
      {Array.from({ length: 25 }, (_, i) => (
        <line
          key={i}
          x1={hourToX(i)} y1={GRID_TOP}
          x2={hourToX(i)} y2={GRID_BOTTOM}
          stroke="#93c5fd"
          strokeWidth={i === 0 || i === 12 || i === 24 ? 1.2 : 0.5}
        />
      ))}

      {/* Horizontal row dividers */}
      {[0, 1, 2, 3, 4].map(i => (
        <line
          key={i}
          x1={LABEL_W} y1={GRID_TOP + i * ROW_H}
          x2={LABEL_W + GRID_W} y2={GRID_TOP + i * ROW_H}
          stroke="#93c5fd" strokeWidth={1}
        />
      ))}

      {/* Label column border */}
      <rect x={0} y={GRID_TOP} width={LABEL_W} height={GRID_H} fill="#f1f5ff" stroke="#93c5fd" strokeWidth={0.8} />
    </g>
  )
}

function RowLabels() {
  const labels = [
    { line1: '1: OFF DUTY', line2: null },
    { line1: '2: SLEEPER', line2: 'BERTH' },
    { line1: '3: DRIVING', line2: null },
    { line1: '4: ON DUTY', line2: '(NOT DRIVING)' },
  ]
  return (
    <g>
      {labels.map((lbl, i) => {
        const cy = GRID_TOP + i * ROW_H + ROW_H / 2
        return (
          <g key={i}>
            <text x={LABEL_W - 6} y={lbl.line2 ? cy - 5 : cy + 4} fontSize={9} fontWeight="bold"
                  fill="#1e3a5f" textAnchor="end">{lbl.line1}</text>
            {lbl.line2 && (
              <text x={LABEL_W - 6} y={cy + 7} fontSize={9} fontWeight="bold"
                    fill="#1e3a5f" textAnchor="end">{lbl.line2}</text>
            )}
          </g>
        )
      })}
    </g>
  )
}

function HourTicks() {
  const ticks: React.ReactNode[] = []

  // Major ticks — at outer grid edges only (top + bottom of full grid)
  for (let h = 0; h <= 24; h++) {
    const x = hourToX(h)
    ticks.push(<line key={`mt${h}`} x1={x} y1={GRID_TOP} x2={x} y2={GRID_TOP + 10} stroke="#1e3a5f" strokeWidth={1} />)
    ticks.push(<line key={`mb${h}`} x1={x} y1={GRID_BOTTOM - 10} x2={x} y2={GRID_BOTTOM} stroke="#1e3a5f" strokeWidth={1} />)
  }

  // Minor ticks — drawn at EVERY row boundary, pointing inward into each row
  // This creates the ruler-on-each-edge look matching real ELD paper log sheets
  const rowBounds = Array.from({ length: 5 }, (_, i) => GRID_TOP + i * ROW_H)

  for (let h = 0; h < 24; h++) {
    for (let m = 1; m <= 3; m++) {
      const mx = hourToX(h + m / 4)
      const isHalf = m === 2   // :30 is slightly taller than :15 / :45
      const len = isHalf ? 7 : 4

      rowBounds.forEach((by, bi) => {
        // Tick pointing DOWN into the row below this boundary
        if (bi < rowBounds.length - 1) {
          ticks.push(
            <line key={`d_${h}_${m}_${bi}`}
              x1={mx} y1={by} x2={mx} y2={by + len}
              stroke="#475569" strokeWidth={0.55} />
          )
        }
        // Tick pointing UP into the row above this boundary
        if (bi > 0) {
          ticks.push(
            <line key={`u_${h}_${m}_${bi}`}
              x1={mx} y1={by} x2={mx} y2={by - len}
              stroke="#475569" strokeWidth={0.55} />
          )
        }
      })
    }
  }

  return <g>{ticks}</g>
}

function TimeLabels() {
  const labels = [
    'Mid-\nnight', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
    'Noon', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'Mid-\nnight',
  ]
  return (
    <g>
      {labels.map((lbl, i) => {
        const x = hourToX(i)
        const parts = lbl.split('\n')
        return (
          <g key={i}>
            {/* Top labels */}
            {parts.map((p, j) => (
              <text key={j} x={x} y={GRID_TOP - 18 + j * 10} fontSize={8} fill="#1e3a5f" textAnchor="middle">{p}</text>
            ))}
            {/* Bottom labels */}
            {parts.map((p, j) => (
              <text key={j} x={x} y={GRID_BOTTOM + 14 + j * 10} fontSize={8} fill="#1e3a5f" textAnchor="middle">{p}</text>
            ))}
          </g>
        )
      })}

    </g>
  )
}

function StatusLines({ segments }: { segments: Segment[] }) {
  const elements: React.ReactNode[] = []

  segments.forEach((seg, i) => {
    const x1 = hourToX(seg.start_hour)
    const x2 = hourToX(seg.end_hour)
    const y  = ROW_Y[seg.status]

    // Horizontal status line
    elements.push(
      <line key={`line${i}`} x1={x1} x2={x2} y1={y} y2={y}
            stroke="#0f172a" strokeWidth={2.5} strokeLinecap="round" />
    )

    // Red dot ONLY when the status row actually changes (not same-row continuations)
    const statusChanged = i === 0 || segments[i - 1].status !== seg.status
    if (statusChanged) {
      elements.push(
        <circle key={`dot${i}`} cx={x1} cy={y} r={4} fill="#ef4444" />
      )
    }

    // Vertical connector only when row changes
    if (i > 0 && statusChanged) {
      const prevY = ROW_Y[segments[i - 1].status]
      if (prevY !== y) {
        elements.push(
          <line key={`conn${i}`} x1={x1} x2={x1} y1={prevY} y2={y}
                stroke="#0f172a" strokeWidth={1.5} />
        )
      }
    }
  })

  return <g>{elements}</g>
}

function Brackets({ brackets }: { brackets: DayLog['brackets'] }) {
  // Brackets sit just below the bottom time axis — small |__| cup shape, NOT inside the grid
  const bracketTop = GRID_BOTTOM + 14   // just below the axis tick area
  const bracketH   = 12                  // short drop

  return (
    <g stroke="#0f172a" strokeWidth={1.5} fill="none">
      {brackets.map((b, i) => {
        const x1 = hourToX(b.start_hour)
        const x2 = hourToX(b.end_hour)
        return (
          <g key={i}>
            <line x1={x1} y1={bracketTop} x2={x1} y2={bracketTop + bracketH} />
            <line x1={x1} y1={bracketTop + bracketH} x2={x2} y2={bracketTop + bracketH} />
            <line x1={x2} y1={bracketTop} x2={x2} y2={bracketTop + bracketH} />
          </g>
        )
      })}
    </g>
  )
}

function Remarks({ brackets }: { brackets: DayLog['brackets'] }) {
  // Diagonal originates from the bottom-left corner of each bracket
  const BRACKET_TOP = GRID_BOTTOM + 14
  const BRACKET_H   = 12
  const LINE_START_Y = BRACKET_TOP + BRACKET_H   // = GRID_BOTTOM + 26
  const MIN_DX  = 20
  const MIN_GAP = 44
  const PADDING = 10

  function labelDx(city: string, activity: string): number {
    const cityPx     = city.length     * 4.8
    const activityPx = activity.length * 4.2
    return Math.max(cityPx, activityPx) + PADDING
  }

  function cityName(loc: string): string {
    const base = loc.includes(' → ') ? loc.split(' → ')[0] : loc
    const firstSegment = base.split(',')[0].trim()
    return firstSegment.split(' ').slice(0, 2).join(' ')
  }

  // One label per bracket — originate from the start of the bracket
  const items = brackets.map(b => ({
    axisX: hourToX(b.start_hour),
    city: cityName(b.location),
    activity: b.activity,
  }))

  // Enforce minimum X gap between consecutive text anchors
  const anchorX: number[] = []
  for (let i = 0; i < items.length; i++) {
    const ax = items[i].axisX
    let tx = ax - labelDx(items[i].city, items[i].activity)
    if (i > 0) tx = Math.max(tx, anchorX[i - 1] + MIN_GAP)
    tx = Math.min(tx, ax - MIN_DX)
    anchorX.push(tx)
  }

  return (
    <g>
      <text x={4} y={GRID_BOTTOM + 46} fontSize={10} fontWeight="bold" fill="#1e3a5f">REMARKS</text>

      {items.map((item, i) => {
        const ax = item.axisX
        const tx = anchorX[i]
        const dx = ax - tx
        const ty = LINE_START_Y + dx   // dy = dx for 45°

        return (
          <g key={i}>
            <line x1={ax} y1={LINE_START_Y} x2={tx} y2={ty}
                  stroke="#0f172a" strokeWidth={1.2} />
            <g transform={`rotate(-45, ${tx}, ${ty})`}>
              <text x={tx} y={ty - 3} fontSize={8} fontWeight="bold"
                    fill="#0f172a" textAnchor="start">
                {item.city}
              </text>
              <text x={tx} y={ty + 9} fontSize={7}
                    fill="#475569" textAnchor="start">
                {item.activity}
              </text>
            </g>
          </g>
        )
      })}
    </g>
  )
}

function TotalsPanel({ totals, onDutyDecimal }: { totals: DayLog['totals']; onDutyDecimal: number }) {
  const rows: Array<{ label: string; key: keyof typeof totals }> = [
    { label: '1', key: 'off_duty' },
    { label: '2', key: 'sleeper' },
    { label: '3', key: 'driving' },
    { label: '4', key: 'on_duty' },
  ]
  const totalHours = Object.values(totals).reduce((s, v) => s + v, 0)
  const panelX = LABEL_W + GRID_W + 32  // 32px margin from grid edge
  const BOX_W  = 30
  const COLON_W = 10
  const PANEL_W = BOX_W + COLON_W + BOX_W  // 70px total

  const hhCx = panelX + BOX_W / 2
  const mmCx = panelX + BOX_W + COLON_W + BOX_W / 2

  return (
    <g>
      {/* Column headers */}
      <text x={hhCx} y={GRID_TOP - 22} fontSize={7} fontWeight="bold" fill="#1e3a5f" textAnchor="middle">HOURS</text>
      <text x={mmCx} y={GRID_TOP - 30} fontSize={6.5} fontWeight="bold" fill="#1e3a5f" textAnchor="middle">MINUTES</text>
      <text x={mmCx} y={GRID_TOP - 21} fontSize={6.5} fontWeight="bold" fill="#1e3a5f" textAnchor="middle">TO BE</text>
      <text x={mmCx} y={GRID_TOP - 12} fontSize={6} fill="#475569" textAnchor="middle">00, 15, 30, 45</text>

      {rows.map((row, i) => {
        const { h, m } = toHHMM(totals[row.key])
        const y = GRID_TOP + i * ROW_H

        return (
          <g key={i}>
            {/* HH box */}
            <rect x={panelX} y={y + 5} width={BOX_W} height={ROW_H - 10} fill="white" stroke="#93c5fd" strokeWidth={0.8} />
            <text x={panelX + BOX_W / 2} y={y + ROW_H / 2 + 4} fontSize={11} fontWeight="bold" fill="#0f172a" textAnchor="middle">{h}</text>

            {/* colon */}
            <text x={panelX + BOX_W + COLON_W / 2} y={y + ROW_H / 2 + 4} fontSize={12} fill="#0f172a" textAnchor="middle">:</text>

            {/* MM box */}
            <rect x={panelX + BOX_W + COLON_W} y={y + 5} width={BOX_W} height={ROW_H - 10} fill="white" stroke="#93c5fd" strokeWidth={0.8} />
            <text x={panelX + BOX_W + COLON_W + BOX_W / 2} y={y + ROW_H / 2 + 4} fontSize={11} fontWeight="bold" fill="#0f172a" textAnchor="middle">{m}</text>
          </g>
        )
      })}

      {/* Divider */}
      <line x1={panelX} y1={GRID_BOTTOM} x2={panelX + PANEL_W} y2={GRID_BOTTOM} stroke="#1e3a5f" strokeWidth={1} />

      {/* Total row — bolder border to distinguish from row boxes */}
      {(() => {
        const { h, m } = toHHMM(totalHours)
        return (
          <g>
            <rect x={panelX} y={GRID_BOTTOM + 4} width={BOX_W} height={24} fill="white" stroke="#1e3a5f" strokeWidth={1.2} />
            <text x={panelX + BOX_W / 2} y={GRID_BOTTOM + 19} fontSize={11} fontWeight="bold" fill="#0f172a" textAnchor="middle">{h}</text>
            <text x={panelX + BOX_W + COLON_W / 2} y={GRID_BOTTOM + 19} fontSize={12} fill="#0f172a" textAnchor="middle">:</text>
            <rect x={panelX + BOX_W + COLON_W} y={GRID_BOTTOM + 4} width={BOX_W} height={24} fill="white" stroke="#1e3a5f" strokeWidth={1.2} />
            <text x={panelX + BOX_W + COLON_W + BOX_W / 2} y={GRID_BOTTOM + 19} fontSize={11} fontWeight="bold" fill="#0f172a" textAnchor="middle">{m}</text>
          </g>
        )
      })()}

      {/* TOTAL HOURS label */}
      <text x={panelX + PANEL_W / 2} y={GRID_BOTTOM + 38} fontSize={7} fontWeight="bold" fill="#1e3a5f" textAnchor="middle">TOTAL</text>
      <text x={panelX + PANEL_W / 2} y={GRID_BOTTOM + 47} fontSize={7} fontWeight="bold" fill="#1e3a5f" textAnchor="middle">HOURS</text>

      {/* On-duty decimal — red circle */}
      {(() => {
        const label = onDutyDecimal.toFixed(1)
        return (
          <g>
            <circle cx={panelX + PANEL_W / 2 - 90} cy={GRID_BOTTOM + 68} r={19} fill="none" stroke="#dc2626" strokeWidth={2} />
            <text x={panelX + PANEL_W / 2 - 90} y={GRID_BOTTOM + 73} fontSize={13} fontWeight="bold" fill="#dc2626" textAnchor="middle">{label}</text>
          </g>
        )
      })()}
    </g>
  )
}
