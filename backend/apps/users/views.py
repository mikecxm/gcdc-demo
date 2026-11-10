from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from .models import RoleName
from .permissions import IsAdminOrCommittee
from .serializers import UserCreateSerializer


class UserRegisterView(generics.CreateAPIView):
    """
    Endpoint público para autoregistro de usuarios.
    Asigna forzosamente el rol AUTOR por defecto.
    """

    serializer_class = UserCreateSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data.copy() if hasattr(request.data, "copy") else dict(request.data)
        data["role"] = RoleName.AUTOR

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def perform_create(self, serializer):
        serializer.save(role=RoleName.AUTOR)


class AdminUserCreateView(generics.CreateAPIView):
    """
    Endpoint administrativo para creación de usuarios.
    Permite asignar ADMIN, COMITE o AUTOR.
    Protegido por IsAuthenticated e IsAdminOrCommittee.
    """

    serializer_class = UserCreateSerializer
    permission_classes = [IsAuthenticated, IsAdminOrCommittee]
