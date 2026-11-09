from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import CustomUser


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    model = CustomUser

    list_display = ("email", "full_name", "affiliation", "role", "is_active", "created_at")
    list_filter = ("role", "is_active", "is_staff", "is_superuser")
    search_fields = ("email", "full_name", "affiliation")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at", "last_login", "date_joined")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Información personal"), {"fields": ("full_name", "affiliation")}),
        (_("Rol y permisos"), {
            "fields": ("role", "is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
        }),
        (_("Auditoría"), {
            "fields": ("deleted_at", "last_login", "date_joined", "created_at", "updated_at"),
        }),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "email", "full_name", "affiliation", "role",
                "password1", "password2", "is_active", "is_staff",
            ),
        }),
    )