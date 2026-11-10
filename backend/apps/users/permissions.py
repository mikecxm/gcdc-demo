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
