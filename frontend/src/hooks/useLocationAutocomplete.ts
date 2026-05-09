import { useRef, useState, useCallback } from 'react'
import { fetchAutocomplete, type AutocompleteSuggestion } from '@/lib/api'

const DEBOUNCE_MS = 300
const MIN_CHARS = 3

export function useLocationAutocomplete() {
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cache = useRef<Map<string, AutocompleteSuggestion[]>>(new Map())
  const lastFired = useRef<string>('')
  const abortRef = useRef<AbortController | null>(null)

  const fire = useCallback(async (trimmed: string) => {
    const key = trimmed.toLowerCase()
    lastFired.current = key

    if (cache.current.has(key)) {
      const cached = cache.current.get(key)!
      setSuggestions(cached)
      setIsOpen(cached.length > 0)
      return
    }

    abortRef.current?.abort()
    abortRef.current = new AbortController()

    setIsLoading(true)
    const results = await fetchAutocomplete(trimmed, abortRef.current.signal)
    // discard stale responses if user kept typing
    if (lastFired.current !== key) return
    setIsLoading(false)
    cache.current.set(key, results)
    setSuggestions(results)
    setIsOpen(results.length > 0)
  }, [])

  const query = useCallback((value: string) => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)

    const trimmed = value.trim()

    if (trimmed.length < MIN_CHARS) {
      setSuggestions([])
      setIsOpen(false)
      setIsLoading(false)
      return
    }

    // leading edge: fire immediately if this is a new query (not a rapid keystroke)
    if (lastFired.current === '') {
      fire(trimmed)
      return
    }

    // subsequent keystrokes: debounce
    debounceTimer.current = setTimeout(() => fire(trimmed), DEBOUNCE_MS)
  }, [fire])

  const close = useCallback(() => {
    setSuggestions([])
    setIsOpen(false)
    lastFired.current = ''
  }, [])

  return { suggestions, isLoading, isOpen, query, close }
}
