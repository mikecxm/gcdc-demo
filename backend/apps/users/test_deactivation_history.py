from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from apps.conferences.models import (
    Article, ArticleReviewer, ArticleStatus, ArticleVersion, Decision, Evaluation,
    ThematicLine,
)
from apps.users.models import RoleName

User = get_user_model()


class DeactivationHistoryTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email="history.admin@correounivalle.edu.co", full_name="Admin",
            roles=[RoleName.ADMIN],
        )
        self.committee = User.objects.create_user(
            email="history.committee@correounivalle.edu.co", full_name="Committee",
            roles=[RoleName.COMITE],
        )
        self.author = User.objects.create_user(
            email="history.author@correounivalle.edu.co", full_name="Author",
        )
        self.reviewer = User.objects.create_user(
            email="history.reviewer@correounivalle.edu.co", full_name="Reviewer",
            roles=[RoleName.COMITE],
        )
        line, _ = ThematicLine.objects.get_or_create(name="History test")
        self.article = Article.objects.create(
            title="Article under review", abstract="Test", keywords="test",
            thematic_line=line, responsible_author=self.author,
            status=ArticleStatus.EN_REVISION,
        )
        self.assignment = ArticleReviewer.objects.create(
            article=self.article, reviewer=self.reviewer,
        )
        version = ArticleVersion.objects.create(
            article=self.article, version_number=1, pdf_url="https://example.com/test.pdf",
        )
        self.evaluation = Evaluation.objects.create(
            version=version, assignment=self.assignment,
            originality_score=4, technical_quality_score=4, relevance_score=4,
            comments="Preserve this evaluation", decision=Decision.ACEPTADO,
        )

    def assert_history_preserved(self, actor):
        before = Evaluation.objects.filter(pk=self.evaluation.pk).values().get()
        self.client.force_authenticate(user=actor)
        response = self.client.delete(reverse("user-detail", kwargs={"pk": self.reviewer.pk}))
        self.assertEqual(response.status_code, 204)
        self.reviewer.refresh_from_db()
        self.assertFalse(self.reviewer.is_active)
        self.assertIsNotNone(self.reviewer.deleted_at)
        self.assertTrue(User.all_objects.filter(pk=self.reviewer.pk).exists())
        self.assignment.refresh_from_db()
        self.assertEqual(self.assignment.reviewer_id, self.reviewer.pk)
        self.article.refresh_from_db()
        self.assertEqual(self.article.status, ArticleStatus.EN_REVISION)
        self.assertEqual(Evaluation.objects.filter(pk=self.evaluation.pk).values().get(), before)

    def test_admin_deactivates_assigned_reviewer_preserving_history(self):
        self.assert_history_preserved(self.admin)

    def test_committee_deactivates_assigned_reviewer_preserving_history(self):
        self.assert_history_preserved(self.committee)
