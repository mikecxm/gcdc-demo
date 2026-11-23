from io import BytesIO
from datetime import timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.conferences.models import (
    Article,
    ArticleStatus,
    ArticleVersion,
    Conference,
    ThematicLine,
    VersionStage,
)
from apps.users.models import CustomUser, RoleName

BOGOTA = ZoneInfo("America/Bogota")


def today():
    return timezone.now().astimezone(BOGOTA).date()


def make_user(email, roles):
    return CustomUser.objects.create_user(
        email=email,
        password="Clave-Segura-123",
        full_name="Usuario de Prueba",
        affiliation="Universidad del Valle",
        roles=roles,
    )


def make_conference(deadline):
    return Conference.objects.create(
        edition_name="Edición de prueba",
        submission_deadline=deadline,
        evaluation_deadline=deadline + timedelta(days=10),
        presentation_version_deadline=deadline + timedelta(days=20),
        publication_version_deadline=deadline + timedelta(days=30),
        event_start_date=deadline + timedelta(days=40),
        event_end_date=deadline + timedelta(days=44),
    )


def make_pdf(size_extra=0, content_type="application/pdf", header=b"%PDF-"):
    content = header + b"1.4 contenido de prueba" + b"0" * size_extra
    return SimpleUploadedFile("nuevo.pdf", content, content_type=content_type)


class ArticleVersionTests(TestCase):
    def setUp(self):
        self.author = make_user("autor@correounivalle.edu.co", [RoleName.AUTOR])
        self.other_author = make_user("otro@correounivalle.edu.co", [RoleName.AUTOR])
        self.committee = make_user("comite@correounivalle.edu.co", [RoleName.COMITE])
        make_conference(today() + timedelta(days=7))
        self.article = Article.objects.create(
            title="Artículo con versiones",
            abstract="Resumen.",
            keywords="prueba",
            thematic_line=ThematicLine.objects.first(),
            responsible_author=self.author,
        )
        ArticleVersion.objects.create(
            article=self.article,
            version_number=1,
            stage=VersionStage.INICIAL,
            pdf_url=f"articles/{self.article.pk}/v1.pdf",
        )
        self.url = f"/api/v1/articles/{self.article.id}/versions/"
        self.client = APIClient()
        self.client.force_authenticate(user=self.author)

    @patch("apps.articles.version_views.storage")
    def test_author_replaces_pdf_and_keeps_history(self, storage):
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(
            set(response.data),
            {"id", "version_number", "stage", "uploaded_at"},
        )
        self.assertEqual(response.data["version_number"], 2)
        self.assertEqual(self.article.versions.count(), 2)
        storage.upload_pdf.assert_called_once()
        self.assertTrue(
            self.article.versions.filter(version_number=1).exists()
        )

    @patch("apps.articles.version_views.storage")
    def test_version_numbers_keep_increasing(self, storage):
        self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["version_number"], 3)

    @patch("apps.articles.version_views.storage")
    def test_rejects_after_deadline(self, storage):
        Conference.objects.all().delete()
        make_conference(today() - timedelta(days=1))
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.article.versions.count(), 1)
        storage.upload_pdf.assert_not_called()

    @patch("apps.articles.version_views.storage")
    def test_other_author_cannot_replace_pdf(self, storage):
        self.client.force_authenticate(user=self.other_author)
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(self.article.versions.count(), 1)

    @patch("apps.articles.version_views.storage")
    def test_committee_cannot_replace_pdf(self, storage):
        self.client.force_authenticate(user=self.committee)
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 403)

    @patch("apps.articles.version_views.storage")
    def test_rejects_disabled_article(self, storage):
        self.article.is_enabled = False
        self.article.save()
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(self.article.versions.count(), 1)

    @patch("apps.articles.version_views.storage")
    def test_rejects_article_already_in_review(self, storage):
        self.article.status = ArticleStatus.EN_REVISION
        self.article.save()
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 400)

    @patch("apps.articles.version_views.storage")
    def test_rejects_invalid_pdfs(self, storage):
        for pdf in (
            make_pdf(content_type="text/plain"),
            make_pdf(header=b"MZ---"),
            make_pdf(size_extra=10 * 1024 * 1024),
        ):
            response = self.client.post(self.url, {"pdf": pdf}, format="multipart")
            self.assertEqual(response.status_code, 400)
        self.assertEqual(self.article.versions.count(), 1)
        storage.upload_pdf.assert_not_called()

    @patch("apps.articles.version_views.storage")
    def test_failed_upload_leaves_no_version_behind(self, storage):
        storage.upload_pdf.side_effect = RuntimeError("Supabase caído")
        self.client.raise_request_exception = False
        response = self.client.post(self.url, {"pdf": make_pdf()}, format="multipart")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(self.article.versions.count(), 1)

    def test_unknown_article_returns_404(self):
        response = self.client.post(
            "/api/v1/articles/999999/versions/", {"pdf": make_pdf()}, format="multipart"
        )
        self.assertEqual(response.status_code, 404)

    def test_author_can_list_version_history(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["version_number"], 1)
        self.assertEqual(
            set(response.data[0]),
            {"id", "version_number", "stage", "uploaded_at"},
        )

    def test_other_author_cannot_list_history(self):
        self.client.force_authenticate(user=self.other_author)
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 403)

    @patch("apps.articles.download_views.storage.open_pdf")
    def test_author_can_download_a_specific_version(self, open_pdf):
        ArticleVersion.objects.create(
            article=self.article,
            version_number=2,
            stage=VersionStage.INICIAL,
            pdf_url=f"articles/{self.article.pk}/v2.pdf",
        )
        open_pdf.return_value = BytesIO(b"%PDF-1.4 version 1")
        response = self.client.get(
            f"/api/v1/articles/{self.article.pk}/pdf/?version_number=1"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn(f"article-{self.article.pk}-v1.pdf", response["Content-Disposition"])
        open_pdf.assert_called_once_with(f"articles/{self.article.pk}/v1.pdf")

    @patch("apps.articles.download_views.storage.open_pdf")
    def test_unknown_pdf_version_returns_404(self, open_pdf):
        response = self.client.get(
            f"/api/v1/articles/{self.article.pk}/pdf/?version_number=99"
        )

        self.assertEqual(response.status_code, 404)
        open_pdf.assert_not_called()