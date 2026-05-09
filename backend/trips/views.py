from concurrent.futures import ThreadPoolExecutor

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripInputSerializer
from .ors_client import (geocode, get_route, reverse_geocode, autocomplete,
                         LocationNotFoundError, RoutingError, RateLimitError, ServiceUnavailableError)
from .hos_calculator import calculate_schedule, RouteGeoRef


class LocationCollector:
    """
    Phase 1: collect (lat, lng) positions during the HOS calculation run.
    Phase 2: resolve all positions to city names in parallel, then substitute.
    """

    def __init__(self) -> None:
        self._positions: dict[str, tuple[float, float]] = {}
        self._counter = 0

    def collect(self, lat: float, lng: float) -> str:
        key = f"__geo_{self._counter}__"
        self._positions[key] = (lat, lng)
        self._counter += 1
        return key

    def resolve_all(self, resolve_fn, max_workers: int = 8) -> dict[str, str]:
        if not self._positions:
            return {}

        # Deduplicate: group keys by rounded coordinate — one API call per unique position
        coord_to_first_key: dict[tuple[float, float], str] = {}
        for key, (lat, lng) in self._positions.items():
            coord = (round(lat, 3), round(lng, 3))
            if coord not in coord_to_first_key:
                coord_to_first_key[coord] = key

        # unique = [(rounded_coord, (lat, lng))] — one entry per unique position
        unique = [(coord, self._positions[first_key])
                  for coord, first_key in coord_to_first_key.items()]

        # Resolve all unique positions in parallel
        def _resolve_one(item: tuple) -> tuple[tuple, str]:
            coord, (lat, lng) = item
            return coord, resolve_fn(lat, lng) or "En Route"

        workers = min(max_workers, len(unique))
        with ThreadPoolExecutor(max_workers=workers) as pool:
            coord_to_city: dict[tuple, str] = dict(pool.map(_resolve_one, unique))

        # Expand back: every key gets the city resolved for its coordinate
        return {
            key: coord_to_city[(round(lat, 3), round(lng, 3))]
            for key, (lat, lng) in self._positions.items()
        }


def _substitute_locations(days: list[dict], mapping: dict[str, str]) -> None:
    """Replace placeholder geo keys with real city names in-place."""
    if not mapping:
        return

    def sub(value: str) -> str:
        return mapping.get(value, value)

    for day in days:
        day["day_start_location"] = sub(day["day_start_location"])
        day["day_end_location"] = sub(day["day_end_location"])
        for seg in day["segments"]:
            seg["location"] = sub(seg["location"])
        for bracket in day["brackets"]:
            bracket["location"] = sub(bracket["location"])


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "version": "1.0.0"})


class AutocompleteView(APIView):
    def get(self, request):
        q = request.GET.get("q", "").strip()
        if len(q) < 3:
            return Response([])
        return Response(autocomplete(q))


class TripPlanView(APIView):
    def post(self, request):
        serializer = TripInputSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        current_loc = data["current_location"]
        pickup_loc = data["pickup_location"]
        dropoff_loc = data["dropoff_location"]
        cycle_hours = data["current_cycle_hours"]

        try:
            current_coords = geocode(current_loc)
            pickup_coords = geocode(pickup_loc)
            dropoff_coords = geocode(dropoff_loc)
        except LocationNotFoundError as e:
            return Response({"error": f"Location not found: '{e.address}'. Try being more specific (e.g. 'Chicago, IL')."}, status=422)
        except RateLimitError:
            return Response({"error": "Too many requests. Please wait a moment and try again."}, status=429)
        except ServiceUnavailableError:
            return Response({"error": "Routing service temporarily unavailable. Please try again shortly."}, status=503)

        try:
            route = get_route([current_coords, pickup_coords, dropoff_coords])
        except RoutingError:
            return Response({"error": "Could not calculate a route between the given locations. Check that all locations are reachable by road."}, status=422)
        except RateLimitError:
            return Response({"error": "Too many requests. Please wait a moment and try again."}, status=429)
        except ServiceUnavailableError:
            return Response({"error": "Routing service temporarily unavailable. Please try again shortly."}, status=503)

        leg1_miles = route["legs"][0]["distance_miles"]
        leg2_miles = route["legs"][1]["distance_miles"]

        geo_ref = RouteGeoRef(
            coordinates=route["geometry"]["coordinates"],
            total_miles=route["distance_miles"],
        )

        # Phase 1: run calculator — positions collected as placeholder keys, no network calls
        collector = LocationCollector()
        days = calculate_schedule(
            current_location=current_loc,
            pickup_location=pickup_loc,
            dropoff_location=dropoff_loc,
            current_to_pickup_miles=leg1_miles,
            pickup_to_dropoff_miles=leg2_miles,
            current_cycle_hours=cycle_hours,
            geo_ref=geo_ref,
            resolve_location=collector.collect,
        )

        # Phase 2: resolve all positions in parallel, substitute back into output
        mapping = collector.resolve_all(reverse_geocode)
        _substitute_locations(days, mapping)

        return Response({
            "route": {
                "total_distance_miles": route["distance_miles"],
                "total_duration_hours": route["duration_hours"],
                "geometry": route["geometry"],
                "legs": route["legs"],
            },
            "locations": {
                "current": {"lat": current_coords[0], "lng": current_coords[1], "label": current_loc},
                "pickup": {"lat": pickup_coords[0], "lng": pickup_coords[1], "label": pickup_loc},
                "dropoff": {"lat": dropoff_coords[0], "lng": dropoff_coords[1], "label": dropoff_loc},
            },
            "days": days,
        })
