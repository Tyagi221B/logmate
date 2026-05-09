import { useEffect } from 'react'
import { MapContainer, TileLayer, Polyline, Marker, Popup, useMap } from 'react-leaflet'
import { divIcon, latLngBounds } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Route, TripLocations } from '@/types/trip'

interface Props {
  route: Route
  locations: TripLocations
}

// GeoJSON is [lng, lat] — Leaflet needs [lat, lng]
function geoJsonToLatLng(geometry: Route['geometry']): [number, number][] {
  return geometry.coordinates.map(([lng, lat]) => [lat, lng])
}

function makeIcon(color: string, label: string) {
  return divIcon({
    className: '',
    html: `
      <div style="
        background:${color};
        color:#000;
        width:28px;height:28px;
        border-radius:50%;
        border:2px solid rgba(0,0,0,0.4);
        display:flex;align-items:center;justify-content:center;
        font-size:11px;font-weight:700;font-family:sans-serif;
        box-shadow:0 2px 6px rgba(0,0,0,0.4);
      ">${label}</div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (positions.length < 2) return
    const bounds = latLngBounds(positions)
    map.fitBounds(bounds, { padding: [40, 40] })
  }, [map, positions])
  return null
}

export default function RouteMap({ route, locations }: Props) {
  const positions = geoJsonToLatLng(route.geometry)
  const center: [number, number] = [locations.current.lat, locations.current.lng]

  const legend = [
    { color: '#9ca3af', label: 'C', text: 'Current Location' },
    { color: '#f97316', label: 'P', text: 'Pickup' },
    { color: '#22c55e', label: 'D', text: 'Dropoff' },
  ]

  return (
    <div className="w-full space-y-2">
      <div className="overflow-hidden rounded-xl border border-border" style={{ height: 320 }}>
        <MapContainer
          center={center}
          zoom={6}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
          />

          {/* Route polyline — orange to match theme */}
          <Polyline
            positions={positions}
            pathOptions={{ color: '#f97316', weight: 4, opacity: 0.9 }}
          />

          <FitBounds positions={positions} />

          {/* Current location — grey */}
          <Marker position={[locations.current.lat, locations.current.lng]} icon={makeIcon('#9ca3af', 'C')}>
            <Popup><strong>Current:</strong> {locations.current.label}</Popup>
          </Marker>

          {/* Pickup — orange */}
          <Marker position={[locations.pickup.lat, locations.pickup.lng]} icon={makeIcon('#f97316', 'P')}>
            <Popup><strong>Pickup:</strong> {locations.pickup.label}</Popup>
          </Marker>

          {/* Dropoff — green */}
          <Marker position={[locations.dropoff.lat, locations.dropoff.lng]} icon={makeIcon('#22c55e', 'D')}>
            <Popup><strong>Dropoff:</strong> {locations.dropoff.label}</Popup>
          </Marker>
        </MapContainer>
      </div>

      <div className="flex gap-4 px-1">
        {legend.map(({ color, label, text }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div style={{ background: color }} className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-black">
              {label}
            </div>
            <span className="text-xs text-muted-foreground">{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
