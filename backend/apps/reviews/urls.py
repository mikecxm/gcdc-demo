from django.urls import path

from .views import (
    AssignReviewersView,
    CommitteeMembersListView,
    SuggestReviewersView,
)

# Rutas para el módulo reviews (GCDC-161: Asignación de jurados, HU-12)
urlpatterns = [
    path("assign-reviewers/", AssignReviewersView.as_view(), name="assign-reviewers"),
    path("suggest-reviewers/", SuggestReviewersView.as_view(), name="suggest-reviewers"),
    path("committee-members/", CommitteeMembersListView.as_view(), name="committee-members-list"),
]
