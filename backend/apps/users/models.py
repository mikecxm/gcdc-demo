from django.conf import settings
from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class RoleName(models.TextChoices):
    ADMIN = "ADMIN", _("Administrador")
    COMITE = "COMITE", _("Comité")
    AUTOR = "AUTOR", _("Autor")


class Role(models.Model):
    name = models.CharField(
        _("nombre"), max_length=10, choices=RoleName.choices, unique=True
    )

    class Meta:
        db_table = "rol"
        verbose_name = _("rol")
        verbose_name_plural = _("roles")

    def __str__(self):
        return self.get_name_display()


class UserManager(BaseUserManager):
    """Manager personalizado: usa email en lugar de username."""

    use_in_migrations = True

    def _create_user(self, email, password, roles, **extra_fields):
        if not email:
            raise ValueError(_("El email es obligatorio."))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        for role_name in roles:
            role, _created = Role.objects.get_or_create(name=role_name)
            UserRole.objects.get_or_create(user=user, role=role)
        return user

    def create_user(self, email, password=None, roles=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(
            email, password, roles or [RoleName.AUTOR], **extra_fields
        )

    def create_superuser(self, email, password=None, roles=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("El superusuario debe tener is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("El superusuario debe tener is_superuser=True."))
        return self._create_user(
            email, password, roles or [RoleName.ADMIN], **extra_fields
        )


class CustomUser(AbstractUser):
    username = None  # Se elimina: el login es por email

    email = models.EmailField(
        _("correo electrónico"),
        unique=True,
        blank=False,
        null=False,
    )
    full_name = models.CharField(_("nombre completo"), max_length=255)
    affiliation = models.CharField(_("afiliación"), max_length=255)
    roles = models.ManyToManyField(
        Role,
        through="UserRole",
        related_name="users",
        verbose_name=_("roles"),
    )
    is_active = models.BooleanField(_("activo"), default=True)
    deleted_at = models.DateTimeField(_("eliminado en"), null=True, blank=True)
    created_at = models.DateTimeField(_("creado en"), auto_now_add=True)
    updated_at = models.DateTimeField(_("actualizado en"), auto_now=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["full_name", "affiliation"]

    objects = UserManager()

    class Meta:
        db_table = "custom_user"
        verbose_name = _("usuario")
        verbose_name_plural = _("usuarios")
        indexes = [
            models.Index(fields=["email"], name="custom_user_email_idx"),
            models.Index(fields=["is_active"], name="custom_user_active_idx"),
        ]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"

    def has_role(self, role_name):
        return self.user_roles.filter(role__name=role_name).exists()


class UserRole(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="user_roles",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.PROTECT,
        related_name="user_roles",
    )

    class Meta:
        db_table = "usuario_rol"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "role"], name="usuario_rol_unique"
            ),
        ]

    def __str__(self):
        return f"{self.user.email} -> {self.role}"