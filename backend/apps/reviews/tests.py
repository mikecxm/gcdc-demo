from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.conferences.models import (
    Article,
    ArticleReviewer,
    ArticleStatus,
    CoAuthor,
    ThematicLine,
)
from apps.users.models import Role, RoleName

User = get_user_model()


class ReviewerAssignmentTests(APITestCase):
    """
    Pruebas de aceptación y QA para GCDC-161 (HU-12):
    Servicio de asignación balanceada de 3 jurados con validación de conflictos.
    """

    def setUp(self):
        # Asegurar roles en base de datos
        for r in RoleName.values:
            Role.objects.get_or_create(name=r)

        # Autor responsable del artículo
        self.author = User.objects.create_user(
            email="autor.principal@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Carlos Mendoza",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        # Miembros del comité (3 válidos + 1 con conflicto de coautoría)
        self.juror1 = User.objects.create_user(
            email="elena.valencia@univalle.edu.co",
            password="Password123!",
            full_name="Dra. Elena Valencia",
            affiliation="Universidad del Valle - Comité Científico",
            roles=[RoleName.COMITE],
        )
        self.juror2 = User.objects.create_user(
            email="fernando.duque@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Fernando Duque",
            affiliation="Universidad del Valle - Inteligencia Artificial",
            roles=[RoleName.COMITE],
        )
        self.juror3 = User.objects.create_user(
            email="sofia.rincon@univalle.edu.co",
            password="Password123!",
            full_name="Dra. Sofía Rincón",
            affiliation="Universidad del Valle",
            roles=[RoleName.COMITE],
        )
        self.juror_coauthor = User.objects.create_user(
            email="mateo.gomez@univalle.edu.co",
            password="Password123!",
            full_name="Ing. Mateo Gómez",
            affiliation="Universidad del Valle",
            roles=[RoleName.COMITE],
        )

        # Administrador del sistema
        self.admin = User.objects.create_user(
            email="admin.congreso@univalle.edu.co",
            password="Password123!",
            full_name="Sarah Chen",
            affiliation="Universidad del Valle - Admin",
            roles=[RoleName.ADMIN],
        )

        # Línea temática y artículo postulado
        self.thematic_line, _ = ThematicLine.objects.get_or_create(name="Sistemas Inteligentes")

        self.article = Article.objects.create(
            title="Optimización de Modelos Fundacionales para Detección de Plagas",
            abstract="Resumen del artículo sobre modelos fundacionales y visión artificial.",
            keywords="IA, Visión Artificial",
            thematic_line=self.thematic_line,
            responsible_author=self.author,
            status=ArticleStatus.POSTULADO,
            is_enabled=True,
        )

        # Coautor cuyo email coincide con self.juror_coauthor
        self.coauthor = CoAuthor.objects.create(
            article=self.article,
            full_name="Ing. Mateo Gómez",
            email="mateo.gomez@univalle.edu.co",
            affiliation="Universidad del Valle",
            is_corresponding_author=False,
        )

        self.assign_url = reverse("assign-reviewers")
        self.suggest_url = reverse("suggest-reviewers")
        self.committee_url = reverse("committee-members-list")

    # -------------------------------------------------------------------------
    # 1. Asignación exitosa de 3 jurados válidos (DoD 1 & QA 1)
    # -------------------------------------------------------------------------
    def test_assign_3_valid_reviewers_success(self):
        """
        Criterio de Aceptación (DoD 1 & QA 1):
        Asignar 3 jurados válidos retorna HTTP 200 y el artículo cambia a EN_REVISION.
        """
        self.client.force_authenticate(user=self.admin)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id, self.juror3.id],
        }

        response = self.client.post(self.assign_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["article_id"], self.article.id)
        self.assertEqual(response.data["article_status"], ArticleStatus.EN_REVISION)
        self.assertEqual(len(response.data["assignments"]), 3)

        # Verificar persistencia en base de datos
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.EN_REVISION)
        assignments = ArticleReviewer.objects.filter(article=self.article)
        self.assertEqual(assignments.count(), 3)
        assigned_ids = set(assignments.values_list("reviewer_id", flat=True))
        self.assertEqual(assigned_ids, {self.juror1.id, self.juror2.id, self.juror3.id})

    # -------------------------------------------------------------------------
    # 2. Conflicto de interés: autor como jurado (QA 2)
    # -------------------------------------------------------------------------
    def test_assign_author_as_reviewer_returns_400(self):
        """
        Caso de Prueba QA 2 (GCDC-161):
        Intentar asignar al autor del artículo como jurado retorna HTTP 400 Conflicto de interés.
        """
        self.client.force_authenticate(user=self.admin)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id, self.author.id],
        }

        response = self.client.post(self.assign_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Conflicto de interés", str(response.data["detail"]))

        # El estado del artículo no debe haber cambiado
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.POSTULADO)
        self.assertEqual(ArticleReviewer.objects.filter(article=self.article).count(), 0)

    # -------------------------------------------------------------------------
    # 3. Conflicto de interés: coautor como jurado
    # -------------------------------------------------------------------------
    def test_assign_coauthor_as_reviewer_returns_400(self):
        """
        Intentar asignar a un coautor registrado del artículo como jurado retorna HTTP 400.
        """
        self.client.force_authenticate(user=self.admin)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id, self.juror_coauthor.id],
        }

        response = self.client.post(self.assign_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Conflicto de interés", str(response.data["detail"]))
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.POSTULADO)

    # -------------------------------------------------------------------------
    # 4. Validación: exactamente 3 jurados distintos
    # -------------------------------------------------------------------------
    def test_assign_fewer_than_3_reviewers_fails(self):
        """Rechaza si se envían menos de 3 jurados."""
        self.client.force_authenticate(user=self.admin)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id],
        }
        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assign_duplicate_reviewer_ids_fails(self):
        """Rechaza si hay IDs de jurados repetidos."""
        self.client.force_authenticate(user=self.admin)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror1.id, self.juror2.id],
        }
        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # -------------------------------------------------------------------------
    # 5. Validación: artículo que ya tiene 3 jurados
    # -------------------------------------------------------------------------
    def test_assign_to_article_already_with_3_reviewers_fails(self):
        """Un artículo que ya tiene 3 jurados rechaza nuevas asignaciones."""
        ArticleReviewer.objects.create(article=self.article, reviewer=self.juror1)
        ArticleReviewer.objects.create(article=self.article, reviewer=self.juror2)
        ArticleReviewer.objects.create(article=self.article, reviewer=self.juror3)

        self.client.force_authenticate(user=self.admin)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id, self.juror3.id],
        }
        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ya cuenta con exactamente 3 jurados", str(response.data["detail"]))

    # -------------------------------------------------------------------------
    # 6. Permisos de acceso RBAC
    # -------------------------------------------------------------------------
    def test_author_cannot_assign_reviewers(self):
        """Un autor no tiene permisos para asignar jurados (403 Forbidden)."""
        self.client.force_authenticate(user=self.author)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id, self.juror3.id],
        }
        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_unauthenticated_cannot_assign_reviewers(self):
        """Petición anónima es rechazada con 401 Unauthorized."""
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id, self.juror3.id],
        }
        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_committee_member_can_assign_reviewers(self):
        """Un miembro del comité tiene permisos para realizar asignaciones."""
        self.client.force_authenticate(user=self.juror1)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.juror1.id, self.juror2.id, self.juror3.id],
        }
        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["article_status"], ArticleStatus.EN_REVISION)

    # -------------------------------------------------------------------------
    # 7. Endpoint de sugerencias balanceadas
    # -------------------------------------------------------------------------
    def test_suggest_reviewers_excludes_conflicts(self):
        """El endpoint de sugerencias excluye al autor y a los coautores."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.suggest_url, {"article_id": self.article.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        suggested_ids = [s["id"] for s in response.data]

        self.assertNotIn(self.author.id, suggested_ids)
        self.assertNotIn(self.juror_coauthor.id, suggested_ids)
        self.assertIn(self.juror1.id, suggested_ids)
        self.assertIn(self.juror2.id, suggested_ids)
        self.assertIn(self.juror3.id, suggested_ids)

    # -------------------------------------------------------------------------
    # 8. Endpoint de catálogo de miembros del comité
    # -------------------------------------------------------------------------
    def test_committee_members_list_endpoint(self):
        """Retorna la lista de miembros del comité con su contador de asignaciones."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.committee_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsInstance(response.data, list)
        member_ids = [m["id"] for m in response.data]
        self.assertIn(self.juror1.id, member_ids)
        self.assertNotIn(self.author.id, member_ids)
