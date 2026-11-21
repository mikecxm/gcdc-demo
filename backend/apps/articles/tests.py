from datetime import timedelta
import time
from zoneinfo import ZoneInfo
from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.conferences.models import (
    Article,
    ArticleMetadataAudit,
    ArticleStatus,
    ArticleVersion,
    CoAuthor,
    Conference,
    ThematicLine,
    VersionStage,
)
from apps.users.models import Role, RoleName

User = get_user_model()


class ArticleEndpointsTests(APITestCase):
    """
    Pruebas de aceptación y QA para:
    - GCDC-145 (HU-08): Endpoints GET /api/v1/articles/ y GET /api/articles/{id}/
    - GCDC-149 (HU-09): Endpoint PATCH /api/v1/articles/{id}/ con permisos IsArticleAuthor y deadline check
    """

    def setUp(self):
        # Asegurar roles en base de datos
        for r in RoleName.values:
            Role.objects.get_or_create(name=r)

        # Usuarios de prueba con roles RBAC
        self.author1 = User.objects.create_user(
            email="carlos.mendoza@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Carlos Mendoza",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        self.author2 = User.objects.create_user(
            email="andres.caicedo@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Andrés Caicedo",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        self.committee_user = User.objects.create_user(
            email="elena.valencia@univalle.edu.co",
            password="Password123!",
            full_name="Dra. Elena Valencia",
            affiliation="Universidad del Valle - Comité",
            roles=[RoleName.COMITE],
        )

        self.admin_user = User.objects.create_user(
            email="admin@univalle.edu.co",
            password="Password123!",
            full_name="Sarah Chen",
            affiliation="Universidad del Valle - Admin",
            roles=[RoleName.ADMIN],
        )

        # Conferencia vigente con plazo activo (en el futuro)
        self.conference = Conference.objects.create(
            edition_name="Conferencia GCDC 2026",
            submission_deadline=timezone.now().date() + timedelta(days=30),
            evaluation_deadline=timezone.now().date() + timedelta(days=60),
            presentation_version_deadline=timezone.now().date() + timedelta(days=90),
            publication_version_deadline=timezone.now().date() + timedelta(days=120),
            event_start_date=timezone.now().date() + timedelta(days=150),
            event_end_date=timezone.now().date() + timedelta(days=155),
        )

        # Líneas temáticas oficiales
        self.line_ia, _ = ThematicLine.objects.get_or_create(name="Sistemas Inteligentes")
        self.line_dist, _ = ThematicLine.objects.get_or_create(name="Tecnologías en Informática")

        # Artículos de Author 1
        self.art_author1_ia = Article.objects.create(
            title="Optimización de Modelos Fundacionales para Detección Temprana",
            abstract="Resumen sobre modelos fundacionales y visión por computador.",
            keywords="Inteligencia Artificial, Modelos Fundacionales, Detección",
            thematic_line=self.line_ia,
            responsible_author=self.author1,
            status=ArticleStatus.POSTULADO,
            is_enabled=True,
        )
        self.coauthor1 = CoAuthor.objects.create(
            article=self.art_author1_ia,
            full_name="Ing. Mateo Gómez",
            email="mateo.gomez@univalle.edu.co",
            affiliation="Universidad del Valle",
            is_corresponding_author=False,
        )
        self.version1 = ArticleVersion.objects.create(
            article=self.art_author1_ia,
            version_number=1,
            stage=VersionStage.INICIAL,
            pdf_url="https://supabase.co/storage/v1/articles/1/v1.pdf",
        )

        self.art_author1_dist = Article.objects.create(
            title="Arquitectura de Microservicios Resilientes con Raft",
            abstract="Consenso distribuido y alta concurrencia en salud digital.",
            keywords="Microservicios, Raft, Sistemas Distribuidos",
            thematic_line=self.line_dist,
            responsible_author=self.author1,
            status=ArticleStatus.ACEPTADO,
            is_enabled=True,
        )

        # Artículo deshabilitado de Author 1 (debe excluirse siempre de consultas activas)
        self.art_author1_disabled = Article.objects.create(
            title="Artículo Inválido Deshabilitado",
            abstract="Contenido no apto para la conferencia.",
            keywords="Invalido, Spam",
            thematic_line=self.line_ia,
            responsible_author=self.author1,
            status=ArticleStatus.DESHABILITADO,
            is_enabled=False,
            disabled_reason="Incumple estándares éticos",
        )

        # Artículo de Author 2
        self.art_author2_ia = Article.objects.create(
            title="Redes Neuronales de Grafos para Predicción Temporal",
            abstract="Deep learning sobre grafos temporales en logística urbana.",
            keywords="GNN, Deep Learning, Grafos",
            thematic_line=self.line_ia,
            responsible_author=self.author2,
            status=ArticleStatus.POSTULADO,
            is_enabled=True,
        )

        self.list_url = reverse("article-list")

    # -------------------------------------------------------------
    # GCDC-145: 1. Pruebas de Autenticación
    # -------------------------------------------------------------
    def test_unauthenticated_request_returns_401(self):
        """Petición anónima al listado o detalle retorna 401 Unauthorized."""
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        detail_url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})
        response_detail = self.client.get(detail_url)
        self.assertEqual(response_detail.status_code, status.HTTP_401_UNAUTHORIZED)

    # -------------------------------------------------------------
    # GCDC-145: 2. Control de Visibilidad por Rol (Listado)
    # -------------------------------------------------------------
    def test_author_only_sees_own_active_articles_in_list(self):
        """
        Caso de Prueba QA 1 (GCDC-145):
        Un autor autenticado solo recibe sus propios artículos habilitados.
        """
        self.client.force_authenticate(user=self.author1)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data]

        # Author 1 debe ver sus 2 artículos activos
        self.assertIn(self.art_author1_ia.id, returned_ids)
        self.assertIn(self.art_author1_dist.id, returned_ids)
        # NO debe ver el artículo de Author 2
        self.assertNotIn(self.art_author2_ia.id, returned_ids)
        # NO debe ver su artículo deshabilitado
        self.assertNotIn(self.art_author1_disabled.id, returned_ids)
        self.assertEqual(len(returned_ids), 2)

    def test_committee_sees_all_active_articles_in_list(self):
        """
        Caso de Prueba QA 2 (GCDC-145):
        Un miembro del comité ve todos los artículos activos del catálogo.
        """
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data]

        self.assertIn(self.art_author1_ia.id, returned_ids)
        self.assertIn(self.art_author1_dist.id, returned_ids)
        self.assertIn(self.art_author2_ia.id, returned_ids)
        # El deshabilitado sigue excluido
        self.assertNotIn(self.art_author1_disabled.id, returned_ids)
        self.assertEqual(len(returned_ids), 3)

    def test_admin_sees_all_active_articles_in_list(self):
        """El administrador ve todos los artículos activos del catálogo."""
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(self.list_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data]
        self.assertEqual(len(returned_ids), 3)
        self.assertNotIn(self.art_author1_disabled.id, returned_ids)

    # -------------------------------------------------------------
    # GCDC-145: 3. Filtros Combinados y Búsqueda
    # -------------------------------------------------------------
    def test_filter_by_thematic_line(self):
        """Filtrar por línea temática retorna solo artículos de esa línea."""
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get(self.list_url, {"thematic_line": "Sistemas Inteligentes"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data]
        self.assertIn(self.art_author1_ia.id, returned_ids)
        self.assertIn(self.art_author2_ia.id, returned_ids)
        self.assertNotIn(self.art_author1_dist.id, returned_ids)

    def test_filter_by_status(self):
        """Filtrar por estado del artículo retorna los registros correspondientes."""
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get(self.list_url, {"status": "ACEPTADO"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data]
        self.assertEqual(returned_ids, [self.art_author1_dist.id])

    def test_combined_filters_and_response_time_under_400ms(self):
        """
        Criterio de Aceptación (DoD 1 - GCDC-145):
        Consulta con al menos 2 filtros combinados (thematic_line + status)
        con tiempo de respuesta <= 400 ms.
        """
        self.client.force_authenticate(user=self.committee_user)

        start_time = time.perf_counter()
        response = self.client.get(
            self.list_url,
            {
                "thematic_line": "Sistemas Inteligentes",
                "status": "POSTULADO",
            },
        )
        elapsed_time = time.perf_counter() - start_time

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data]
        self.assertIn(self.art_author1_ia.id, returned_ids)
        self.assertIn(self.art_author2_ia.id, returned_ids)
        self.assertNotIn(self.art_author1_dist.id, returned_ids)

        # Verificación del tiempo de respuesta (DoD <= 400 ms)
        self.assertLessEqual(
            elapsed_time,
            0.400,
            f"Tiempo de respuesta ({elapsed_time:.3f}s) superó los 400ms requeridos.",
        )

    def test_search_filter_by_keyword_and_abstract(self):
        """Búsqueda por texto en título, abstract o keywords."""
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get(self.list_url, {"search": "Microservicios"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [item["id"] for item in response.data]
        self.assertEqual(returned_ids, [self.art_author1_dist.id])

    # -------------------------------------------------------------
    # GCDC-145: 4. Detalle y Comprobación de Propiedad (GET /api/v1/articles/{id}/)
    # -------------------------------------------------------------
    def test_author_can_view_own_article_detail(self):
        """Un autor puede consultar el detalle de su propio artículo con todos los datos."""
        self.client.force_authenticate(user=self.author1)
        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.art_author1_ia.id)
        self.assertEqual(response.data["title"], self.art_author1_ia.title)
        self.assertEqual(response.data["thematic_line"], "Sistemas Inteligentes")
        self.assertEqual(response.data["responsible_author"]["email"], self.author1.email)
        self.assertEqual(response.data["pdf_url"], "https://supabase.co/storage/v1/articles/1/v1.pdf")
        self.assertEqual(len(response.data["coauthors"]), 1)
        self.assertEqual(response.data["coauthors"][0]["full_name"], "Ing. Mateo Gómez")

    def test_author_cannot_view_other_authors_article_detail_forbidden(self):
        """
        Criterio de Aceptación (DoD 2 - GCDC-145):
        Un autor que consulte el ID de un artículo ajeno recibe HTTP 403 Forbidden.
        """
        self.client.force_authenticate(user=self.author1)
        # Author 1 intenta acceder al artículo de Author 2
        url = reverse("article-detail", kwargs={"pk": self.art_author2_ia.pk})
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("detail", response.data)

    def test_committee_can_view_any_active_article_detail(self):
        """Un miembro del comité puede consultar el detalle de cualquier artículo activo."""
        self.client.force_authenticate(user=self.committee_user)

        url_art1 = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})
        response1 = self.client.get(url_art1)
        self.assertEqual(response1.status_code, status.HTTP_200_OK)

        url_art2 = reverse("article-detail", kwargs={"pk": self.art_author2_ia.pk})
        response2 = self.client.get(url_art2)
        self.assertEqual(response2.status_code, status.HTTP_200_OK)

    def test_admin_can_view_any_active_article_detail(self):
        """Un administrador puede consultar el detalle de cualquier artículo activo."""
        self.client.force_authenticate(user=self.admin_user)
        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_detail_for_disabled_article_returns_404(self):
        """Consultar el detalle de un artículo deshabilitado retorna 404 Not Found."""
        self.client.force_authenticate(user=self.committee_user)
        url = reverse("article-detail", kwargs={"pk": self.art_author1_disabled.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_detail_for_nonexistent_article_returns_404(self):
        """Consultar un artículo que no existe retorna 404 Not Found."""
        self.client.force_authenticate(user=self.committee_user)
        url = reverse("article-detail", kwargs={"pk": 999999})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_unversioned_alias_endpoint(self):
        """El endpoint alias /api/articles/ funciona correctamente y retorna el listado."""
        self.client.force_authenticate(user=self.committee_user)
        response = self.client.get("/api/articles/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

    # -------------------------------------------------------------
    # GCDC-149: 5. Modificación de Metadatos (PATCH /api/v1/articles/{id}/)
    # -------------------------------------------------------------
    def test_patch_article_success_within_deadline(self):
        """
        Criterio de Aceptación 1 (DoD - GCDC-149):
        Retorno de HTTP 200 OK con metadatos actualizados ante solicitudes válidas
        del autor propietario dentro de la fecha límite.
        Verifica también la auditoría automática en ArticleMetadataAudit (GCDC-150 / HU-09).
        """
        self.client.force_authenticate(user=self.author1)
        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})

        payload = {
            "title": "Título de Artículo Completamente Actualizado",
            "abstract": "Nuevo resumen descriptivo del artículo con aportes novedosos.",
            "keywords": "IA, Modelos, Actualizado, Edge",
            "thematic_line": self.line_dist.id,
        }

        response = self.client.patch(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["title"], payload["title"])
        self.assertEqual(response.data["abstract"], payload["abstract"])
        self.assertEqual(response.data["keywords"], payload["keywords"])
        self.assertEqual(response.data["thematic_line"], "Tecnologías en Informática")

        # Verificar persistencia en base de datos
        self.art_author1_ia.refresh_from_db()
        self.assertEqual(self.art_author1_ia.title, payload["title"])
        self.assertEqual(self.art_author1_ia.abstract, payload["abstract"])
        self.assertEqual(self.art_author1_ia.keywords, payload["keywords"])
        self.assertEqual(self.art_author1_ia.thematic_line, self.line_dist)

        # Verificar que la auditoría automática registró los cambios en title y abstract
        audits = ArticleMetadataAudit.objects.filter(article=self.art_author1_ia)
        self.assertEqual(audits.count(), 2)
        audit_fields = {a.field_name for a in audits}
        self.assertIn("title", audit_fields)
        self.assertIn("abstract", audit_fields)

    def test_patch_article_fails_when_deadline_passed(self):
        """
        Caso de Prueba QA 1 (GCDC-149):
        Intentar modificar artículo con fecha límite vencida retorna HTTP 400 Bad Request.
        """
        self.client.force_authenticate(user=self.author1)

        # Configurar la fecha límite de postulación como vencida
        bogota_tz = ZoneInfo("America/Bogota")
        today = timezone.now().astimezone(bogota_tz).date()
        self.conference.submission_deadline = today - timedelta(days=2)
        self.conference.save()

        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})
        payload = {
            "title": "Intento de Modificación Tardía",
        }

        response = self.client.patch(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
        self.assertIn("plazo", response.data["detail"].lower())

        # El título en base de datos no debe haber cambiado
        self.art_author1_ia.refresh_from_db()
        self.assertNotEqual(self.art_author1_ia.title, "Intento de Modificación Tardía")

    def test_patch_article_forbidden_for_different_author(self):
        """
        Criterio de Aceptación 2 & Caso de Prueba QA 2 (GCDC-149):
        Intentar modificar artículo de otro autor retorna HTTP 403 Forbidden.
        Permiso IsArticleAuthor rechaza a Author 2 intentando editar artículo de Author 1.
        """
        self.client.force_authenticate(user=self.author2)
        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})

        payload = {
            "title": "Intento de Modificación por Autor Ajeno",
        }

        response = self.client.patch(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("detail", response.data)

        # El artículo no fue alterado
        self.art_author1_ia.refresh_from_db()
        self.assertNotEqual(self.art_author1_ia.title, "Intento de Modificación por Autor Ajeno")

    def test_patch_article_forbidden_for_committee_or_admin(self):
        """
        Permiso IsArticleAuthor: Ni miembros del comité ni administradores
        pueden modificar directamente los metadatos de un artículo vía PATCH
        (la autoría corresponde exclusivamente al autor responsable).
        """
        # Prueba con miembro del comité
        self.client.force_authenticate(user=self.committee_user)
        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})
        response = self.client.patch(url, {"title": "Modificado por Comité"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # Prueba con administrador
        self.client.force_authenticate(user=self.admin_user)
        response_admin = self.client.patch(url, {"title": "Modificado por Admin"}, format="json")
        self.assertEqual(response_admin.status_code, status.HTTP_403_FORBIDDEN)

    def test_patch_article_unauthenticated_returns_401(self):
        """Modificación sin credenciales retorna 401 Unauthorized."""
        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})
        response = self.client.patch(url, {"title": "Sin Auth"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_patch_article_validation_error_on_empty_fields(self):
        """Intentar actualizar campos obligatorios con valores en blanco retorna 400 Bad Request."""
        self.client.force_authenticate(user=self.author1)
        url = reverse("article-detail", kwargs={"pk": self.art_author1_ia.pk})

        response = self.client.patch(url, {"title": "   "}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.data)

        response_abstract = self.client.patch(url, {"abstract": "  "}, format="json")
        self.assertEqual(response_abstract.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("abstract", response_abstract.data)
