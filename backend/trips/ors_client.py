import requests
from django.conf import settings

ORS_BASE = "https://api.openrouteservice.org"


def geocode(address: str) -> tuple[float, float]:
    """Convert a city/address string to (lat, lng)."""
    resp = requests.get(
        f"{ORS_BASE}/geocode/search",
        params={"api_key": settings.ORS_API_KEY, "text": address, "size": 1},
        timeout=10,
    )
    resp.raise_for_status()
    features = resp.json().get("features", [])
    if not features:
        raise ValueError(f"Could not geocode address: {address}")
    lng, lat = features[0]["geometry"]["coordinates"]
    return lat, lng


def reverse_geocode(lat: float, lng: float) -> str:
    """Convert (lat, lng) to a city/place string. Returns '' on failure."""
    try:
        resp = requests.get(
            f"{ORS_BASE}/geocode/reverse",
            params={"api_key": settings.ORS_API_KEY, "point.lat": lat, "point.lon": lng, "size": 1},
            timeout=5,
        )
        resp.raise_for_status()
        features = resp.json().get("features", [])
        if features:
            props = features[0].get("properties", {})
            label = props.get("locality") or props.get("county") or props.get("region") or props.get("label", "")
            return label
    except Exception:
        pass
    return ""


def get_route(coords: list[tuple[float, float]]) -> dict:
    """
    Get route between multiple points.
    coords: list of (lat, lng) tuples — current, pickup, dropoff
    Returns: { distance_miles, duration_hours, geometry, legs }
    """
    # ORS expects [lng, lat] order
    ors_coords = [[lng, lat] for lat, lng in coords]

    # Use /geojson endpoint to get GeoJSON LineString directly
    resp = requests.post(
        f"{ORS_BASE}/v2/directions/driving-hgv/geojson",
        headers={"Authorization": settings.ORS_API_KEY},
        json={"coordinates": ors_coords, "units": "mi"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    feature = data["features"][0]
    props = feature["properties"]

    legs = []
    for segment in props["segments"]:
        legs.append({
            "distance_miles": round(segment["distance"], 2),
            "duration_hours": round(segment["duration"] / 3600, 4),
        })

    return {
        "distance_miles": round(props["summary"]["distance"], 2),
        "duration_hours": round(props["summary"]["duration"] / 3600, 4),
        "geometry": feature["geometry"],   # GeoJSON LineString {type, coordinates: [[lng,lat],...]}
        "legs": legs,
    }
