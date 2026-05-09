import { useRef, useState, type KeyboardEvent } from 'react'
import type { Control, FieldPath, FieldValues } from 'react-hook-form'
import { useController } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { useLocationAutocomplete } from '@/hooks/useLocationAutocomplete'

interface Props<T extends FieldValues> {
  name: FieldPath<T>
  control: Control<T>
  placeholder?: string
  disabled?: boolean
}

export function LocationInput<T extends FieldValues>({ name, control, placeholder, disabled }: Props<T>) {
  const { field } = useController({ name, control })
  const { suggestions, isLoading, isOpen, query, close } = useLocationAutocomplete()
  const [activeIdx, setActiveIdx] = useState(-1)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    field.onChange(e)
    setActiveIdx(-1)
    query(e.target.value)
  }

  function handleSelect(label: string) {
    field.onChange(label)
    close()
    setActiveIdx(-1)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!isOpen) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIdx].label)
    } else if (e.key === 'Escape') {
      close()
    }
  }

  function handleBlur() {
    // delay so click on suggestion fires before dropdown closes
    blurTimer.current = setTimeout(close, 150)
  }

  function handleSuggestionMouseDown() {
    // cancel blur close so the click registers
    if (blurTimer.current) clearTimeout(blurTimer.current)
  }

  return (
    <div className="relative">
      <Input
        {...field}
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      />

      {(isOpen || isLoading) && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-border bg-popover shadow-md">
          {isLoading && (
            <li className="px-3 py-2 text-sm text-muted-foreground">Loading…</li>
          )}
          {!isLoading && suggestions.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted-foreground">No results found</li>
          )}
          {!isLoading && suggestions.map((s, i) => (
            <li
              key={s.label}
              onMouseDown={handleSuggestionMouseDown}
              onClick={() => handleSelect(s.label)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              {s.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
