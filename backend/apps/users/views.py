from rest_framework import generics, status
from rest_framework.exceptions import AuthenticationFailed, ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.views import TokenObtainPairView

from .filters import UserFilter
from .models import CustomUser, RoleName
from .pagination import UserPagination
from .permissions import IsAdminOrCommittee, IsOwnerOrAdminOrCommittee
from .serializers import (
    CustomTokenObtainPairSerializer,
    UserCreateSerializer,
    UserListSerializer,
    UserPublicSerializer,
    UserUpdateSerializer,
)
from .services.recaptcha import validate_recaptcha
from .services.login_audit import is_locked_out, record_attempt
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email

from .services.password_recovery import (
    InvalidResetPin,
    PasswordResetEmailError,
    request_password_reset_pin,
    reset_user_password,
    validate_new_password,
)


class UserListView(generics.ListAPIView):
    serializer_class = UserListSerializer
    permission_classes = [IsAuthenticated]
    filterset_class = UserFilter
    pagination_class = UserPagination
    queryset = (
        CustomUser.objects.filter(deleted_at__isnull=True)
        .only("id", "email", "full_name", "affiliation", "is_active", "created_at")
        .prefetch_related("roles")
        .order_by("id")
    )


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


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    Endpoint para consulta (GET), actualización parcial (PATCH) y baja lógica (DELETE)
    del perfil de usuario (HU-05 GCDC-133, HU-06 GCDC-137).
    Restringido al propietario del perfil, ADMIN o COMITE para lectura/edición,
    y estrictamente a ADMIN o COMITE para baja lógica.
    """

    http_method_names = ["get", "patch", "delete", "head", "options"]
    queryset = CustomUser.active_objects.all().prefetch_related("roles")

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [IsAdminOrCommittee()]
        return [IsOwnerOrAdminOrCommittee()]

    def get_serializer_class(self):
        if self.request.method == "GET":
            return UserPublicSerializer
        return UserUpdateSerializer

    def perform_destroy(self, instance):
        if instance.id == self.request.user.id:
            raise ValidationError({"detail": "No puedes desactivar tu propia cuenta."})
        instance.soft_delete()

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


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()

        try:
            validate_email(email)
        except DjangoValidationError:
            return Response(
                {"detail": "Ingresa un correo electrónico válido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            request_password_reset_pin(email)
        except PasswordResetEmailError:
            return Response(
                {"detail": "No fue posible enviar el correo. Inténtalo nuevamente."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "detail": (
                    "Si existe una cuenta asociada a ese correo, "
                    "recibirás un PIN de recuperación."
                )
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []

    def post(self, request):
        email = str(request.data.get("email", "")).strip().lower()
        pin = str(request.data.get("pin", "")).strip()
        new_password = str(request.data.get("new_password", ""))

        try:
            validate_email(email)
        except DjangoValidationError:
            return Response(
                {"detail": "Correo electrónico inválido."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not re.fullmatch(r"\d{6}", pin):
            return Response(
                {"detail": "El PIN debe contener 6 dígitos."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            validate_new_password(new_password)
        except ValueError as exc:
            return Response(
                {"detail": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            reset_user_password(email, pin, new_password)
        except InvalidResetPin:
            return Response(
                {
                    "detail": (
                        "PIN inválido, expirado o sin intentos disponibles."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {"detail": "La contraseña fue restablecida correctamente."},
            status=status.HTTP_200_OK,
        )
