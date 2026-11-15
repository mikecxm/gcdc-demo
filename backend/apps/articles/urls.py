from django.urls import path

from .submission_views import ArticleSubmissionView

# Rutas para el módulo articles (postulaciones, versiones de artículos, coautores)
urlpatterns = [
    path("", ArticleSubmissionView.as_view(), name="article-submission"),
]