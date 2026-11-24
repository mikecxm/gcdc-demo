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
    """Assign exactly three eligible committee members to a submitted article."""

    permission_classes = [IsAuthenticated, IsAdminOrCommittee]

    def post(self, request):
        serializer = ReviewerAssignmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        article_id = serializer.validated_data["article_id"]
        reviewer_ids = serializer.validated_data["reviewer_ids"]

        with transaction.atomic():
            # Serialize concurrent requests for the same article. Without this lock,
            # two requests can both see zero assignments and create six reviewers.
            try:
                article = Article.objects.select_for_update().get(
                    pk=article_id, is_enabled=True
                )
            except Article.DoesNotExist:
                return Response(
                    {"detail": "Artículo no encontrado o deshabilitado."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            if article.status != ArticleStatus.POSTULADO:
                return Response(
                    {
                        "detail": (
                            "El artículo debe estar en estado POSTULADO para asignar jurados. "
                            f"Estado actual: {article.status}."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            existing_count = ArticleReviewer.objects.filter(article=article).count()
            if existing_count:
                return Response(
                    {
                        "detail": (
                            "La asignación debe realizarse de una sola vez: "
                            f"el artículo ya tiene {existing_count} jurado(s)."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            conflict_errors = validate_reviewer_conflicts(article, reviewer_ids)
            if conflict_errors:
                return Response(
                    {"detail": conflict_errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            assignments = [
                ArticleReviewer.objects.create(article=article, reviewer_id=reviewer_id)
                for reviewer_id in reviewer_ids
            ]
            article.status = ArticleStatus.EN_REVISION
            article.save(update_fields=["status"])

        output_serializer = ReviewerAssignmentOutputSerializer(assignments, many=True)
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
    """Suggest committee members balanced by assignment count, excluding conflicts."""

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
        except (Article.DoesNotExist, ValueError):
            return Response(
                {"detail": "Artículo no encontrado o deshabilitado."},
                status=status.HTTP_404_NOT_FOUND,
            )

        candidates = get_balanced_reviewer_suggestions(article)
        return Response(
            ReviewerSuggestionSerializer(candidates, many=True).data,
            status=status.HTTP_200_OK,
        )
