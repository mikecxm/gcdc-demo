import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.conferences.models import (
    Article,
    ArticleMetadataAudit,
    ArticleStatus,
    ThematicLine,
)
from apps.users.models import CustomUser, RoleName


pytestmark = pytest.mark.django_db


@pytest.fixture
def disable_case():
    author = CustomUser.objects.create_user(
        email="hu10.autor.qa@univalle.edu.co",
        password="Clave-Segura-123",
        full_name="Autor QA HU-10",
        affiliation="Universidad del Valle",
        roles=[RoleName.AUTOR],
    )
    committee = CustomUser.objects.create_user(
        email="hu10.comite.qa@univalle.edu.co",
        password="Clave-Segura-123",
        full_name="Comité QA HU-10",
        affiliation="Universidad del Valle",
        roles=[RoleName.COMITE],
    )
    admin = CustomUser.objects.create_user(
        email="hu10.admin.qa@univalle.edu.co",
        password="Clave-Segura-123",
        full_name="Admin QA HU-10",
        affiliation="Universidad del Valle",
        roles=[RoleName.ADMIN],
    )
    line, _ = ThematicLine.objects.get_or_create(name="QA HU-10")
    article = Article.objects.create(
        title="Artículo de prueba HU-10",
        abstract="Resumen de prueba para deshabilitación lógica.",
        keywords="qa, hu-10",
        thematic_line=line,
        responsible_author=author,
    )
    return {
        "author": author,
        "committee": committee,
        "admin": admin,
        "article": article,
    }


def authenticated_client(user):
    client = APIClient()
    token = AccessToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    return client


def disable_article(user, article, reason="Motivo QA de baja lógica."):
    client = authenticated_client(user)
    return client.post(
        reverse("article-disable", kwargs={"pk": article.pk}),
        {"reason": reason},
        format="json",
    )


def test_author_cannot_disable_article(disable_case):
    article = disable_case["article"]

    response = disable_article(disable_case["author"], article)

    assert response.status_code == 403
    article.refresh_from_db()
    assert article.is_enabled
    assert not ArticleMetadataAudit.objects.filter(article=article).exists()


@pytest.mark.parametrize("role", ["committee", "admin"])
def test_committee_and_admin_disable_article_with_audit(disable_case, role):
    user = disable_case[role]
    article = disable_case["article"]
    reason = "Motivo QA de baja lógica."

    response = disable_article(user, article, reason)

    assert response.status_code == 200
    body = response.json()
    article.refresh_from_db()
    assert body["id"] == article.pk
    assert body["is_enabled"] is False
    assert body["status"] == ArticleStatus.DESHABILITADO
    assert body["disabled_reason"] == reason
    assert body["disabled_at"]
    assert article.is_enabled is False
    assert article.is_permanently_disabled is True
    assert article.status == ArticleStatus.DESHABILITADO
    assert article.disabled_reason == reason
    assert article.disabled_at is not None

    audits = {
        audit.field_name: audit
        for audit in ArticleMetadataAudit.objects.filter(article=article)
    }
    assert set(audits) == {
        "is_enabled",
        "status",
        "disabled_reason",
        "disabled_at",
        "disabled_by",
    }
    assert (audits["is_enabled"].old_value, audits["is_enabled"].new_value) == (
        "True",
        "False",
    )
    assert audits["status"].old_value == ArticleStatus.POSTULADO
    assert audits["status"].new_value == ArticleStatus.DESHABILITADO
    assert audits["disabled_reason"].old_value is None
    assert audits["disabled_reason"].new_value == reason
    assert audits["disabled_at"].new_value == article.disabled_at.isoformat()
    assert audits["disabled_by"].new_value == user.email
    assert all(audit.modified_at is not None for audit in audits.values())


@pytest.mark.parametrize("payload", [{}, {"reason": ""}, {"reason": "   "}])
def test_missing_or_blank_reason_is_rejected_without_changes(disable_case, payload):
    article = disable_case["article"]
    client = authenticated_client(disable_case["committee"])

    response = client.post(
        reverse("article-disable", kwargs={"pk": article.pk}),
        payload,
        format="json",
    )

    assert response.status_code == 400
    article.refresh_from_db()
    assert article.is_enabled
    assert not ArticleMetadataAudit.objects.filter(article=article).exists()


def test_already_disabled_article_returns_400_without_new_audit(disable_case):
    article = disable_case["article"]
    article.is_enabled = False
    article.status = ArticleStatus.DESHABILITADO
    article.disabled_reason = "Deshabilitado previamente."
    article.save()

    response = disable_article(disable_case["committee"], article)

    assert response.status_code == 400
    article.refresh_from_db()
    assert article.disabled_reason == "Deshabilitado previamente."
    assert not ArticleMetadataAudit.objects.filter(article=article).exists()


def test_author_cannot_list_or_view_disabled_article(disable_case):
    article = disable_case["article"]
    assert disable_article(disable_case["committee"], article).status_code == 200
    client = authenticated_client(disable_case["author"])

    list_response = client.get(reverse("article-list"))
    detail_response = client.get(reverse("article-detail", kwargs={"pk": article.pk}))

    assert list_response.status_code == 200
    assert article.pk not in {item["id"] for item in list_response.json()}
    assert detail_response.status_code == 404


@pytest.mark.parametrize("role", ["committee", "admin"])
def test_committee_and_admin_queries_exclude_disabled_article(disable_case, role):
    article = disable_case["article"]
    user = disable_case[role]
    assert disable_article(user, article).status_code == 200
    client = authenticated_client(user)

    list_response = client.get(reverse("article-list"))
    detail_response = client.get(reverse("article-detail", kwargs={"pk": article.pk}))
    suggestions_response = client.get(
        reverse("suggest-reviewers"), {"article_id": article.pk}
    )
    assignments_response = client.post(
        reverse("assign-reviewers"),
        {"article_id": article.pk, "reviewer_ids": [101, 102, 103]},
        format="json",
    )

    assert list_response.status_code == 200
    assert article.pk not in {item["id"] for item in list_response.json()}
    assert detail_response.status_code == 404
    assert suggestions_response.status_code == 404
    assert assignments_response.status_code == 404
