from rest_framework.permissions import BasePermission
from apps.users.models import RoleName


def get_active_role(request):
    user = request.user
    requested_role = request.headers.get("X-Active-Role")

    if requested_role:
        if requested_role in RoleName.values and user.has_role(requested_role):
            return requested_role
        return None

    # Without an explicit role context, prefer the least-privileged matching role.
    for role in (RoleName.AUTOR, RoleName.COMITE, RoleName.ADMIN):
        if user.has_role(role):
            return role
    return None


class IsArticleOwnerOrCommitteeOrAdmin(BasePermission):
    """
    Permiso para acceso a objetos de tipo Artículo:
    - Con rol activo Comité o Administrador hay visibilidad completa de lectura.
    - Con rol activo Autor solo se permite consultar artículos propios.
    """

    message = "No tienes permiso para consultar este artículo."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        active_role = get_active_role(request)
        if active_role in (RoleName.ADMIN, RoleName.COMITE):
            return True

        # El autor responsable solo puede acceder si es el propietario
        if active_role == RoleName.AUTOR:
            return obj.responsible_author_id == user.id

        return False


class IsArticleAuthor(BasePermission):
    """
    GCDC-149 (HU-09): Permiso para modificación de artículos.
    Comprueba estrictamente que request.user sea el autor responsable del artículo.
    Cualquier otro usuario (incluyendo otros autores) recibe HTTP 403 Forbidden.
    """

    message = "Solo el autor responsable puede modificar este artículo."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user
        if not user or not user.is_authenticated:
            return False

        # Solo el autor responsable del artículo tiene permiso de edición
        return obj.responsible_author_id == user.id
