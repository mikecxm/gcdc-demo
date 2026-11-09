from django.conf import settings
from django.db import models
from django.utils.translation import gettext_lazy as _


class ThematicLine(models.Model):
    """Línea temática oficial de la conferencia (son 5, lista cerrada)."""

    name = models.CharField(_("nombre"), max_length=100, unique=True)

    class Meta:
        db_table = "linea_tematica"
        verbose_name = _("línea temática")
        verbose_name_plural = _("líneas temáticas")
        ordering = ["name"]

    def __str__(self):
        return self.name


class Conference(models.Model):
    """Configuración de una edición de la conferencia y sus fechas límite."""

    edition_name = models.CharField(_("nombre de la edición"), max_length=100)
    submission_deadline = models.DateField(_("fecha límite de postulación"))
    evaluation_deadline = models.DateField(_("fecha límite de evaluación"))
    presentation_version_deadline = models.DateField(
        _("fecha límite de versión para presentación")
    )
    publication_version_deadline = models.DateField(
        _("fecha límite de versión para publicación")
    )
    event_start_date = models.DateField(_("inicio del evento"))
    event_end_date = models.DateField(_("fin del evento"))
    talk_duration_minutes = models.PositiveIntegerField(
        _("duración de cada ponencia (minutos)"), default=45
    )

    class Meta:
        db_table = "conferencia_conf"
        verbose_name = _("conferencia")
        verbose_name_plural = _("conferencias")
        ordering = ["-event_start_date"]

    def __str__(self):
        return self.edition_name


class ArticleStatus(models.TextChoices):
    POSTULADO = "POSTULADO", _("Postulado")
    EN_REVISION = "EN_REVISION", _("En revisión")
    ACEPTADO = "ACEPTADO", _("Aceptado")
    RECHAZADO = "RECHAZADO", _("Rechazado")
    AVAL_PRESENTACION = "AVAL_PRESENTACION", _("Con aval para presentación")
    AVAL_PUBLICACION = "AVAL_PUBLICACION", _("Con aval para publicación")
    DESHABILITADO = "DESHABILITADO", _("Deshabilitado")


class Article(models.Model):
    """Artículo postulado a la conferencia."""

    title = models.CharField(_("título"), max_length=255)
    abstract = models.TextField(_("resumen"))
    keywords = models.CharField(_("palabras clave"), max_length=255)
    thematic_line = models.ForeignKey(
        ThematicLine,
        on_delete=models.PROTECT,
        related_name="articles",
        verbose_name=_("línea temática"),
    )
    responsible_author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="articles",
        verbose_name=_("autor responsable"),
    )
    status = models.CharField(
        _("estado"),
        max_length=20,
        choices=ArticleStatus.choices,
        default=ArticleStatus.POSTULADO,
    )
    is_permanently_disabled = models.BooleanField(
        _("deshabilitado de forma irreversible"), default=False
    )
    submitted_at = models.DateTimeField(_("fecha de postulación"), auto_now_add=True)

    class Meta:
        db_table = "articulo"
        verbose_name = _("artículo")
        verbose_name_plural = _("artículos")
        ordering = ["-submitted_at"]
        indexes = [
            models.Index(fields=["status"], name="articulo_status_idx"),
        ]

    def __str__(self):
        return self.title


class CoAuthor(models.Model):
    """Coautor de un artículo. No necesita cuenta en la plataforma."""

    article = models.ForeignKey(
        Article,
        on_delete=models.CASCADE,
        related_name="coauthors",
        verbose_name=_("artículo"),
    )
    full_name = models.CharField(_("nombre completo"), max_length=255)
    email = models.EmailField(_("correo electrónico"))
    affiliation = models.CharField(_("afiliación universitaria"), max_length=255)
    is_corresponding_author = models.BooleanField(
        _("es autor de correspondencia"), default=False
    )

    class Meta:
        db_table = "coautor_articulo"
        verbose_name = _("coautor")
        verbose_name_plural = _("coautores")

    def __str__(self):
        return f"{self.full_name} <{self.email}>"