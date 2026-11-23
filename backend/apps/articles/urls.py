from django.urls import path
from django.views.decorators.csrf import csrf_exempt

from .disable_views import ArticleDisableView
from .download_views import ArticlePdfDownloadView
from .submission_views import ArticleSubmissionView
from .version_views import ArticleVersionView
from .views import ArticleDetailView, ArticleListView


@csrf_exempt
def article_collection(request, *args, **kwargs):
    """GET lista los artículos (HU-08); POST postula un artículo (HU-07)."""
    view = ArticleSubmissionView if request.method == "POST" else ArticleListView
    return view.as_view()(request, *args, **kwargs)


# Rutas para el módulo articles (consulta, postulación, versiones y deshabilitación)
urlpatterns = [
    path("", article_collection, name="article-list"),
    path("<int:pk>/", ArticleDetailView.as_view(), name="article-detail"),
    path("<int:pk>/disable/", ArticleDisableView.as_view(), name="article-disable"),
    path("<int:pk>/versions/", ArticleVersionView.as_view(), name="article-versions"),
    path("<int:pk>/pdf/", ArticlePdfDownloadView.as_view(), name="article-pdf"),
]
