import requests
from django.conf import settings

ORS_BASE = "https://api.openrouteservice.org"


class LocationNotFoundError(Exception):
    def __init__(self, address: str):
        self.address = address
        super().__init__(f"Location not found: '{address}'")


class RoutingError(Exception):
    pass


class RateLimitError(Exception):
    pass


class ServiceUnavailableError(Exception):
    pass


def geocode(address: str) -> tuple[float, float]:
    """Convert a city/address string to (lat, lng)."""
    try:
        resp = requests.get(
            f"{ORS_BASE}/geocode/search",
            params={"api_key": settings.ORS_API_KEY, "text": address, "size": 1},
            timeout=10,
        )
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
        raise ServiceUnavailableError()

    if resp.status_code == 429:
        raise RateLimitError()
    if not resp.ok:
        raise ServiceUnavailableError()

    features = resp.json().get("features", [])
    if not features:
        raise LocationNotFoundError(address)
    lng, lat = features[0]["geometry"]["coordinates"]
    return lat, lng


def autocomplete(q: str) -> list[dict]:
    """Return up to 5 location suggestions for a partial query string."""
    try:
        resp = requests.get(
            f"{ORS_BASE}/geocode/autocomplete",
            params={
                "api_key": settings.ORS_API_KEY,
                "text": q,
                "size": 5,
                "layers": "locality",
            },
            timeout=5,
        )
        if not resp.ok:
            return []
        features = resp.json().get("features", [])
        results = []
        for f in features:
            props = f.get("properties", {})
            lng, lat = f["geometry"]["coordinates"]
            city = props.get("locality") or props.get("county") or ""
            country_a = props.get("country_a", "")
            state = (props.get("region_a") if country_a == "USA" else props.get("region")) or ""
            country = props.get("country", "")
            if city and state and country:
                label = f"{city}, {state}, {country}"
            elif city and state:
                label = f"{city}, {state}"
            else:
                label = props.get("label", "")
            if label:
                results.append({"label": label, "lat": lat, "lng": lng})
        return results
    except Exception:
        return []


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
            city = props.get("locality") or props.get("county") or ""
            country = props.get("country_a", "")
            state = (props.get("region_a") if country == "USA" else props.get("region")) or ""
            if city and state:
                return f"{city}, {state}"
            return city or state or props.get("label", "")
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
    try:
        resp = requests.post(
            f"{ORS_BASE}/v2/directions/driving-hgv/geojson",
            headers={"Authorization": settings.ORS_API_KEY},
            json={"coordinates": ors_coords, "units": "mi"},
            timeout=15,
        )
    except (requests.exceptions.Timeout, requests.exceptions.ConnectionError):
        raise ServiceUnavailableError()

    if resp.status_code == 429:
        raise RateLimitError()
    if resp.status_code >= 500:
        raise ServiceUnavailableError()
    if not resp.ok:
        raise RoutingError()
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
