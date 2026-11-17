from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from .models import RoleName
from .permissions import IsAdminOrCommittee
from .serializers import CustomTokenObtainPairSerializer, UserCreateSerializer
from .services.recaptcha import validate_recaptcha
from .services.login_audit import is_locked_out, record_attempt


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

class LoginView(TokenObtainPairView):
    """
    POST /api/v1/auth/login/
    Valida primero el token de reCAPTCHA en el servidor y solo entonces
    verifica credenciales y emite los JWT (access + refresh).
    """

    serializer_class = CustomTokenObtainPairSerializer
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request, *args, **kwargs):
        email = str(request.data.get("email", "")).strip().lower()
        captcha_token = request.data.get("recaptcha_token")
        remote_ip = request.META.get("REMOTE_ADDR")

        if email and is_locked_out(email):
            return Response(
                {"detail": "Demasiados intentos fallidos. Inténtalo de nuevo en unos minutos."},
                status=status.HTTP_429_TOO_MANY_REQUESTS,
            )

        if not validate_recaptcha(captcha_token, remote_ip):
            return Response(
                {"detail": "Verificación CAPTCHA inválida o ausente."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            response = super().post(request, *args, **kwargs)
        except (AuthenticationFailed, InvalidToken, TokenError):
            if email:
                record_attempt(email, remote_ip, False)
            raise

        record_attempt(email, remote_ip, True)
        return response