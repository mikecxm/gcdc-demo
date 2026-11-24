from django.contrib.auth.hashers import make_password
from django.db import transaction
from rest_framework import serializers
from rest_framework.exceptions import AuthenticationFailed
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import CustomUser, Role, RoleName, UserRole


class UserListSerializer(serializers.ModelSerializer):
    roles = serializers.SlugRelatedField(many=True, read_only=True, slug_field="name")

    class Meta:
        model = CustomUser
        fields = [
            "id", "email", "full_name", "affiliation", "roles", "is_active", "created_at",
        ]
        read_only_fields = fields


class UserPublicSerializer(serializers.ModelSerializer):
    roles = serializers.SerializerMethodField()

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "full_name",
            "affiliation",
            "bio",
            "roles",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_roles(self, obj):
        return list(obj.roles.values_list("name", flat=True))


class UserUpdateSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(required=False)
    affiliation = serializers.CharField(required=False, allow_blank=True)
    bio = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    role = serializers.ChoiceField(
        choices=RoleName.choices,
        required=False,
        write_only=True,
    )

    class Meta:
        model = CustomUser
        fields = ["full_name", "affiliation", "bio", "role"]

    def validate_full_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El nombre completo no puede estar vacío.")
        return cleaned

    def validate_affiliation(self, value):
        return value.strip() if value else ""

    def validate_bio(self, value):
        if value is not None:
            return value.strip()
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        has_role_attempt = "role" in self.initial_data or "roles" in self.initial_data
        if has_role_attempt:
            is_self = bool(
                self.instance
                and request
                and request.user
                and self.instance.id == request.user.id
            )
            is_privileged = bool(
                request
                and request.user
                and request.user.has_role(RoleName.ADMIN)
            )
            if is_self or not is_privileged:
                raise serializers.ValidationError(
                    {"role": "No tienes permiso para modificar roles o auto-asignarte un rol."}
                )
        return attrs

    def update(self, instance, validated_data):
        new_role = validated_data.pop("role", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)

        with transaction.atomic():
            instance.save()
            if new_role:
                role_obj, _ = Role.objects.get_or_create(name=new_role)
                UserRole.objects.filter(user=instance).delete()
                UserRole.objects.create(user=instance, role=role_obj)

        return instance

    def to_representation(self, instance):
        return UserPublicSerializer(instance, context=self.context).data


class UserCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True,
        required=True,
        min_length=8,
        style={"input_type": "password"},
    )
    role = serializers.ChoiceField(
        choices=RoleName.choices,
        default=RoleName.AUTOR,
        required=False,
        write_only=True,
    )

    class Meta:
        model = CustomUser
        fields = [
            "id",
            "email",
            "full_name",
            "affiliation",
            "password",
            "role",
        ]

    def validate_full_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El nombre completo no puede estar vacío.")
        return cleaned

    def validate_affiliation(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("La afiliación universitaria no puede estar vacía.")
        return cleaned

    def validate_email(self, value):
        normalized_email = value.strip().lower()
        if CustomUser.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError(
                "Ya existe un usuario registrado con este correo electrónico."
            )
        return normalized_email

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError(
                "La contraseña debe tener al menos 8 caracteres."
            )
        return value

    def create(self, validated_data):
        role_name = validated_data.pop("role", RoleName.AUTOR)
        raw_password = validated_data.pop("password")
        validated_data.setdefault("is_active", True)

        with transaction.atomic():
            validated_data["password"] = make_password(raw_password)
            user = CustomUser.objects.create(**validated_data)

            role, _ = Role.objects.get_or_create(name=role_name)
            UserRole.objects.create(user=user, role=role)

        return user

    def to_representation(self, instance):
        return UserPublicSerializer(instance, context=self.context).data

def _role_names(user):
    return list(user.roles.values_list("name", flat=True))


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Agrega roles, active_role y full_name al JWT y a la respuesta del login."""

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        roles = _role_names(user)
        token["roles"] = roles
        token["active_role"] = roles[0] if len(roles) == 1 else None
        token["full_name"] = user.full_name
        return token

    def validate(self, attrs):
        data = super().validate(attrs)

        # Borrado lógico: un usuario eliminado no puede iniciar sesión.
        if getattr(self.user, "deleted_at", None):
            raise AuthenticationFailed(
                self.error_messages["no_active_account"], "no_active_account"
            )

        roles = _role_names(self.user)
        data["roles"] = roles
        data["active_role"] = roles[0] if len(roles) == 1 else None
        data["full_name"] = self.user.full_name
        return data
