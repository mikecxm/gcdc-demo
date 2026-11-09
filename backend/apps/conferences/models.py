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