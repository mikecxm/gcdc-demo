from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conferences.models import (
    Article,
    ArticleVersion,
    CoAuthor,
    Conference,
    VersionStage,
)
from apps.users.models import RoleName

from . import storage
from .submission_serializers import ArticleSerializer, ArticleSubmissionSerializer

BOGOTA = ZoneInfo("America/Bogota")


class IsAuthor(BasePermission):
    """Solo usuarios autenticados con rol AUTOR pueden postular artículos."""

    message = "Solo los autores pueden postular artículos."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_role(RoleName.AUTOR)
        )


class ArticleSubmissionView(APIView):
    """POST /api/v1/articles/ : postulación inicial de un artículo con PDF."""

    permission_classes = [IsAuthor]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        # Finish reading multipart before replying: large clients may otherwise
        # wait for the connection to close after an early deadline rejection.
        # Check the clock after receiving the upload, before storing any data.
        payload = request.data
        conference = Conference.objects.order_by("-event_start_date").first()
        if conference is None:
            return Response(
                {"detail": "No hay una conferencia configurada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = timezone.now().astimezone(BOGOTA).date()
        if today > conference.submission_deadline:
            return Response(
                {"detail": "El plazo de postulación ya venció."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = ArticleSubmissionSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        uploaded_path = None
        try:
            with transaction.atomic():
                article = Article.objects.create(
                    title=data["title"],
                    abstract=data["abstract"],
                    keywords=data["keywords"],
                    thematic_line=data["thematic_line"],
                    responsible_author=request.user,
                )
                for coauthor in data["coauthors"]:
                    CoAuthor.objects.create(article=article, **coauthor)

                path = f"articles/{article.id}/v1.pdf"
                storage.upload_pdf(path, data["pdf"].read())
                uploaded_path = path

                ArticleVersion.objects.create(
                    article=article,
                    version_number=1,
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
            ArticleSerializer(article).data, status=status.HTTP_201_CREATED
        )
