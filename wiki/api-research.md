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

#### Directions (route between points)
```
POST https://api.openrouteservice.org/v2/directions/driving-hgv
Headers: Authorization: YOUR_KEY
Body: {
  "coordinates": [[lng1, lat1], [lng2, lat2], [lng3, lat3]],
  "units": "mi"
}
```
Returns:
- `routes[0].summary.distance` — total miles
- `routes[0].summary.duration` — total seconds
- `routes[0].geometry` — encoded polyline for map display
- `routes[0].segments` — per-leg breakdown

**Profile:** `driving-hgv` (heavy goods vehicle — most accurate for trucks)

### Key response fields
```json
{
  "routes": [{
    "summary": {
      "distance": 850.2,   // miles (with units=mi)
      "duration": 46800    // seconds
    },
    "geometry": "encoded_polyline_string",
    "segments": [
      {
        "distance": 300.1,
        "duration": 18000,
        "steps": [...]
      }
    ]
  }]
}
```

### Python wrapper plan
```python
class ORSClient:
    BASE = "https://api.openrouteservice.org"

    def geocode(self, address: str) -> tuple[float, float]:
        # returns (lat, lng)
    
    def directions(self, coords: list[tuple]) -> dict:
        # coords = [(lat, lng), ...]
        # returns {distance_miles, duration_hours, geometry, legs}
```

## Leaflet (Frontend Map)
- Library: `react-leaflet` + `leaflet`
- Free, OpenStreetMap tiles
- Display route polyline + stop markers
- No API key needed for OSM tiles

## Notes / Open Questions
- [ ] Do we need intermediate stop routing (waypoints)? ORS supports up to 50 waypoints on free tier
- [ ] ORS geometry is encoded polyline — need to decode for Leaflet (`polyline` npm package)
- [ ] Test geocoding accuracy for city-level inputs (user enters city names, not addresses)

## Last Updated
2026-05-08 — initial research, not yet tested
