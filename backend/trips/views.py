from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from .serializers import TripInputSerializer
from .ors_client import geocode, get_route, reverse_geocode
from .hos_calculator import calculate_schedule, RouteGeoRef


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
        except Exception as e:
            return Response({"error": f"Geocoding failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            route = get_route([current_coords, pickup_coords, dropoff_coords])
        except Exception as e:
            return Response({"error": f"Routing failed: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        leg1_miles = route["legs"][0]["distance_miles"]
        leg2_miles = route["legs"][1]["distance_miles"]

        geo_ref = RouteGeoRef(
            coordinates=route["geometry"]["coordinates"],
            total_miles=route["distance_miles"],
        )

        days = calculate_schedule(
            current_location=current_loc,
            pickup_location=pickup_loc,
            dropoff_location=dropoff_loc,
            current_to_pickup_miles=leg1_miles,
            pickup_to_dropoff_miles=leg2_miles,
            current_cycle_hours=cycle_hours,
            geo_ref=geo_ref,
            resolve_location=reverse_geocode,
        )

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
