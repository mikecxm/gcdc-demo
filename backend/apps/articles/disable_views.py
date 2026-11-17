from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.conferences.models import Article, ArticleStatus
from apps.users.models import RoleName


class IsCommitteeMember(BasePermission):
    """Solo usuarios autenticados con rol COMITE."""

    message = "Solo los miembros del comité pueden deshabilitar artículos."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.has_role(RoleName.COMITE)
        )


class DisableArticleSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=1000)


class ArticleDisableView(APIView):
    """POST /api/v1/articles/{id}/disable/ : deshabilitación irreversible."""

    permission_classes = [IsCommitteeMember]

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
            article.is_enabled = False
            article.is_permanently_disabled = True
            article.status = ArticleStatus.DESHABILITADO
            article.disabled_reason = serializer.validated_data["reason"]
            article.disabled_at = timezone.now()
            article.save()

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