from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView

from apps.conferences.models import Article
from . import storage
from .permissions import IsArticleOwnerOrCommitteeOrAdmin


class ArticlePdfDownloadView(APIView):
    """Descarga la última versión o una versión indicada por número."""

    permission_classes = [IsArticleOwnerOrCommitteeOrAdmin]

    def get(self, request, pk):
        article = get_object_or_404(Article, pk=pk, is_enabled=True)
        self.check_object_permissions(request, article)
        version_number = request.query_params.get("version_number")
        if version_number is None:
            version = article.versions.order_by("-version_number").first()
        else:
            try:
                version_number = int(version_number)
            except ValueError as error:
                raise Http404("La versión solicitada no existe.") from error
            version = article.versions.filter(version_number=version_number).first()
        if version is None:
            raise Http404("El articulo no tiene PDF.")
        try:
            pdf = storage.open_pdf(version.pdf_url)
        except FileNotFoundError:
            raise Http404("El PDF no esta disponible.")
        return FileResponse(
            pdf,
            as_attachment=True,
            filename=f"article-{article.pk}-v{version.version_number}.pdf",
            content_type="application/pdf",
        )
