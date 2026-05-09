from django.urls import path
from .views import TripPlanView, AutocompleteView, HealthView

urlpatterns = [
    path("trip/", TripPlanView.as_view(), name="trip-plan"),
    path("autocomplete/", AutocompleteView.as_view(), name="autocomplete"),
    path("health/", HealthView.as_view(), name="health"),
]
