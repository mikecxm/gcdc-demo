from django.contrib.auth.hashers import make_password
from django.db import transaction
from rest_framework import serializers

from .models import CustomUser, Role, RoleName, UserRole


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
