import statistics
import time
from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from apps.conferences.models import Article, ArticleStatus, ThematicLine
from apps.users.models import CustomUser, RoleName


LIST_URL = "/api/v1/articles/"
DETAIL_URL = "/api/v1/articles/{}/"
ACTIVE_ARTICLE_COUNT = 1000
AUTHOR1_ARTICLE_COUNT = 25
RESPONSE_SLA_MS = 400
BENCHMARK_RUNS = 5


@pytest.fixture
def article_catalog(db):
    assert Article.objects.count() == 0
    thematic_lines = list(ThematicLine.objects.order_by("name"))
    assert len(thematic_lines) == 5

    committee = CustomUser.objects.create_user(
        email="comite.qa@univalle.edu.co",
        password="test-password-not-used",
        full_name="QA Comité",
        affiliation="QA local",
        roles=[RoleName.COMITE],
    )
    admin = CustomUser.objects.create_user(
        email="admin.qa@univalle.edu.co",
        password="test-password-not-used",
        full_name="QA Administrador",
        affiliation="QA local",
        roles=[RoleName.ADMIN],
    )
    author1 = CustomUser.objects.create_user(
        email="autor1.qa@univalle.edu.co",
        password="test-password-not-used",
        full_name="QA Autor 1",
        affiliation="QA local",
        roles=[RoleName.AUTOR],
    )
    author2 = CustomUser.objects.create_user(
        email="autor2.qa@univalle.edu.co",
        password="test-password-not-used",
        full_name="QA Autor 2",
        affiliation="QA local",
        roles=[RoleName.AUTOR],
    )

    statuses = [
        ArticleStatus.POSTULADO,
        ArticleStatus.EN_REVISION,
        ArticleStatus.ACEPTADO,
        ArticleStatus.RECHAZADO,
    ]
    now = timezone.now()
    articles = [
        Article(
            title=f"HU08 privacy QA article {index + 1:04d}",
            abstract=f"QA article {index + 1} for catalog filtering.",
            keywords=f"qa, hu08, group-{index % 25}",
            thematic_line=thematic_lines[index % len(thematic_lines)],
            responsible_author=author1 if index < AUTHOR1_ARTICLE_COUNT else author2,
            status=statuses[index % len(statuses)],
            is_enabled=True,
            submitted_at=now - timedelta(seconds=index),
        )
        for index in range(ACTIVE_ARTICLE_COUNT)
    ]
    Article.objects.bulk_create(articles, batch_size=500)

    disabled_articles = [
        Article(
            title="HU08 privacy QA disabled active status",
            abstract="Disabled fixture with a regular status.",
            keywords="qa, disabled",
            thematic_line=thematic_lines[0],
            responsible_author=author2,
            status=ArticleStatus.POSTULADO,
            is_enabled=False,
            disabled_reason="QA fixture",
            disabled_at=now,
            submitted_at=now,
        ),
        Article(
            title="HU08 privacy QA disabled status",
            abstract="Disabled fixture with the disabled status.",
            keywords="qa, disabled",
            thematic_line=thematic_lines[1],
            responsible_author=author2,
            status=ArticleStatus.DESHABILITADO,
            is_enabled=False,
            disabled_reason="QA fixture",
            disabled_at=now,
            submitted_at=now,
        ),
    ]
    Article.objects.bulk_create(disabled_articles)

    return {
        "committee": committee,
        "admin": admin,
        "author1": author1,
        "author2": author2,
        "thematic_lines": thematic_lines,
        "active_articles": list(
            Article.objects.filter(title__startswith="HU08 privacy QA article").order_by(
                "title"
            )
        ),
        "disabled_articles": list(
            Article.objects.filter(title__startswith="HU08 privacy QA disabled")
        ),
    }


@pytest.fixture(autouse=True)
def allow_test_client_host(settings):
    settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, "127.0.0.1"]


def authenticated_client(user):
    client = APIClient(HTTP_HOST="127.0.0.1")
    client.force_authenticate(user=user)
    return client


def response_items(response):
    assert response.status_code == 200, (
        f"Se esperaba HTTP 200, se obtuvo HTTP {response.status_code}."
    )
    data = response.data
    if isinstance(data, dict) and "results" in data:
        return data["results"]
    assert isinstance(data, list)
    return data


