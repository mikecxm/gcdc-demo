from zoneinfo import ZoneInfo
from django.utils import timezone
from rest_framework import filters, generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.conferences.models import Article, Conference
from apps.users.models import RoleName

from .filters import ArticleFilter
from .permissions import (
    IsArticleAuthor,
    IsArticleOwnerOrCommitteeOrAdmin,
    get_active_role,
)
from .serializers import ArticleDetailSerializer, ArticleUpdateSerializer


class ArticleListView(generics.ListAPIView):
    """
    GET /api/v1/articles/ (y /api/articles/)
    Listado de artículos con soporte de filtros y RBAC (GCDC-145):
    - Excluye siempre registros deshabilitados (is_enabled=False).
    - Con rol activo AUTOR: lista exclusivamente sus propios artículos.
    - Con rol activo COMITE o ADMIN: lista todos los artículos activos.
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

        active_role = get_active_role(self.request)
        if active_role in (RoleName.ADMIN, RoleName.COMITE):
            return base_qs

        if active_role == RoleName.AUTOR:
            return base_qs.filter(responsible_author=user)

        # Usuarios autenticados sin rol específico asignado
        return base_qs.none()


class ArticleDetailView(generics.RetrieveAPIView):
    """
    GET /api/v1/articles/{id}/ (GCDC-145: Detalle con RBAC)
    PATCH /api/v1/articles/{id}/ (GCDC-149: Modificación de metadatos del autor con deadline check)
    """

    def get_serializer_class(self):
        if self.request.method in ["PATCH", "PUT"]:
            return ArticleUpdateSerializer
        return ArticleDetailSerializer

    def get_permissions(self):
        if self.request.method in ["PATCH", "PUT"]:
            return [IsAuthenticated(), IsArticleAuthor()]
        return [IsAuthenticated(), IsArticleOwnerOrCommitteeOrAdmin()]

    def get_queryset(self):
        return (
            Article.objects.filter(is_enabled=True)
            .select_related("thematic_line", "responsible_author")
            .prefetch_related("coauthors", "versions")
        )

    def patch(self, request, *args, **kwargs):
        """
        GCDC-149 (HU-09):
        Actualiza parcialmente los metadatos de un artículo postulado.
        - Requiere permiso IsArticleAuthor (solo el autor responsable puede editar).
        - Verifica que la fecha límite de postulación no haya vencido (deadline check).
        - Si el plazo venció, retorna HTTP 400 Bad Request.
        - Si el usuario no es el autor responsable, retorna HTTP 403 Forbidden.
        - Si es válido, actualiza metadatos y retorna HTTP 200 OK.
        """
        article = self.get_object()

        # Validación de plazo contra la edición de la conferencia
        conference = Conference.objects.order_by("-event_start_date").first()
        if conference is not None:
            try:
                bogota_tz = ZoneInfo("America/Bogota")
                today = timezone.now().astimezone(bogota_tz).date()
            except Exception:
                today = timezone.now().date()

            if today > conference.submission_deadline:
                return Response(
                    {"detail": "El plazo para modificar metadatos del artículo ya venció."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = self.get_serializer(article, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()

        article.refresh_from_db()
        return Response(
            ArticleDetailSerializer(article).data,
            status=status.HTTP_200_OK,
        )

    def put(self, request, *args, **kwargs):
        """Soporta también método PUT delegando a la misma lógica de actualización."""
        return self.patch(request, *args, **kwargs)
