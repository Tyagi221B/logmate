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


def get_route(coords: list[tuple[float, float]]) -> dict:
    """
    Get route between multiple points.
    coords: list of (lat, lng) tuples — current, pickup, dropoff
    Returns: { distance_miles, duration_hours, geometry, legs }
    """
    # ORS expects [lng, lat] order
    ors_coords = [[lng, lat] for lat, lng in coords]

    resp = requests.post(
        f"{ORS_BASE}/v2/directions/driving-hgv",
        headers={"Authorization": settings.ORS_API_KEY},
        json={"coordinates": ors_coords, "units": "mi"},
        timeout=15,
    )
    resp.raise_for_status()
    data = resp.json()
    route = data["routes"][0]

    legs = []
    for segment in route["segments"]:
        legs.append({
            "distance_miles": round(segment["distance"], 2),
            "duration_hours": round(segment["duration"] / 3600, 4),
        })

    return {
        "distance_miles": round(route["summary"]["distance"], 2),
        "duration_hours": round(route["summary"]["duration"] / 3600, 4),
        "geometry": route["geometry"],
        "legs": legs,
    }
