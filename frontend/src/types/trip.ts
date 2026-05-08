export interface TripRequest {
  current_location: string
  pickup_location: string
  dropoff_location: string
  current_cycle_hours: number
}

// ---------- HOS schedule types ----------

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

// ---------- Route / location types ----------

export interface RouteLocation {
  lat: number
  lng: number
  label: string
}

export interface RouteLeg {
  distance_miles: number
  duration_hours: number
}

export interface Route {
  total_distance_miles: number
  total_duration_hours: number
  geometry: GeoJSON.LineString   // [lng, lat] pairs — GeoJSON order
  legs: RouteLeg[]
}

export interface TripLocations {
  current: RouteLocation
  pickup: RouteLocation
  dropoff: RouteLocation
}

// ---------- Full API response ----------

export interface TripResponse {
  route: Route
  locations: TripLocations
  days: DayLog[]
}

// ---------- App state machine ----------

export type AppStatus =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: TripResponse }
  | { status: 'error'; message: string }
