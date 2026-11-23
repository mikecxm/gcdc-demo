from django.test import TestCase
from rest_framework.test import APIClient

from apps.conferences.models import Article, ArticleStatus, ThematicLine
from apps.users.models import CustomUser, RoleName


def make_user(email, roles):
    return CustomUser.objects.create_user(
        email=email,
        password="Clave-Segura-123",
        full_name="Usuario de Prueba",
        affiliation="Universidad del Valle",
        roles=roles,
    )


class ArticleDisableTests(TestCase):
    def setUp(self):
        self.author = make_user("autor@correounivalle.edu.co", [RoleName.AUTOR])
        self.committee = make_user("comite@correounivalle.edu.co", [RoleName.COMITE])
        self.admin = make_user("admin@correounivalle.edu.co", [RoleName.ADMIN])
        self.article = Article.objects.create(
            title="Artículo a deshabilitar",
            abstract="Resumen.",
            keywords="prueba",
            thematic_line=ThematicLine.objects.first(),
            responsible_author=self.author,
        )
        self.url = f"/api/v1/articles/{self.article.id}/disable/"
        self.client = APIClient()

    def test_committee_can_disable_article(self):
        self.client.force_authenticate(user=self.committee)
        response = self.client.post(
            self.url, {"reason": "Contenido duplicado"}, format="json"
        )
        self.assertEqual(response.status_code, 200)
        self.article.refresh_from_db()
        self.assertFalse(self.article.is_enabled)
        self.assertTrue(self.article.is_permanently_disabled)
        self.assertEqual(self.article.status, ArticleStatus.DESHABILITADO)
        self.assertEqual(self.article.disabled_reason, "Contenido duplicado")
        self.assertIsNotNone(self.article.disabled_at)

    def test_author_cannot_disable_article(self):
        self.client.force_authenticate(user=self.author)
        response = self.client.post(self.url, {"reason": "Quiero borrarlo"}, format="json")
        self.assertEqual(response.status_code, 403)
        self.article.refresh_from_db()
        self.assertTrue(self.article.is_enabled)

    def test_admin_can_disable_article(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.url, {"reason": "Prueba"}, format="json")
        self.assertEqual(response.status_code, 200)
        self.article.refresh_from_db()
        self.assertFalse(self.article.is_enabled)

    def test_anonymous_cannot_disable_article(self):
        response = self.client.post(self.url, {"reason": "Prueba"}, format="json")
        self.assertIn(response.status_code, (401, 403))
        self.article.refresh_from_db()
        self.assertTrue(self.article.is_enabled)

    def test_reason_is_required(self):
        self.client.force_authenticate(user=self.committee)
        response = self.client.post(self.url, {}, format="json")
        self.assertEqual(response.status_code, 400)
        self.article.refresh_from_db()
        self.assertTrue(self.article.is_enabled)

    def test_blank_reason_is_rejected(self):
        self.client.force_authenticate(user=self.committee)
        response = self.client.post(self.url, {"reason": ""}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_cannot_disable_twice(self):
        self.client.force_authenticate(user=self.committee)
        self.client.post(self.url, {"reason": "Primera vez"}, format="json")
        response = self.client.post(self.url, {"reason": "Segunda vez"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.article.refresh_from_db()
        self.assertEqual(self.article.disabled_reason, "Primera vez")

    def test_unknown_article_returns_404(self):
        self.client.force_authenticate(user=self.committee)
        response = self.client.post(
            "/api/v1/articles/999999/disable/", {"reason": "Prueba"}, format="json"
        )
        self.assertEqual(response.status_code, 404)