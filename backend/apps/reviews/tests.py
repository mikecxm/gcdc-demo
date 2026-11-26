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


class AssignReviewersTests(APITestCase):
    """
    Pruebas de aceptación y QA para GCDC-161 (HU-12):
    Servicio de asignación balanceada de 3 jurados con validación de conflictos.
    """

    def setUp(self):
        for r in RoleName.values:
            Role.objects.get_or_create(name=r)

        # Autor responsable del artículo
        self.author = User.objects.create_user(
            email="autor@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Carlos Mendoza",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        # 4 miembros del comité (3 para asignar + 1 extra para pruebas de balanceo)
        self.committee1 = User.objects.create_user(
            email="jurado1@univalle.edu.co",
            password="Password123!",
            full_name="Dra. Elena Valencia",
            affiliation="Universidad del Valle - Comité",
            roles=[RoleName.COMITE],
        )
        self.committee2 = User.objects.create_user(
            email="jurado2@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Fernando Duque",
            affiliation="Universidad del Valle - Comité",
            roles=[RoleName.COMITE],
        )
        self.committee3 = User.objects.create_user(
            email="jurado3@univalle.edu.co",
            password="Password123!",
            full_name="Dra. María Ortiz",
            affiliation="Pontificia Universidad Javeriana",
            roles=[RoleName.COMITE],
        )
        self.committee4 = User.objects.create_user(
            email="jurado4@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Ricardo Pérez",
            affiliation="Universidad del Valle - Comité",
            roles=[RoleName.COMITE],
        )

        # Administrador
        self.admin_user = User.objects.create_user(
            email="admin@univalle.edu.co",
            password="Password123!",
            full_name="Sarah Chen",
            affiliation="Universidad del Valle - Admin",
            roles=[RoleName.ADMIN],
        )

        # Usuario con doble rol: COMITE y AUTOR (para prueba de conflicto)
        self.committee_and_author = User.objects.create_user(
            email="dual@univalle.edu.co",
            password="Password123!",
            full_name="Dr. Dual Role",
            affiliation="Universidad del Valle",
            roles=[RoleName.COMITE, RoleName.AUTOR],
        )

        # Línea temática y artículo de prueba
        self.line_ia, _ = ThematicLine.objects.get_or_create(name="Sistemas Inteligentes")

        self.article = Article.objects.create(
            title="Optimización de Modelos Fundacionales",
            abstract="Resumen sobre modelos fundacionales.",
            keywords="IA, Modelos",
            thematic_line=self.line_ia,
            responsible_author=self.author,
            status=ArticleStatus.POSTULADO,
            is_enabled=True,
        )

        # Coautor del artículo (email coincide con un miembro del comité para conflicto)
        self.coauthor = CoAuthor.objects.create(
            article=self.article,
            full_name="Dra. María Ortiz",
            email="jurado3@univalle.edu.co",  # mismo email que committee3
            affiliation="Pontificia Universidad Javeriana",
            is_corresponding_author=False,
        )

        self.assign_url = reverse("assign-reviewers")
        self.suggest_url = reverse("suggest-reviewers")

    # -----------------------------------------------------------------
    # 1. Asignación exitosa de 3 jurados (Caso de Prueba QA 1)
    # -----------------------------------------------------------------
    def test_assign_3_valid_reviewers_success(self):
        """
        Criterio de Aceptación (DoD 1 & QA 1):
        Asignar 3 jurados válidos retorna HTTP 200 y cambia estado a EN_REVISION.
        """
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee4.id,  # committee3 excluido por conflicto de coautoría
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["article_id"], self.article.id)
        self.assertEqual(response.data["article_status"], ArticleStatus.EN_REVISION)
        self.assertEqual(len(response.data["assignments"]), 3)

        # Verificar persistencia en BD
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.EN_REVISION)
        self.assertEqual(
            ArticleReviewer.objects.filter(article=self.article).count(), 3
        )

        # Verificar que los IDs de jurado correctos fueron asignados
        assigned_ids = set(
            ArticleReviewer.objects.filter(article=self.article).values_list(
                "reviewer_id", flat=True
            )
        )
        self.assertEqual(
            assigned_ids,
            {self.committee1.id, self.committee2.id, self.committee4.id},
        )

    # -----------------------------------------------------------------
    # 2. Conflicto de interés: autor como jurado (Caso de Prueba QA 2)
    # -----------------------------------------------------------------
    def test_assign_author_as_reviewer_returns_400(self):
        """
        Caso de Prueba QA 2 (GCDC-161):
        Intentar asignar al autor del artículo como jurado retorna HTTP 400.
        """
        self.client.force_authenticate(user=self.admin_user)

        # El autor también tiene rol COMITE (dual) para intentar autoevaluarse
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.author.id,  # conflicto: es el autor responsable
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

        # El artículo no cambió de estado
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.POSTULADO)
        self.assertEqual(
            ArticleReviewer.objects.filter(article=self.article).count(), 0
        )

    def test_committee_author_cannot_suggest_or_assign_jurors_to_own_article(self):
        self.article.responsible_author = self.committee_and_author
        self.article.save(update_fields=["responsible_author"])
        self.client.force_authenticate(user=self.committee_and_author)

        suggestions_response = self.client.get(
            self.suggest_url, {"article_id": self.article.id}
        )
        assignments_response = self.client.post(
            self.assign_url,
            {
                "article_id": self.article.id,
                "reviewer_ids": [
                    self.committee1.id,
                    self.committee2.id,
                    self.committee4.id,
                ],
            },
            format="json",
        )

        self.assertEqual(suggestions_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(assignments_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn("conflicto de interés", assignments_response.data["detail"])
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.POSTULADO)
        self.assertFalse(ArticleReviewer.objects.filter(article=self.article).exists())

    # -----------------------------------------------------------------
    # 3. Conflicto de interés: coautor como jurado
    # -----------------------------------------------------------------
    def test_assign_coauthor_as_reviewer_returns_400(self):
        """Intentar asignar a un coautor del artículo retorna HTTP 400."""
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee3.id,  # conflicto: su email coincide con un coautor
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)

        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.POSTULADO)

    # -----------------------------------------------------------------
    # 4. Validación: exactamente 3 jurados
    # -----------------------------------------------------------------
    def test_assign_less_than_3_reviewers_returns_400(self):
        """Intentar asignar menos de 3 jurados retorna HTTP 400."""
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [self.committee1.id, self.committee2.id],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_assign_more_than_3_reviewers_returns_400(self):
        """Intentar asignar más de 3 jurados retorna HTTP 400."""
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee3.id,
                self.committee4.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # -----------------------------------------------------------------
    # 5. Validación: jurados duplicados
    # -----------------------------------------------------------------
    def test_assign_duplicate_reviewer_ids_returns_400(self):
        """Intentar asignar IDs duplicados retorna HTTP 400."""
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee1.id,
                self.committee2.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # -----------------------------------------------------------------
    # 6. Artículo ya tiene 3 jurados asignados
    # -----------------------------------------------------------------
    def test_assign_to_article_already_with_3_reviewers_returns_400(self):
        """Un artículo que ya tiene 3 jurados no acepta una nueva asignación."""
        # Pre-asignar 3 jurados manualmente
        ArticleReviewer.objects.create(article=self.article, reviewer=self.committee1)
        ArticleReviewer.objects.create(article=self.article, reviewer=self.committee2)
        ArticleReviewer.objects.create(article=self.article, reviewer=self.committee4)

        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee4.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("ya tiene 3 jurados", response.data["detail"])

    # -----------------------------------------------------------------
    # 7. Artículo que no está en estado POSTULADO
    # -----------------------------------------------------------------
    def test_assign_to_article_not_in_postulado_returns_400(self):
        """Solo artículos en estado POSTULADO pueden recibir jurados."""
        self.article.status = ArticleStatus.ACEPTADO
        self.article.save()

        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee4.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("POSTULADO", response.data["detail"])

    # -----------------------------------------------------------------
    # 8. Artículo inexistente o deshabilitado
    # -----------------------------------------------------------------
    def test_assign_to_nonexistent_article_returns_404(self):
        """Intentar asignar jurados a un artículo inexistente retorna 404."""
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": 999999,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee4.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    # -----------------------------------------------------------------
    # 9. Permisos: autor no puede asignar jurados
    # -----------------------------------------------------------------
    def test_author_cannot_assign_reviewers(self):
        """Un autor (sin rol ADMIN/COMITE) no puede asignar jurados."""
        self.client.force_authenticate(user=self.author)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee4.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    # -----------------------------------------------------------------
    # 10. Petición sin autenticación
    # -----------------------------------------------------------------
    def test_unauthenticated_request_returns_401(self):
        """Petición anónima al endpoint de asignación retorna 401."""
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee4.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    # -----------------------------------------------------------------
    # 11. Usuario sin rol COMITE no puede ser jurado
    # -----------------------------------------------------------------
    def test_assign_non_committee_user_returns_400(self):
        """Intentar asignar un usuario sin rol COMITE retorna HTTP 400."""
        # Crear un usuario solo con rol AUTOR
        only_author = User.objects.create_user(
            email="otro.autor@univalle.edu.co",
            password="Password123!",
            full_name="Otro Autor",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                only_author.id,  # no tiene rol COMITE
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    # -----------------------------------------------------------------
    # 12. Sugerencias de jurados balanceados
    # -----------------------------------------------------------------
    def test_suggest_reviewers_excludes_conflicts(self):
        """
        Las sugerencias de jurados excluyen al autor, coautores y jurados ya asignados.
        """
        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            self.suggest_url, {"article_id": self.article.id}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        suggested_ids = [s["id"] for s in response.data]

        # El autor responsable NO debe aparecer
        self.assertNotIn(self.author.id, suggested_ids)
        # committee3 NO debe aparecer (email coincide con coautor)
        self.assertNotIn(self.committee3.id, suggested_ids)
        # committee1, committee2, committee4 SÍ deben aparecer
        self.assertIn(self.committee1.id, suggested_ids)
        self.assertIn(self.committee2.id, suggested_ids)
        self.assertIn(self.committee4.id, suggested_ids)

    def test_suggest_reviewers_ordered_by_least_assignments(self):
        """Los jurados sugeridos están ordenados por menor carga asignada."""
        # Pre-asignar 2 artículos a committee1
        art2 = Article.objects.create(
            title="Segundo artículo",
            abstract="Resumen.",
            keywords="IA",
            thematic_line=self.line_ia,
            responsible_author=self.author,
            status=ArticleStatus.POSTULADO,
        )
        art3 = Article.objects.create(
            title="Tercer artículo",
            abstract="Resumen.",
            keywords="IA",
            thematic_line=self.line_ia,
            responsible_author=self.author,
            status=ArticleStatus.POSTULADO,
        )
        ArticleReviewer.objects.create(article=art2, reviewer=self.committee1)
        ArticleReviewer.objects.create(article=art3, reviewer=self.committee1)

        self.client.force_authenticate(user=self.admin_user)
        response = self.client.get(
            self.suggest_url, {"article_id": self.article.id}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        assignments_list = [s["current_assignments"] for s in response.data]
        # Debe estar en orden ascendente
        self.assertEqual(assignments_list, sorted(assignments_list))
        # committee1 debe tener la mayor carga
        committee1_data = next(
            (s for s in response.data if s["id"] == self.committee1.id), None
        )
        self.assertIsNotNone(committee1_data)
        self.assertEqual(committee1_data["current_assignments"], 2)

    # -----------------------------------------------------------------
    # 13. Miembro del comité puede asignar jurados
    # -----------------------------------------------------------------
    def test_committee_can_assign_reviewers(self):
        """Un miembro del comité puede realizar asignaciones de jurados."""
        self.client.force_authenticate(user=self.committee1)
        payload = {
            "article_id": self.article.id,
            "reviewer_ids": [
                self.committee1.id,
                self.committee2.id,
                self.committee4.id,
            ],
        }

        response = self.client.post(self.assign_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["article_status"], ArticleStatus.EN_REVISION)
