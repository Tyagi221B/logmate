import type { TripRequest, TripResponse } from '@/types/trip'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
const TIMEOUT_MS = 10_000

class ApiError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'ApiError'
  }
}

export function normalizeError(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.status === 400) return "Couldn't find one or more locations. Try being more specific (e.g. \"Chicago, IL\")."
    if (err.status === 429) return 'Too many requests. Please wait a moment and try again.'
    if (err.status === 503) return 'Routing service is temporarily unavailable. Please try again shortly.'
    return `Request failed (${err.status}). Please try again.`
  }
  if (err instanceof DOMException && err.name === 'AbortError') {
    return 'Request timed out. Check your connection and try again.'
  }
  if (err instanceof TypeError) {
    return 'Could not reach the server. Check your connection and try again.'
  }
  return 'Something went wrong. Please try again.'
}

export async function planTrip(req: TripRequest, signal?: AbortSignal): Promise<TripResponse> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS)
  const combined = signal
    ? AbortSignal.any([signal, timeout])
    : timeout

  const res = await fetch(`${BASE_URL}/api/trip/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
    signal: combined,
  })

  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json() as Record<string, unknown>
      if (typeof body.error === 'string') message = body.error
      else if (typeof body.detail === 'string') message = body.detail
    } catch {
      // use statusText fallback
    }
    throw new ApiError(res.status, message)
  }

  return res.json() as Promise<TripResponse>
}
