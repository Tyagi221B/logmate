import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { planTrip, normalizeError } from '@/lib/api'
import type { TripRequest, TripResponse, AppStatus } from '@/types/trip'
import TripForm from '@/components/TripForm'

export default function App() {
  const [state, setState] = useState<AppStatus>({ status: 'idle' })
  const abortRef = useRef<AbortController | null>(null)

  async function handleSubmit(req: TripRequest) {
    abortRef.current?.abort()
    abortRef.current = new AbortController()

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
        <TripForm onSubmit={handleSubmit} loading={isLoading} />
      )}
      {state.status === 'success' && (
        <Results data={state.data} onReset={handleReset} />
      )}
    </div>
  )
}

function Results({ data, onReset }: { data: TripResponse; onReset: () => void }) {
  return (
    <div className="p-8">
      <p className="text-muted-foreground">{data.days.length} day(s) — map + log sheets coming next</p>
      <button onClick={onReset} className="mt-4 text-primary underline">Plan another trip</button>
    </div>
  )
}
