import json
from datetime import timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.conferences.models import (
    Article,
    ArticleVersion,
    CoAuthor,
    Conference,
    ThematicLine,
)
from apps.users.models import CustomUser, RoleName

URL = "/api/v1/articles/"
BOGOTA = ZoneInfo("America/Bogota")


def today():
    return timezone.now().astimezone(BOGOTA).date()


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
    return SimpleUploadedFile("articulo.pdf", content, content_type=content_type)


class ArticleSubmissionTests(TestCase):
    def setUp(self):
        self.author = CustomUser.objects.create_user(
            email="autor@correounivalle.edu.co",
            password="Clave-Segura-123",
            full_name="Autor de Prueba",
            affiliation="Universidad del Valle",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.author)
        self.line = ThematicLine.objects.first()
        make_conference(today() + timedelta(days=7))

    def payload(self, **overrides):
        data = {
            "title": "Un artículo de prueba",
            "abstract": "Resumen del artículo.",
            "keywords": "django, pruebas",
            "thematic_line": self.line.id,
            "coauthors": json.dumps(
                [
                    {
                        "full_name": "Coautor Uno",
                        "email": "coautor@example.com",
                        "affiliation": "Otra Universidad",
                    }
                ]
            ),
            "pdf": make_pdf(),
        }
        data.update(overrides)
        return data

    @patch("apps.articles.submission_views.storage")
    def test_creates_article_with_coauthors_and_version(self, storage):
        response = self.client.post(URL, self.payload(), format="multipart")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Article.objects.count(), 1)
        self.assertEqual(CoAuthor.objects.count(), 1)
        self.assertEqual(ArticleVersion.objects.count(), 1)
        storage.upload_pdf.assert_called_once()
        article = Article.objects.get()
        self.assertEqual(article.responsible_author, self.author)
        self.assertEqual(article.status, "POSTULADO")

    @patch("apps.articles.submission_views.storage")
    def test_rejects_submission_after_deadline(self, storage):
        Conference.objects.all().delete()
        make_conference(today() - timedelta(days=1))
        response = self.client.post(URL, self.payload(), format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Article.objects.count(), 0)
        storage.upload_pdf.assert_not_called()

    @patch("apps.articles.submission_views.storage")
    def test_rejects_non_pdf_content_type(self, storage):
        pdf = make_pdf(content_type="text/plain")
        response = self.client.post(URL, self.payload(pdf=pdf), format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Article.objects.count(), 0)

    @patch("apps.articles.submission_views.storage")
    def test_rejects_file_that_is_not_really_a_pdf(self, storage):
        pdf = make_pdf(header=b"MZ---")
        response = self.client.post(URL, self.payload(pdf=pdf), format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Article.objects.count(), 0)

    @patch("apps.articles.submission_views.storage")
    def test_rejects_pdf_larger_than_10mb(self, storage):
        pdf = make_pdf(size_extra=10 * 1024 * 1024)
        response = self.client.post(URL, self.payload(pdf=pdf), format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Article.objects.count(), 0)

    @patch("apps.articles.submission_views.storage")
    def test_accepts_pdf_just_under_10mb(self, storage):
        pdf = make_pdf(size_extra=10 * 1024 * 1024 - 1024)
        response = self.client.post(URL, self.payload(pdf=pdf), format="multipart")
        self.assertEqual(response.status_code, 201)

    @patch("apps.articles.submission_views.storage")
    def test_non_author_cannot_submit(self, storage):
        committee = CustomUser.objects.create_user(
            email="comite@correounivalle.edu.co",
            password="Clave-Segura-123",
            full_name="Miembro Comité",
            affiliation="Universidad del Valle",
            roles=[RoleName.COMITE],
        )
        self.client.force_authenticate(user=committee)
        response = self.client.post(URL, self.payload(), format="multipart")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(Article.objects.count(), 0)

    def test_anonymous_cannot_submit(self):
        client = APIClient()
        response = client.post(URL, self.payload(), format="multipart")
        self.assertIn(response.status_code, (401, 403))

    @patch("apps.articles.submission_views.storage")
    def test_failed_upload_leaves_no_article_behind(self, storage):
        storage.upload_pdf.side_effect = RuntimeError("Supabase caído")
        self.client.raise_request_exception = False
        response = self.client.post(URL, self.payload(), format="multipart")
        self.assertEqual(response.status_code, 500)
        self.assertEqual(Article.objects.count(), 0)
        self.assertEqual(CoAuthor.objects.count(), 0)