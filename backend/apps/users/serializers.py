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
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=RoleName.choices),
        required=False,
        allow_empty=False,
        write_only=True,
    )

    class Meta:
        model = CustomUser
        fields = ["full_name", "affiliation", "bio", "role", "roles"]

    def validate_full_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El nombre completo no puede estar vacío.")
        if "<" in cleaned or ">" in cleaned:
            raise serializers.ValidationError(
                "El nombre completo no puede contener los caracteres < o >."
            )
        return cleaned

    def validate_affiliation(self, value):
        return value.strip() if value else ""

    def validate_bio(self, value):
        if value is not None:
            return value.strip()
        return value

    def validate(self, attrs):
        has_role_attempt = "role" in self.initial_data or "roles" in self.initial_data
        if not has_role_attempt:
            return attrs

        error_field = "role" if "role" in self.initial_data else "roles"
        if "role" in attrs and "roles" in attrs:
            raise serializers.ValidationError(
                {"roles": "Envía el campo 'roles' o el campo 'role', no ambos."}
            )

        legacy_role = attrs.pop("role", None)
        requested_roles = attrs.get("roles")
        if legacy_role is not None:
            requested_roles = [legacy_role]
            attrs["roles"] = requested_roles
        if not requested_roles:
            raise serializers.ValidationError(
                {error_field: "Selecciona al menos un rol."}
            )
        if len(set(requested_roles)) != len(requested_roles):
            raise serializers.ValidationError(
                {error_field: "No se puede asignar el mismo rol más de una vez."}
            )

        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_admin = bool(user and user.is_authenticated and user.has_role(RoleName.ADMIN))
        is_privileged = is_admin or bool(
            user and user.is_authenticated and user.has_role(RoleName.COMITE)
        )
        if not is_privileged:
            raise serializers.ValidationError(
                {error_field: "No tienes permiso para modificar los roles de esta cuenta."}
            )

        currently_admin = self.instance.has_role(RoleName.ADMIN)
        requested_admin = RoleName.ADMIN in requested_roles
        if currently_admin != requested_admin and not is_admin:
            raise serializers.ValidationError(
                {error_field: "Solo un administrador puede asignar o retirar el rol de administrador."}
            )
        return attrs

    def update(self, instance, validated_data):
        new_roles = validated_data.pop("roles", None)
        for attr, val in validated_data.items():
            setattr(instance, attr, val)

        with transaction.atomic():
            instance.save()
            if new_roles is not None:
                UserRole.objects.filter(user=instance).delete()
                roles = [
                    Role.objects.get_or_create(name=role_name)[0]
                    for role_name in new_roles
                ]
                UserRole.objects.bulk_create(
                    [UserRole(user=instance, role=role) for role in roles]
                )

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
        required=False,
        write_only=True,
    )
    roles = serializers.ListField(
        child=serializers.ChoiceField(choices=RoleName.choices),
        required=False,
        allow_empty=False,
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
            "roles",
        ]

    def validate_full_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El nombre completo no puede estar vacío.")
        if "<" in cleaned or ">" in cleaned:
            raise serializers.ValidationError(
                "El nombre completo no puede contener los caracteres < o >."
            )
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

    def validate(self, attrs):
        if "role" in attrs and "roles" in attrs:
            raise serializers.ValidationError(
                {"roles": "Envía el campo 'roles' o el campo 'role', no ambos."}
            )

        legacy_role = attrs.pop("role", None)
        requested_roles = attrs.get("roles")
        if requested_roles is None:
            requested_roles = [legacy_role or RoleName.AUTOR]
            attrs["roles"] = requested_roles
        if len(set(requested_roles)) != len(requested_roles):
            raise serializers.ValidationError(
                {"roles": "No se puede asignar el mismo rol más de una vez."}
            )

        request = self.context.get("request")
        user = getattr(request, "user", None)
        is_admin = bool(user and user.is_authenticated and user.has_role(RoleName.ADMIN))
        if RoleName.ADMIN in requested_roles and not is_admin:
            raise serializers.ValidationError(
                {"roles": "Solo un administrador puede asignar el rol de administrador."}
            )
        return attrs

    def create(self, validated_data):
        role_names = validated_data.pop("roles", [RoleName.AUTOR])
        raw_password = validated_data.pop("password")
        validated_data.setdefault("is_active", True)

        with transaction.atomic():
            validated_data["password"] = make_password(raw_password)
            user = CustomUser.objects.create(**validated_data)

            roles = [
                Role.objects.get_or_create(name=role_name)[0]
                for role_name in role_names
            ]
            UserRole.objects.bulk_create(
                [UserRole(user=user, role=role) for role in roles]
            )

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
