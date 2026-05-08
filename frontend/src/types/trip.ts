export interface TripRequest {
  current_location: string
  pickup_location: string
  dropoff_location: string
  current_cycle_hours: number
}

export interface Segment {
  status: 'off_duty' | 'sleeper' | 'driving' | 'on_duty'
  start_hour: number
  end_hour: number
  location: string
  activity: string
}

export interface Bracket {
  start_hour: number
  end_hour: number
  location: string
}

export interface DayTotals {
  off_duty: number
  sleeper: number
  driving: number
  on_duty: number
}

export interface DayLog {
  date: string
  date_offset: number
  segments: Segment[]
  brackets: Bracket[]
  totals: DayTotals
  on_duty_decimal: number
  driving_miles_today: number
}

export interface Stop {
  type: 'current' | 'pickup' | 'dropoff'
  location: string
  lat: number
  lng: number
}

export interface TripResponse {
  total_distance_miles: number
  total_duration_hours: number
  route_geometry: GeoJSON.LineString
  stops: Stop[]
  days: DayLog[]
}

export type AppStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: TripResponse }
  | { status: 'error'; message: string }
