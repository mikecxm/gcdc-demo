from rest_framework import filters, generics
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend

from apps.conferences.models import Article
from apps.users.models import RoleName

from .filters import ArticleFilter
from .permissions import IsArticleOwnerOrCommitteeOrAdmin
from .serializers import ArticleDetailSerializer


class ArticleListView(generics.ListAPIView):
    """
    GET /api/v1/articles/
    Listado de artículos con soporte de filtros y RBAC:
    - Excluye siempre registros deshabilitados (is_enabled=False).
    - Si el usuario tiene rol AUTOR: lista exclusivamente sus propios artículos.
    - Si el usuario tiene rol COMITE o ADMIN: lista todos los artículos activos.
    """

    serializer_class = ArticleDetailSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_class = ArticleFilter
    search_fields = ["title", "abstract", "keywords"]
    ordering_fields = ["submitted_at", "title", "status"]
    ordering = ["-submitted_at"]

    def get_queryset(self):
        user = self.request.user
        base_qs = (
            Article.objects.filter(is_enabled=True)
            .select_related("thematic_line", "responsible_author")
            .prefetch_related("coauthors", "versions")
        )

        # Comité y Administradores tienen visibilidad global del catálogo activo
        if user.has_role(RoleName.ADMIN) or user.has_role(RoleName.COMITE):
            return base_qs

        # Autores: visibilidad restringida a sus propios artículos
        if user.has_role(RoleName.AUTOR):
            return base_qs.filter(responsible_author=user)

        # Usuarios autenticados sin rol específico asignado
        return base_qs.none()


class ArticleDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/articles/{id}/
    Detalle completo de un artículo:
    - Excluye registros deshabilitados (retorna 404).
    - Comité y Administrador pueden consultar cualquier artículo activo.
    - Autores solo pueden consultar sus propios artículos; si intentan consultar
      un artículo ajeno, se retorna HTTP 403 Forbidden.
    """

    serializer_class = ArticleDetailSerializer
    permission_classes = [IsAuthenticated, IsArticleOwnerOrCommitteeOrAdmin]

    def get_queryset(self):
        return (
            Article.objects.filter(is_enabled=True)
            .select_related("thematic_line", "responsible_author")
            .prefetch_related("coauthors", "versions")
        )
