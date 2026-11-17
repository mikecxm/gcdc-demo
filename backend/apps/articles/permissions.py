from rest_framework.permissions import BasePermission
from apps.users.models import RoleName


class IsArticleOwnerOrCommitteeOrAdmin(BasePermission):
    """
    Permiso para acceso a objetos de tipo Artículo:
    - Miembros del Comité y Administradores tienen visibilidad completa.
    - Autores únicamente pueden consultar el detalle de sus propios artículos.
    """

    message = "No tienes permiso para consultar este artículo."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Administrador y Comité tienen acceso a cualquier artículo activo
        if user.has_role(RoleName.ADMIN) or user.has_role(RoleName.COMITE):
            return True

        # El autor responsable solo puede acceder si es el propietario
        if user.has_role(RoleName.AUTOR):
            return obj.responsible_author_id == user.id

        return False
