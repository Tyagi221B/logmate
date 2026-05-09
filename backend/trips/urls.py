from django.urls import path
from .views import TripPlanView, AutocompleteView

urlpatterns = [
    path("trip/", TripPlanView.as_view(), name="trip-plan"),
    path("autocomplete/", AutocompleteView.as_view(), name="autocomplete"),
]
