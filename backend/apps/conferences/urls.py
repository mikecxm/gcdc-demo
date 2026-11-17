from django.urls import path

from .views import ThematicLineListView

# Rutas para el módulo conferences (ediciones de conferencias, líneas temáticas)
urlpatterns = [
    path("thematic-lines/", ThematicLineListView.as_view(), name="thematic-lines"),
]