from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conferences.models import Article, ArticleMetadataAudit, ArticleStatus
from apps.users.permissions import IsAdminOrCommittee


class DisableArticleSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class ArticleDisableView(APIView):
    """POST /api/v1/articles/{id}/disable/ : deshabilitación irreversible."""

    permission_classes = [IsAdminOrCommittee]

    def post(self, request, pk):
        serializer = DisableArticleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        with transaction.atomic():
            article = get_object_or_404(Article.objects.select_for_update(), pk=pk)
            if not article.is_enabled:
                return Response(
                    {"detail": "El artículo ya está deshabilitado."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            old_values = {
                "is_enabled": str(article.is_enabled),
                "status": article.status,
                "disabled_reason": article.disabled_reason,
                "disabled_at": (
                    article.disabled_at.isoformat() if article.disabled_at else None
                ),
            }
            reason = serializer.validated_data["reason"]
            disabled_at = timezone.now()
            article.is_enabled = False
            article.is_permanently_disabled = True
            article.status = ArticleStatus.DESHABILITADO
            article.disabled_reason = reason
            article.disabled_at = disabled_at
            article.save()
            new_values = {
                "is_enabled": str(article.is_enabled),
                "status": article.status,
                "disabled_reason": article.disabled_reason,
                "disabled_at": disabled_at.isoformat(),
                "disabled_by": request.user.email,
            }
            ArticleMetadataAudit.objects.bulk_create(
                [
                    ArticleMetadataAudit(
                        article=article,
                        field_name=field_name,
                        old_value=old_values.get(field_name),
                        new_value=new_value,
                    )
                    for field_name, new_value in new_values.items()
                ]
            )

        return Response(
            {
                "id": article.id,
                "status": article.status,
                "is_enabled": article.is_enabled,
                "disabled_reason": article.disabled_reason,
                "disabled_at": article.disabled_at,
            },
            status=status.HTTP_200_OK,
        )