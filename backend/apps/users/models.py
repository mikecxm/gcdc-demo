from django.contrib.auth.base_user import BaseUserManager
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.translation import gettext_lazy as _


class Role(models.TextChoices):
    ADMIN = "ADMIN", _("Administrador")
    COMITE = "COMITE", _("Comité")
    AUTOR = "AUTOR", _("Autor")


class UserManager(BaseUserManager):
    """Manager personalizado: usa email en lugar de username."""

    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError(_("El email es obligatorio."))
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", Role.AUTOR)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", Role.ADMIN)

        if extra_fields.get("is_staff") is not True:
            raise ValueError(_("El superusuario debe tener is_staff=True."))
        if extra_fields.get("is_superuser") is not True:
            raise ValueError(_("El superusuario debe tener is_superuser=True."))
        return self._create_user(email, password, **extra_fields)


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
    role = models.CharField(
        _("rol"),
        max_length=10,
        choices=Role.choices,
        default=Role.AUTOR,
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
            models.Index(fields=["is_active", "role"], name="custom_user_active_role_idx"),
        ]

    def __str__(self):
        return f"{self.full_name} <{self.email}>"