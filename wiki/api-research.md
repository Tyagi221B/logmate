# API Research

> Notes on external APIs used in this project.

## OpenRouteService (ORS)

**URL:** https://openrouteservice.org/
**Free tier:** 2,000 requests/day, no credit card required
**Sign up:** https://openrouteservice.org/dev/#/signup

### Endpoints we need

#### Geocoding (address → lat/lng)
```
GET https://api.openrouteservice.org/geocode/search
  ?api_key=YOUR_KEY
  &text=Chicago, IL
  &size=1
```
Returns: `features[0].geometry.coordinates` = [lng, lat]

#### Directions (route between points) — LIVE, confirmed working
```
POST https://api.openrouteservice.org/v2/directions/driving-hgv/geojson
Headers: Authorization: YOUR_KEY
Body: {
  "coordinates": [[lng1, lat1], [lng2, lat2], [lng3, lat3]],
  "units": "mi"
}
```
Returns GeoJSON FeatureCollection. Key fields:
- `features[0].properties.summary.distance` — total miles
- `features[0].properties.summary.duration` — total seconds
- `features[0].geometry` — GeoJSON LineString `{type, coordinates: [[lng,lat], ...]}`
- `features[0].properties.segments` — per-leg breakdown (one per waypoint pair)

**Why /geojson?** Returns GeoJSON LineString directly — Leaflet can render it without decoding. The non-`/geojson` variant returns an encoded polyline which needs extra decoding.

**Profile:** `driving-hgv` (heavy goods vehicle — most accurate for trucks, follows truck routes/restrictions)

**Global coverage:** Works for US, India, Europe, etc. Free tier.

### Per-leg response
```json
{
  "features": [{
    "geometry": {
      "type": "LineString",
      "coordinates": [[lng, lat], [lng, lat], ...]
    },
    "properties": {
      "summary": { "distance": 850.2, "duration": 46800 },
      "segments": [
        { "distance": 300.1, "duration": 18000 },
        { "distance": 550.1, "duration": 28800 }
      ]
    }
  }]
}
```

#### Reverse Geocode (lat/lng → city name) — PLANNED, not yet implemented
```
GET https://api.openrouteservice.org/geocode/reverse
  ?api_key=YOUR_KEY
  &point.lat=28.6139
  &point.lon=77.2090
  &size=1
```
Returns same structure as forward geocode: `features[0].properties.label` = "New Delhi, India"

**Will be used for:** naming intermediate stops (fuel, breaks, rest) by interpolating position along route geometry.

## Leaflet (Frontend Map)
- Library: `react-leaflet` + `leaflet`
- Free, OpenStreetMap tiles
- Renders GeoJSON geometry directly as polyline
- No API key needed for OSM tiles

## ORS Rate Limits (Free Tier)
- 2,000 requests/day
- 40 requests/minute
- Forward geocode: 3 calls per trip (current, pickup, dropoff)
- Directions: 1 call per trip
- Reverse geocode (planned): ~10-20 calls per trip (one per stop)
- Total per trip: ~15-25 calls — well within limits

## Last Updated
2026-05-09 — updated to /geojson endpoint (confirmed live), added reverse geocode plan, rate limits
