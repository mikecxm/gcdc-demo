from django.urls import path

from .submission_views import ArticleSubmissionView
from .version_views import ArticleVersionView

# Rutas para el módulo articles (postulaciones, versiones de artículos, coautores)
urlpatterns = [
    path("", ArticleSubmissionView.as_view(), name="article-submission"),
    path("<int:pk>/versions/", ArticleVersionView.as_view(), name="article-versions"),
]