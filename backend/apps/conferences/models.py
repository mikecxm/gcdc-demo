from django.conf import settings
from django.db import models
from django.db.models.signals import pre_save
from django.dispatch import receiver
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
    is_enabled = models.BooleanField(_("habilitado"), default=True, db_index=True)
    disabled_reason = models.TextField(
        _("motivo de deshabilitación"), null=True, blank=True
    )
    disabled_at = models.DateTimeField(
        _("fecha de deshabilitación"), null=True, blank=True
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
            models.Index(
                fields=["is_enabled", "thematic_line", "status"],
                name="idx_art_enabled_topic_status",
            ),
            models.Index(
                fields=["responsible_author", "is_enabled"],
                name="idx_art_author_enabled",
            ),
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

class VersionStage(models.TextChoices):
    INICIAL = "INICIAL", _("Versión inicial")
    CORREGIDA_PRESENTACION = "CORREGIDA_PRESENTACION", _("Corregida para presentación")
    FINAL_PUBLICACION = "FINAL_PUBLICACION", _("Final para publicación")


class ArticleVersion(models.Model):
    """Cada PDF subido de un artículo (historial de versiones)."""

    article = models.ForeignKey(
        Article,
        on_delete=models.CASCADE,
        related_name="versions",
        verbose_name=_("artículo"),
    )
    version_number = models.PositiveIntegerField(_("número de versión"))
    stage = models.CharField(
        _("etapa"),
        max_length=30,
        choices=VersionStage.choices,
        default=VersionStage.INICIAL,
    )
    pdf_url = models.URLField(_("URL del PDF"), max_length=500)
    copyright_pdf_url = models.URLField(
        _("URL del PDF de cesión de copyright"),
        max_length=500,
        blank=True,
        default="",
    )
    uploaded_at = models.DateTimeField(_("fecha de subida"), auto_now_add=True)

    class Meta:
        db_table = "version_articulo"
        verbose_name = _("versión de artículo")
        verbose_name_plural = _("versiones de artículo")
        ordering = ["article", "version_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["article", "version_number"],
                name="version_articulo_unique",
            ),
        ]

    def __str__(self):
        return f"{self.article.title} - v{self.version_number}"


class ArticleMetadataAudit(models.Model):
    """Histórico de auditoría de modificaciones de metadatos de artículos."""

    article = models.ForeignKey(
        Article,
        on_delete=models.CASCADE,
        related_name="metadata_audits",
        verbose_name=_("artículo"),
    )
    field_name = models.CharField(_("nombre del campo"), max_length=50)
    old_value = models.TextField(_("valor anterior"), null=True, blank=True)
    new_value = models.TextField(_("valor nuevo"), null=True, blank=True)
    modified_at = models.DateTimeField(
        _("fecha de modificación"), auto_now_add=True, db_index=True
    )

    class Meta:
        db_table = "auditoria_metadatos_articulo"
        verbose_name = _("auditoría de metadatos de artículo")
        verbose_name_plural = _("auditorías de metadatos de artículo")
        ordering = ["-modified_at"]

    def __str__(self):
        return f"[{self.modified_at}] Artículo {self.article_id}: {self.field_name}"


@receiver(pre_save, sender=Article)
def audit_article_metadata(sender, instance, **kwargs):
    """
    GCDC-150 (HU-09): Audita automáticamente en base de datos cualquier
    modificación realizada sobre los metadatos del artículo ('title' y 'abstract').
    """
    if instance.pk:
        try:
            old = Article.objects.only("title", "abstract").get(pk=instance.pk)
        except Article.DoesNotExist:
            return

        for field_name in ("title", "abstract"):
            old_val = getattr(old, field_name, None)
            new_val = getattr(instance, field_name, None)
            if old_val != new_val:
                ArticleMetadataAudit.objects.create(
                    article=instance,
                    field_name=field_name,
                    old_value=old_val,
                    new_value=new_val,
                )
