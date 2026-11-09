from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.utils.translation import gettext_lazy as _

from .models import CustomUser, Role, UserRole


class UserRoleInline(admin.TabularInline):
    model = UserRole
    extra = 1


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name",)


@admin.register(CustomUser)
class CustomUserAdmin(BaseUserAdmin):
    model = CustomUser
    inlines = [UserRoleInline]

    list_display = (
        "email", "full_name", "affiliation", "get_roles", "is_active", "created_at",
    )
    list_filter = ("roles", "is_active", "is_staff", "is_superuser")
    search_fields = ("email", "full_name", "affiliation")
    ordering = ("-created_at",)
    readonly_fields = ("created_at", "updated_at", "last_login", "date_joined")

    fieldsets = (
        (None, {"fields": ("email", "password")}),
        (_("Información personal"), {"fields": ("full_name", "affiliation")}),
        (_("Permisos"), {
            "fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions"),
        }),
        (_("Auditoría"), {
            "fields": ("deleted_at", "last_login", "date_joined", "created_at", "updated_at"),
        }),
    )

    add_fieldsets = (
        (None, {
            "classes": ("wide",),
            "fields": (
                "email", "full_name", "affiliation",
                "password1", "password2", "is_active", "is_staff",
            ),
        }),
    )

    @admin.display(description=_("roles"))
    def get_roles(self, obj):
        return ", ".join(role.get_name_display() for role in obj.roles.all())