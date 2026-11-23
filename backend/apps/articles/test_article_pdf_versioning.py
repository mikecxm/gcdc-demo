from datetime import timedelta
from hashlib import sha256
from zoneinfo import ZoneInfo

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.articles import storage
from apps.conferences.models import (
    Article,
    ArticleStatus,
    ArticleVersion,
    Conference,
    ThematicLine,
    VersionStage,
)
from apps.users.models import CustomUser, RoleName


pytestmark = pytest.mark.django_db(transaction=True)

BOGOTA = ZoneInfo("America/Bogota")
MAX_PDF_SIZE = 10 * 1024 * 1024
VERSIONS_URL = "/api/v1/articles/{article_id}/versions/"
PDF_URL = "/api/v1/articles/{article_id}/pdf/"


def make_valid_pdf(label):
    content_stream = f"BT /F1 14 Tf 50 700 Td ({label}) Tj ET\n".encode("ascii")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>"
        ),
        (
            f"<< /Length {len(content_stream)} >>\n".encode("ascii")
            + b"stream\n"
            + content_stream
            + b"endstream"
        ),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for number, body in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{number} 0 obj\n".encode("ascii"))
        pdf.extend(body)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))
    pdf.extend(
        (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    return bytes(pdf)


class FakeBucket:
    def __init__(self):
        self.uploads = []
        self.files = {}

    def upload(self, path, content, options):
        content = bytes(content)
        self.uploads.append((path, content, dict(options)))
        self.files[path] = content

    def download(self, path):
        return self.files[path]


class FakeSupabaseStorage:
    def __init__(self, bucket):
        self.bucket = bucket
        self.bucket_names = []

    def from_(self, bucket_name):
        self.bucket_names.append(bucket_name)
        return self.bucket


class FakeSupabaseClient:
    def __init__(self, bucket):
        self.storage = FakeSupabaseStorage(bucket)


@pytest.fixture
def article_case():
    author = CustomUser.objects.create_user(
        email="hu11.autor.qa@univalle.edu.co",
        password="Clave-Segura-123",
        full_name="Autor QA HU-11",
        affiliation="Universidad del Valle",
        roles=[RoleName.AUTOR],
    )
    line, _ = ThematicLine.objects.get_or_create(name="QA HU-11")
    today = timezone.now().astimezone(BOGOTA).date()
    deadline = today + timedelta(days=1)
    conference = Conference.objects.create(
        edition_name="Edición QA HU-11",
        submission_deadline=deadline,
        evaluation_deadline=deadline + timedelta(days=10),
        presentation_version_deadline=deadline + timedelta(days=20),
        publication_version_deadline=deadline + timedelta(days=30),
        event_start_date=deadline + timedelta(days=40),
        event_end_date=deadline + timedelta(days=44),
    )
    article = Article.objects.create(
        title="Artículo de prueba HU-11",
        abstract="Resumen para las pruebas de versionamiento.",
        keywords="qa, pdf, hu-11",
        thematic_line=line,
        responsible_author=author,
        status=ArticleStatus.POSTULADO,
        is_enabled=True,
    )

    return {
        "article": article,
        "author": author,
        "conference": conference,
    }


@pytest.fixture
def supabase_bucket(monkeypatch, settings):
    settings.ARTICLE_PDF_STORAGE_BACKEND = "supabase"
    bucket = FakeBucket()
    client = FakeSupabaseClient(bucket)
    monkeypatch.setattr(storage, "_get_client", lambda: client)
    monkeypatch.setattr(
        storage,
        "config",
        lambda key, default=None: "qa-article-pdfs"
        if key == "SUPABASE_BUCKET"
        else default,
    )
    return bucket, client.storage


def authenticated_client(user):
    client = APIClient()
    token = AccessToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def upload_pdf(client, article, content, content_type="application/pdf"):
    return client.post(
        VERSIONS_URL.format(article_id=article.pk),
        {
            "pdf": SimpleUploadedFile(
                "manuscript.pdf",
                content,
                content_type=content_type,
            )
        },
        format="multipart",
    )


def download_bytes(response):
    content = b"".join(response.streaming_content)
    response.close()
    return content


def test_upload_versions_and_downloads_preserve_exact_pdf_bytes(
    article_case, supabase_bucket
):
    article = article_case["article"]
    client = authenticated_client(article_case["author"])
    bucket, supabase_storage = supabase_bucket
    pdf_v1 = make_valid_pdf("HU-11 version one")
    pdf_v2 = make_valid_pdf("HU-11 version two")

    first = upload_pdf(client, article, pdf_v1)
    second = upload_pdf(client, article, pdf_v2)

    assert first.status_code == 201
    assert first.json()["version_number"] == 1
    assert second.status_code == 201
    assert second.json()["version_number"] == 2
    assert [version[0] for version in bucket.uploads] == [
        f"articles/{article.pk}/v1.pdf",
        f"articles/{article.pk}/v2.pdf",
    ]
    assert [version[1] for version in bucket.uploads] == [pdf_v1, pdf_v2]
    assert all(
        version[2] == {"content-type": "application/pdf", "upsert": "false"}
        for version in bucket.uploads
    )
    assert set(supabase_storage.bucket_names) == {"qa-article-pdfs"}

    versions_response = client.get(VERSIONS_URL.format(article_id=article.pk))
    assert versions_response.status_code == 200
    history = versions_response.json()
    assert [version["version_number"] for version in history] == [1, 2]
    assert all(
        set(version) == {"id", "version_number", "stage", "uploaded_at"}
        for version in history
    )
    assert all(version["stage"] == VersionStage.INICIAL for version in history)

    for version_number, expected_pdf in ((1, pdf_v1), (2, pdf_v2)):
        download_response = client.get(
            PDF_URL.format(article_id=article.pk),
            {"version_number": version_number},
        )
        assert download_response.status_code == 200
        assert download_response["Content-Type"] == "application/pdf"
        downloaded_pdf = download_bytes(download_response)
        assert downloaded_pdf == expected_pdf
        assert sha256(downloaded_pdf).hexdigest() == sha256(expected_pdf).hexdigest()

    latest_response = client.get(PDF_URL.format(article_id=article.pk))
    assert latest_response.status_code == 200
    assert download_bytes(latest_response) == pdf_v2


@pytest.mark.parametrize(
    ("content_type", "content"),
    [
        ("text/plain", make_valid_pdf("invalid text MIME")),
        ("application/exe", make_valid_pdf("invalid executable MIME")),
        ("application/pdf", b"plain text without a PDF signature"),
        ("application/pdf", b"\x00\x01\x02\x03\x04random bytes"),
    ],
)
def test_rejects_invalid_mime_or_pdf_signature_without_storage_upload(
    article_case, supabase_bucket, content_type, content
):
    article = article_case["article"]
    client = authenticated_client(article_case["author"])
    bucket, _ = supabase_bucket

    response = upload_pdf(client, article, content, content_type)

    assert response.status_code == 400
    assert article.versions.count() == 0
    assert bucket.uploads == []


def test_rejects_pdf_larger_than_10_mib_without_storage_upload(
    article_case, supabase_bucket
):
    article = article_case["article"]
    client = authenticated_client(article_case["author"])
    bucket, _ = supabase_bucket
    oversized_pdf = b"%PDF-1.4\n" + b"x" * MAX_PDF_SIZE

    response = upload_pdf(client, article, oversized_pdf)

    assert response.status_code == 400
    assert article.versions.count() == 0
    assert bucket.uploads == []


@pytest.mark.parametrize(
    ("days_from_today", "expected_status"),
    [(-1, 400), (0, 201)],
)
def test_submission_deadline_blocks_past_date_and_allows_deadline_day(
    article_case, supabase_bucket, days_from_today, expected_status
):
    article = article_case["article"]
    conference = article_case["conference"]
    conference.submission_deadline = (
        timezone.now().astimezone(BOGOTA).date()
        + timedelta(days=days_from_today)
    )
    conference.save(update_fields=["submission_deadline"])
    client = authenticated_client(article_case["author"])
    bucket, _ = supabase_bucket

    response = upload_pdf(client, article, make_valid_pdf("deadline boundary"))

    assert response.status_code == expected_status
    if expected_status == 400:
        assert "venció" in response.json()["detail"]
        assert article.versions.count() == 0
        assert bucket.uploads == []
    else:
        assert response.json()["version_number"] == 1
        assert article.versions.count() == 1
        assert len(bucket.uploads) == 1


def test_other_author_cannot_upload_a_version(article_case, supabase_bucket):
    article = article_case["article"]
    other_author = CustomUser.objects.create_user(
        email="hu11.otro.autor.qa@univalle.edu.co",
        password="Clave-Segura-123",
        full_name="Otro autor QA HU-11",
        affiliation="Universidad del Valle",
        roles=[RoleName.AUTOR],
    )
    bucket, _ = supabase_bucket

    response = upload_pdf(
        authenticated_client(other_author),
        article,
        make_valid_pdf("other author"),
    )

    assert response.status_code == 403
    assert article.versions.count() == 0
    assert bucket.uploads == []


def test_disabled_article_rejects_new_versions(article_case, supabase_bucket):
    article = article_case["article"]
    article.is_enabled = False
    article.save(update_fields=["is_enabled"])
    bucket, _ = supabase_bucket

    response = upload_pdf(
        authenticated_client(article_case["author"]),
        article,
        make_valid_pdf("disabled article"),
    )

    assert response.status_code == 400
    assert "no admite cambios" in response.json()["detail"]
    assert article.versions.count() == 0
    assert bucket.uploads == []


def test_local_storage_fallback_round_trips_pdf_bytes(
    article_case, settings, tmp_path
):
    settings.ARTICLE_PDF_STORAGE_BACKEND = "local"
    settings.ARTICLE_PDF_ROOT = tmp_path
    article = article_case["article"]
    client = authenticated_client(article_case["author"])
    pdf_bytes = make_valid_pdf("local fallback")

    response = upload_pdf(client, article, pdf_bytes)

    assert response.status_code == 201
    version = ArticleVersion.objects.get(article=article, version_number=1)
    stored_path = tmp_path / version.pdf_url
    assert stored_path.read_bytes() == pdf_bytes

    download_response = client.get(PDF_URL.format(article_id=article.pk))
    assert download_response.status_code == 200
    downloaded_pdf = download_bytes(download_response)
    assert downloaded_pdf == pdf_bytes
    assert sha256(downloaded_pdf).hexdigest() == sha256(pdf_bytes).hexdigest()
