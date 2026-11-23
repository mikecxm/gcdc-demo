from django.contrib.auth import get_user_model
from django.db import models, transaction
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conferences.models import Article, ArticleReviewer, ArticleStatus
from apps.users.models import RoleName
from apps.users.permissions import IsAdminOrCommittee

from .serializers import (
    ReviewerAssignmentInputSerializer,
    ReviewerAssignmentOutputSerializer,
    ReviewerSuggestionSerializer,
)
from .services import get_balanced_reviewer_suggestions, validate_reviewer_conflicts

User = get_user_model()


class AssignReviewersView(APIView):
    """
    POST /api/v1/reviews/assign-reviewers/ (y /api/reviews/assign-reviewers/)
    GCDC-161 (HU-12): Servicio de asignación balanceada de 3 jurados con validación de conflictos.

    Reglas de negocio:
    1. Solo usuarios autenticados con rol ADMIN o COMITE pueden realizar asignaciones.
    2. Cada artículo postulado recibe exactamente 3 miembros del comité científico.
    3. Validación de conflicto de interés: rechaza si el jurado es autor o coautor.
    4. El artículo pasa automáticamente al estado EN_REVISION tras completarse la asignación.
    """

    permission_classes = [IsAuthenticated, IsAdminOrCommittee]

    def post(self, request):
        serializer = ReviewerAssignmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        article_id = data["article_id"]
        reviewer_ids = data["reviewer_ids"]

        # 1. Obtener artículo activo
        try:
            article = Article.objects.select_related("thematic_line", "responsible_author").get(
                pk=article_id, is_enabled=True
            )
        except Article.DoesNotExist:
            return Response(
                {"detail": "Artículo no encontrado o se encuentra deshabilitado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # 2. Verificar que no tenga ya 3 jurados
        existing_assignments = ArticleReviewer.objects.filter(article=article)
        if existing_assignments.count() >= 3:
            return Response(
                {"detail": "Este artículo ya cuenta con exactamente 3 jurados asignados."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 3. Validar conflictos de interés
        conflict_errors = validate_reviewer_conflicts(article, reviewer_ids)
        if conflict_errors:
            error_message = conflict_errors[0] if len(conflict_errors) == 1 else " ; ".join(conflict_errors)
            return Response(
                {
                    "detail": error_message,
                    "errors": conflict_errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # 4. Transacción atómica: asignar los 3 jurados y actualizar estado a EN_REVISION
        with transaction.atomic():
            new_assignments = []
            for reviewer_id in reviewer_ids:
                assignment = ArticleReviewer.objects.create(
                    article=article,
                    reviewer_id=reviewer_id,
                )
                new_assignments.append(assignment)

            article.status = ArticleStatus.EN_REVISION
            article.save(update_fields=["status"])

        output_serializer = ReviewerAssignmentOutputSerializer(new_assignments, many=True)
        return Response(
            {
                "article_id": article.id,
                "article_title": article.title,
                "article_status": article.status,
                "message": "Los 3 jurados fueron asignados con éxito y el artículo cambió al estado EN_REVISION.",
                "assignments": output_serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class SuggestReviewersView(APIView):
    """
    GET /api/v1/reviews/suggest-reviewers/?article_id=<id>
    Retorna sugerencias balanceadas de jurados considerando línea temática y menor carga asignada,
    excluyendo conflictos de interés.
    """

    permission_classes = [IsAuthenticated, IsAdminOrCommittee]

    def get(self, request):
        article_id = request.query_params.get("article_id")
        if not article_id:
            return Response(
                {"detail": "El parámetro article_id es obligatorio."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            article = Article.objects.select_related("thematic_line", "responsible_author").get(
                pk=article_id, is_enabled=True
            )
        except Article.DoesNotExist:
            return Response(
                {"detail": "Artículo no encontrado o deshabilitado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        suggestions = get_balanced_reviewer_suggestions(article)
        serializer = ReviewerSuggestionSerializer(suggestions, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CommitteeMembersListView(APIView):
    """
    GET /api/v1/reviews/committee-members/
    Lista todos los miembros del comité activos con su carga actual de asignaciones.
    Utilizado por el panel frontend de asignación.
    """

    permission_classes = [IsAuthenticated, IsAdminOrCommittee]

    def get(self, request):
        members = (
            User.objects.filter(
                is_active=True,
                deleted_at__isnull=True,
                user_roles__role__name=RoleName.COMITE,
            )
            .annotate(assigned_article_count=models.Count("reviewer_assignments"))
            .order_by("full_name")
            .distinct()
        )

        data = [
            {
                "id": m.id,
                "email": m.email,
                "full_name": m.full_name,
                "affiliation": m.affiliation,
                "roles": ["COMITE"],
                "thematic_lines": [],
                "assigned_article_count": m.assigned_article_count,
            }
            for m in members
        ]
        return Response(data, status=status.HTTP_200_OK)
