from django.urls import path

from .disable_views import ArticleDisableView

# Rutas para el módulo articles (postulaciones, versiones de artículos, coautores)
urlpatterns = [
    path("<int:pk>/disable/", ArticleDisableView.as_view(), name="article-disable"),
]