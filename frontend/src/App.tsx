import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { planTrip, normalizeError } from '@/lib/api'
import type { TripRequest, TripResponse, AppStatus } from '@/types/trip'
import TripForm from '@/components/TripForm'
import RouteMap from '@/components/RouteMap'
import TripSummary from '@/components/TripSummary'
import LogSheet from '@/components/LogSheet'
import { Button } from '@/components/ui/button'

export default function App() {
  const [state, setState] = useState<AppStatus>({ status: 'idle' })
  const [cycleHours, setCycleHours] = useState(0)
  const [lastRequest, setLastRequest] = useState<TripRequest | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  async function handleSubmit(req: TripRequest) {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setCycleHours(req.current_cycle_hours)
    setLastRequest(req)
    setState({ status: 'loading' })
    try {
      const data = await planTrip(req, abortRef.current.signal)
      setState({ status: 'success', data })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      const message = normalizeError(err)
      setState({ status: 'error', message })
      toast.error(message)
    }
  }

  function handleReset() {
    abortRef.current?.abort()
    setState({ status: 'idle' })
  }

  const isLoading = state.status === 'loading'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {(state.status === 'idle' || state.status === 'loading' || state.status === 'error') && (
        <TripForm onSubmit={handleSubmit} loading={isLoading} defaultValues={lastRequest ?? undefined} />
      )}
      {state.status === 'success' && (
        <Results data={state.data} cycleHours={cycleHours} onReset={handleReset} />
      )}
    </div>
  )
}

function Results({
  data,
  cycleHours,
  onReset,
}: {
  data: TripResponse
  cycleHours: number
  onReset: () => void
}) {
  const [dayIdx, setDayIdx] = useState(0)
  const totalDays = data.days.length
  const currentDay = data.days[dayIdx]

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 space-y-4">

      {/* Back button */}
      <button
        onClick={onReset}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Plan another trip
      </button>

      {/* Trip summary */}
      <TripSummary data={data} cycleHoursUsed={cycleHours} />

      {/* Map */}
      <RouteMap route={data.route} locations={data.locations} />

      {/* Log sheet — one day at a time */}
      <div className="space-y-3">
        {/* Day header + pagination */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Driver's Daily Log</p>
            <p className="text-base font-semibold">
              Day {dayIdx + 1} — {currentDay.date}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              disabled={dayIdx === 0}
              onClick={() => setDayIdx(i => i - 1)}
              aria-label="Previous day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-muted-foreground tabular-nums">
              {dayIdx + 1} / {totalDays}
            </span>
            <Button
              variant="outline"
              size="icon"
              disabled={dayIdx === totalDays - 1}
              onClick={() => setDayIdx(i => i + 1)}
              aria-label="Next day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Log sheet SVG — horizontally scrollable on mobile */}
        <div
          className="overflow-x-auto rounded-xl border border-border"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <LogSheet day={currentDay} driverLocation={data.days[0]?.day_start_location || data.locations.current.label} />
        </div>

        {/* Scroll hint — only on small screens */}
        <p className="text-center text-xs text-muted-foreground sm:hidden">
          ← Scroll sideways to view full log →
        </p>
      </div>
    </div>
  )
}
