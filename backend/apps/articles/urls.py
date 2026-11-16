from django.urls import path

from .views import ArticleDetailView, ArticleListView

# Rutas para el módulo articles (GCDC-145: Consulta y listado de artículos con filtros y detalle)
urlpatterns = [
    path("", ArticleListView.as_view(), name="article-list"),
    path("<int:pk>/", ArticleDetailView.as_view(), name="article-detail"),
]
