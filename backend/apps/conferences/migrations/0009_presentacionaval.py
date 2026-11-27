import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("conferences", "0008_articlereviewer_evaluation_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="PresentacionAval",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("PENDIENTE", "Pendiente"),
                            ("AVALADO", "Avalado"),
                            ("NO_AVALADO", "No avalado"),
                        ],
                        default="PENDIENTE",
                        max_length=12,
                        verbose_name="estado",
                    ),
                ),
                (
                    "recorded_at",
                    models.DateTimeField(
                        blank=True,
                        null=True,
                        verbose_name="fecha de registro",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(
                        auto_now_add=True,
                        verbose_name="fecha de creación",
                    ),
                ),
                (
                    "article",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="presentation_approvals",
                        to="conferences.article",
                        verbose_name="artículo",
                    ),
                ),
                (
                    "assignment",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="presentation_approvals",
                        to="conferences.articlereviewer",
                        verbose_name="asignación del jurado",
                    ),
                ),
            ],
            options={
                "verbose_name": "aval de presentación",
                "verbose_name_plural": "avales de presentación",
                "db_table": "presentacion_aval",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="presentacionaval",
            constraint=models.UniqueConstraint(
                fields=("article", "assignment"),
                name="unique_article_presentation_assignment",
            ),
        ),
    ]
