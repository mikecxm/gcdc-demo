from django.db import transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conferences.models import Article, ArticleReviewer, ArticleStatus
from apps.users.permissions import IsAdminOrCommittee

from .serializers import (
    ReviewerAssignmentInputSerializer,
    ReviewerAssignmentOutputSerializer,
    ReviewerSuggestionSerializer,
)
from .services import get_balanced_reviewer_suggestions, validate_reviewer_conflicts


class AssignReviewersView(APIView):
    """
    POST /api/v1/reviews/assign-reviewers/
    GCDC-161 (HU-12): Asignación de exactamente 3 jurados evaluadores a un artículo.

    Lógica:
    - Solo usuarios con rol ADMIN o COMITE pueden realizar asignaciones.
    - Valida conflictos de interés (autor, coautores, ya asignados, rol COMITE).
    - Crea las 3 asignaciones en ArticleReviewer.
    - Cambia el estado del artículo a EN_REVISION.
    """

    permission_classes = [IsAuthenticated, IsAdminOrCommittee]

    def post(self, request):
        serializer = ReviewerAssignmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        article_id = data["article_id"]
        reviewer_ids = data["reviewer_ids"]

        # 1. Buscar artículo activo y en estado válido
        try:
            article = Article.objects.get(pk=article_id, is_enabled=True)
        except Article.DoesNotExist:
            return Response(
                {"detail": "Artículo no encontrado o deshabilitado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if article.status != ArticleStatus.POSTULADO:
            return Response(
                {
                    "detail": f"El artículo debe estar en estado POSTULADO para asignar jurados. "
                    f"Estado actual: {article.status}."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 2. Verificar que el artículo no tenga ya 3 jurados
        existing_count = ArticleReviewer.objects.filter(article=article).count()
        if existing_count >= 3:
            return Response(
                {"detail": "Este artículo ya tiene 3 jurados asignados."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Validar conflictos de interés
        conflict_errors = validate_reviewer_conflicts(article, reviewer_ids)
        if conflict_errors:
            return Response(
                {"detail": conflict_errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Crear asignaciones y actualizar estado del artículo
        with transaction.atomic():
            assignments = []
            for reviewer_id in reviewer_ids:
                assignment = ArticleReviewer.objects.create(
                    article=article,
                    reviewer_id=reviewer_id,
                )
                assignments.append(assignment)

            article.status = ArticleStatus.EN_REVISION
            article.save(update_fields=["status"])

        # 5. Serializar respuesta
        output_serializer = ReviewerAssignmentOutputSerializer(
            assignments, many=True
        )
        return Response(
            {
                "article_id": article.id,
                "article_title": article.title,
                "article_status": article.status,
                "assignments": output_serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class SuggestReviewersView(APIView):
    """
    GET /api/v1/reviews/suggest-reviewers/?article_id=<id>
    Sugiere jurados balanceados por carga de trabajo, excluyendo conflictos de interés.
    """

    permission_classes = [IsAuthenticated, IsAdminOrCommittee]

    def get(self, request):
        article_id = request.query_params.get("article_id")
        if not article_id:
            return Response(
                {"detail": "Se requiere el parámetro article_id."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            article = Article.objects.get(pk=article_id, is_enabled=True)
        except Article.DoesNotExist:
            return Response(
                {"detail": "Artículo no encontrado o deshabilitado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        candidates = get_balanced_reviewer_suggestions(article)
        serializer = ReviewerSuggestionSerializer(candidates, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
