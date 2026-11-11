from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from .models import Article, ArticleMetadataAudit, ArticleStatus, ThematicLine

User = get_user_model()


class ArticleDisablementTests(TestCase):
    """Pruebas unitarias para GCDC-154: Deshabilitación de artículo (HU-10)."""

    def setUp(self):
        # Autor responsable del artículo
        self.author = User.objects.create_user(
            email="autor.articulo@univalle.edu.co",
            password="Password123!",
            full_name="Autor Artículos",
            affiliation="Universidad del Valle",
        )

        # Línea temática (puede provenir del seed o crearse)
        self.thematic_line, _ = ThematicLine.objects.get_or_create(
            name="Sistemas Inteligentes"
        )

        # Crear artículo con valores por defecto
        self.article = Article.objects.create(
            title="Diseño de Arquitecturas Orientadas a Eventos",
            abstract="Resumen del artículo sobre eventos y microservicios.",
            keywords="event-driven, microservices, software architecture",
            thematic_line=self.thematic_line,
            responsible_author=self.author,
            status=ArticleStatus.POSTULADO,
        )

    def test_article_created_with_default_is_enabled(self):
        """Verifica que un artículo nuevo tenga is_enabled=True por defecto y campos nulos."""
        self.assertTrue(self.article.is_enabled)
        self.assertIsNone(self.article.disabled_reason)
        self.assertIsNone(self.article.disabled_at)
        self.assertEqual(self.article.status, ArticleStatus.POSTULADO)

        # La consulta de artículos habilitados debe incluirlo
        enabled_articles = Article.objects.filter(is_enabled=True)
        self.assertIn(self.article, enabled_articles)

    def test_article_disablement_fields_and_filtering(self):
        """GCDC-154: Deshabilita un artículo asignando motivo y fecha, y valida filtros."""
        now = timezone.now()
        reason = "Incumple formato IEEE"

        # Aplicar deshabilitación
        self.article.is_enabled = False
        self.article.disabled_reason = reason
        self.article.disabled_at = now
        self.article.status = ArticleStatus.DESHABILITADO
        self.article.save()

        # Recargar desde la base de datos
        self.article.refresh_from_db()

        # Validar persistencia de atributos
        self.assertFalse(self.article.is_enabled)
        self.assertEqual(self.article.disabled_reason, reason)
        self.assertIsNotNone(self.article.disabled_at)
        self.assertEqual(self.article.status, ArticleStatus.DESHABILITADO)

        # El artículo NO debe aparecer en el listado de habilitados
        self.assertFalse(Article.objects.filter(is_enabled=True).filter(id=self.article.id).exists())

        # El artículo DEBE aparecer en el listado de deshabilitados
        self.assertTrue(Article.objects.filter(is_enabled=False).filter(id=self.article.id).exists())

    def test_article_indexes_and_composite_filtering(self):
        """GCDC-146: Verifica existencia de índices compuestos y filtrado optimizado."""
        index_names = {idx.name for idx in Article._meta.indexes}
        self.assertIn("idx_art_enabled_topic_status", index_names)
        self.assertIn("idx_art_author_enabled", index_names)

        # 1. Filtro compuesto de catálogo / comité: is_enabled + thematic_line + status
        catalog_qs = Article.objects.filter(
            is_enabled=True,
            thematic_line=self.thematic_line,
            status=ArticleStatus.POSTULADO,
        )
        self.assertIn(self.article, catalog_qs)

        # 2. Filtro vista privada de autor: responsible_author + is_enabled
        author_qs = Article.objects.filter(
            responsible_author=self.author,
            is_enabled=True,
        )
        self.assertIn(self.article, author_qs)

    def test_article_metadata_audit_trigger_on_update(self):
        """GCDC-150 (HU-09): Verifica que modificaciones de title y abstract se auditen automáticamente."""
        # 1. Al crear el artículo inicial en setUp, no debe haber registros de auditoría
        initial_audits = ArticleMetadataAudit.objects.filter(article=self.article)
        self.assertEqual(initial_audits.count(), 0)

        # 2. Modificar título y resumen
        old_title = self.article.title
        old_abstract = self.article.abstract
        new_title = "Arquitecturas de Microservicios Distribuidos en la Nube"
        new_abstract = "Resumen actualizado con métricas empíricas de latencia y throughput."

        self.article.title = new_title
        self.article.abstract = new_abstract
        self.article.save()

        # 3. Verificar que se hayan creado los dos registros de auditoría con valores exactos
        audits = ArticleMetadataAudit.objects.filter(article=self.article)
        self.assertEqual(audits.count(), 2)

        title_audit = audits.filter(field_name="title").first()
        self.assertIsNotNone(title_audit)
        self.assertEqual(title_audit.old_value, old_title)
        self.assertEqual(title_audit.new_value, new_title)

        abstract_audit = audits.filter(field_name="abstract").first()
        self.assertIsNotNone(abstract_audit)
        self.assertEqual(abstract_audit.old_value, old_abstract)
        self.assertEqual(abstract_audit.new_value, new_abstract)

        # 4. Modificar solo un campo no relacionado (ej. keywords) no debe generar nueva auditoría
        self.article.keywords = "cloud, microservices, updated-keywords"
        self.article.save()
        self.assertEqual(ArticleMetadataAudit.objects.filter(article=self.article).count(), 2)

        # 5. Modificar únicamente el título genera exactamente una auditoría adicional
        final_title = "Título Final Definitivo"
        self.article.title = final_title
        self.article.save()
        self.assertEqual(ArticleMetadataAudit.objects.filter(article=self.article).count(), 3)

