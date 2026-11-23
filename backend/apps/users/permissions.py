from rest_framework.permissions import BasePermission
from .models import RoleName


class IsAdminOrCommittee(BasePermission):
    """Permite el acceso únicamente a usuarios autenticados con rol ADMIN o COMITE."""

    message = "No tienes permiso para realizar esta acción. Se requiere rol ADMIN o COMITE."

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and (
                request.user.has_role(RoleName.ADMIN)
                or request.user.has_role(RoleName.COMITE)
            )
        )


class IsOwnerOrAdminOrCommittee(BasePermission):
    """
    Permite acceso si el usuario autenticado es el propietario del recurso (obj.id == request.user.id)
    o si posee el rol ADMIN o COMITE.
    """

    message = "No tienes permiso para ver o modificar este perfil."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        if not (request.user and request.user.is_authenticated):
            return False
        return bool(
            obj.id == request.user.id
            or request.user.has_role(RoleName.ADMIN)
            or request.user.has_role(RoleName.COMITE)
        )
