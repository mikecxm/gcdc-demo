from io import StringIO
from tempfile import TemporaryDirectory

from django.core.management import call_command
from django.test import TestCase, override_settings

from apps.conferences.models import Article, ArticleVersion, Conference, ThematicLine
from apps.users.models import CustomUser


class LocalDemoSetupTests(TestCase):
    def test_conference_only_leaves_accounts_and_articles_untouched(self):
        with TemporaryDirectory() as directory, override_settings(
            ARTICLE_PDF_STORAGE_BACKEND='local', ARTICLE_PDF_ROOT=directory,
        ):
            users_before = CustomUser.objects.count()
            call_command('seed_local_demo', conference_only=True, stdout=StringIO())
            self.assertEqual(CustomUser.objects.count(), users_before)
            self.assertEqual(Article.objects.count(), 0)
            self.assertEqual(ArticleVersion.objects.count(), 0)
            self.assertEqual(Conference.objects.count(), 1)
            self.assertEqual(ThematicLine.objects.count(), 5)
            call_command('seed_local_demo', conference_only=True, stdout=StringIO())
            self.assertEqual(Conference.objects.count(), 1)
            self.assertEqual(Article.objects.count(), 0)
