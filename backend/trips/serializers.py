from rest_framework import serializers


class TripInputSerializer(serializers.Serializer):
    # max_length caps input size at a realistic value — typical autocomplete
    # labels are 20-60 chars (e.g. "Sabar Kantha, Gujarat, India"); 200 is generous.
    # Without this, Django's default DATA_UPLOAD_MAX_MEMORY_SIZE (2.5MB) is the
    # only ceiling, which would tie up a gunicorn worker on a malicious payload.
    current_location = serializers.CharField(max_length=200)
    pickup_location = serializers.CharField(max_length=200)
    dropoff_location = serializers.CharField(max_length=200)
    current_cycle_hours = serializers.FloatField(min_value=0, max_value=70)
