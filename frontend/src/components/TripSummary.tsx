import { MapPin, Clock, Gauge, CalendarDays, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { TripResponse } from '@/types/trip'

interface Props {
  data: TripResponse
  cycleHoursUsed: number
}

function formatHours(h: number): string {
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  if (mins === 0) return `${hrs}h`
  return `${hrs}h ${mins}m`
}

function toHHMM(decimal: number): string {
  const h = Math.floor(decimal)
  const m = Math.round((decimal - h) * 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export default function TripSummary({ data, cycleHoursUsed }: Props) {
  const { route, locations, days } = data
  const hasInitialRestart = days[0]?.segments.some(s => s.activity === '34-hr restart')
  const effectiveCycleStart = hasInitialRestart ? 0 : cycleHoursUsed
  const totalDrivingHours = days.reduce((sum, d) => sum + d.totals.driving, 0)
  const cycleAfter = Math.min(70, effectiveCycleStart + totalDrivingHours + days.reduce((sum, d) => sum + d.totals.on_duty, 0))
  const cycleRemaining = Math.max(0, 70 - cycleAfter)

  return (
    <Card className="w-full">
      <CardContent className="pt-4 pb-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

          <Stat
            icon={<MapPin className="h-4 w-4 text-primary" />}
            label="Total Distance"
            value={`${route.total_distance_miles.toFixed(0)} mi`}
          />

          <Stat
            icon={<CalendarDays className="h-4 w-4 text-primary" />}
            label="Trip Days"
            value={`${days.length} day${days.length > 1 ? 's' : ''}`}
          />

          <Stat
            icon={<Clock className="h-4 w-4 text-primary" />}
            label="Drive Time"
            value={formatHours(totalDrivingHours)}
          />

          <Stat
            icon={<Gauge className="h-4 w-4 text-green-500" />}
            label="Cycle Remaining"
            value={toHHMM(cycleRemaining)}
            valueClass={cycleRemaining < 8 ? 'text-destructive' : 'text-green-500'}
          />

        </div>

        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-block h-2 w-2 rounded-full bg-muted-foreground/50" />
          {locations.current.label}
          <span>→</span>
          <span className="text-primary font-medium">{locations.pickup.label}</span>
          <span>→</span>
          <span className="text-green-500 font-medium">{locations.dropoff.label}</span>
        </div>

        {hasInitialRestart && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="text-xs text-amber-500">
              A 34-hr restart was required before this trip — your cycle hours were exhausted. Driving begins after the restart.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({
  icon,
  label,
  value,
  valueClass = 'text-foreground',
}: {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className={`text-lg font-semibold leading-none ${valueClass}`}>{value}</p>
    </div>
  )
}