def test_disabled_articles_are_never_visible_to_any_role(article_catalog):
    disabled_ids = {article.id for article in article_catalog["disabled_articles"]}
    users = (
        article_catalog["committee"],
        article_catalog["admin"],
        article_catalog["author1"],
        article_catalog["author2"],
    )

    for user in users:
        client = authenticated_client(user)
        response = client.get(LIST_URL)

        assert response.status_code == 200
        items = response_items(response)
        assert all(item["is_enabled"] for item in items)
        assert not disabled_ids.intersection(item["id"] for item in items)

        disabled_detail = client.get(DETAIL_URL.format(next(iter(disabled_ids))))
        assert disabled_detail.status_code == 404


def test_author_cannot_list_or_open_another_authors_articles(article_catalog):
    author1 = article_catalog["author1"]
    author2 = article_catalog["author2"]
    client = authenticated_client(author1)
    response = client.get(LIST_URL)
    items = response_items(response)

    expected_ids = {
        article.id
        for article in article_catalog["active_articles"]
        if article.responsible_author_id == author1.id
    }
    assert response.status_code == 200
    assert {item["id"] for item in items} == expected_ids
    assert len(items) == AUTHOR1_ARTICLE_COUNT

    another_authors_article = next(
        article
        for article in article_catalog["active_articles"]
        if article.responsible_author_id == author2.id
    )
    detail_response = client.get(DETAIL_URL.format(another_authors_article.id))
    assert detail_response.status_code in (403, 404)

    own_article_id = next(iter(expected_ids))
    own_detail_response = client.get(DETAIL_URL.format(own_article_id))
    assert own_detail_response.status_code == 200


@pytest.mark.parametrize("role", ("committee", "admin"))
def test_committee_and_admin_see_every_active_article(article_catalog, role):
    client = authenticated_client(article_catalog[role])
    response = client.get(LIST_URL)
    items = response_items(response)

    assert response.status_code == 200
    assert len(items) == ACTIVE_ARTICLE_COUNT
    assert all(item["is_enabled"] for item in items)


def test_combined_thematic_line_and_status_filters_are_exact(article_catalog):
    thematic_line = article_catalog["thematic_lines"][0]
    status_value = ArticleStatus.EN_REVISION
    expected_ids = set(
        Article.objects.filter(
            is_enabled=True,
            thematic_line=thematic_line,
            status=status_value,
        ).values_list("id", flat=True)
    )

    response = authenticated_client(article_catalog["committee"]).get(
        LIST_URL,
        {"thematic_line": thematic_line.name, "status": status_value},
    )
    items = response_items(response)

    assert response.status_code == 200
    assert {item["id"] for item in items} == expected_ids
    assert all(
        item["thematic_line"] == thematic_line.name and item["status"] == status_value
        for item in items
    )


def test_combined_filtered_list_meets_400ms_sla_with_1000_articles(article_catalog):
    thematic_line = article_catalog["thematic_lines"][0]
    status_value = ArticleStatus.POSTULADO
    params = {"thematic_line": thematic_line.name, "status": status_value}
    client = authenticated_client(article_catalog["committee"])
    expected_ids = set(
        Article.objects.filter(
            is_enabled=True,
            thematic_line=thematic_line,
            status=status_value,
        ).values_list("id", flat=True)
    )

    warmup_response = client.get(LIST_URL, params)
    assert warmup_response.status_code == 200
    assert {item["id"] for item in response_items(warmup_response)} == expected_ids

    samples_ms = []
    for _ in range(BENCHMARK_RUNS):
        started = time.perf_counter()
        response = client.get(LIST_URL, params)
        samples_ms.append((time.perf_counter() - started) * 1000)

        assert response.status_code == 200
        assert {item["id"] for item in response_items(response)} == expected_ids

    average_ms = statistics.mean(samples_ms)
    maximum_ms = max(samples_ms)
    print(
        "HU-08 PostgreSQL combined-filter latency "
        f"(ms): samples={[round(value, 3) for value in samples_ms]}, "
        f"average={average_ms:.3f}, maximum={maximum_ms:.3f}"
    )
    assert maximum_ms <= RESPONSE_SLA_MS, (
        f"Maximum latency {maximum_ms:.3f} ms exceeds the "
        f"{RESPONSE_SLA_MS} ms SLA."
    )
