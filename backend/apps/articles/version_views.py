from django.db import transaction
from django.db.models import Max
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conferences.models import (
    Article,
    ArticleStatus,
    ArticleVersion,
    Conference,
    VersionStage,
)

from . import storage
from .submission_serializers import ArticleSubmissionSerializer
from .submission_views import BOGOTA, IsAuthor


class PdfUploadSerializer(serializers.Serializer):
    pdf = serializers.FileField()
    # Mismas reglas del PDF que en la postulación (tipo, firma %PDF- y 10 MB).
    validate_pdf = ArticleSubmissionSerializer.validate_pdf


class ArticleVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ArticleVersion
        fields = ["id", "version_number", "stage", "uploaded_at"]


class ArticleVersionView(APIView):
    """GET y POST /api/v1/articles/{id}/versions/ (historial y reemplazo del PDF)."""

    permission_classes = [IsAuthor]
    parser_classes = [MultiPartParser, FormParser]

    NOT_OWNER = {"detail": "Solo el autor responsable puede hacer esto."}

    def get(self, request, pk):
        article = get_object_or_404(Article, pk=pk)
        if article.responsible_author_id != request.user.id:
            return Response(self.NOT_OWNER, status=status.HTTP_403_FORBIDDEN)
        versions = article.versions.order_by("version_number")
        return Response(ArticleVersionSerializer(versions, many=True).data)

    def post(self, request, pk):
        article = get_object_or_404(Article, pk=pk)
        if article.responsible_author_id != request.user.id:
            return Response(self.NOT_OWNER, status=status.HTTP_403_FORBIDDEN)

        conference = Conference.objects.order_by("-event_start_date").first()
        if conference is None:
            return Response(
                {"detail": "No hay una conferencia configurada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        today = timezone.now().astimezone(BOGOTA).date()
        if today > conference.submission_deadline:
            return Response(
                {"detail": "El plazo para actualizar el PDF ya venció."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = PdfUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        pdf = serializer.validated_data["pdf"]

        uploaded_path = None
        try:
            with transaction.atomic():
                # Bloquea el artículo para que dos subidas no usen el mismo número.
                article = Article.objects.select_for_update().get(pk=pk)
                if not article.is_enabled or article.status != ArticleStatus.POSTULADO:
                    return Response(
                        {"detail": "El artículo ya no admite cambios de PDF."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                last = article.versions.aggregate(last=Max("version_number"))["last"]
                number = (last or 0) + 1

                path = f"articles/{article.id}/v{number}.pdf"
                storage.upload_pdf(path, pdf.read())
                uploaded_path = path

                version = ArticleVersion.objects.create(
                    article=article,
                    version_number=number,
                    stage=VersionStage.INICIAL,
                    pdf_url=path,
                )
        except Exception:
            if uploaded_path:
                try:
                    storage.delete_file(uploaded_path)
                except Exception:
                    pass
            raise

        return Response(
            ArticleVersionSerializer(version).data, status=status.HTTP_201_CREATED
        )