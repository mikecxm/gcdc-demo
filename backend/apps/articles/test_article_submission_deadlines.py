"""HTTP/PostgreSQL and real local PDFs, with a controlled clock and failure injection."""
from datetime import date, datetime, timedelta, timezone as dt_timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
from tempfile import TemporaryDirectory
from time import perf_counter
from unittest.mock import patch
from unittest import skipUnless
from zoneinfo import ZoneInfo

import requests
from django.conf import settings
from django.test import LiveServerTestCase, override_settings
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework.parsers import MultiPartParser

from apps.conferences.models import Article, ArticleVersion, CoAuthor, Conference, ThematicLine
from apps.users.models import CustomUser, RoleName
from . import storage
from .submission_serializers import MAX_PDF_SIZE
from storage3.exceptions import StorageApiError

BOGOTA = ZoneInfo('America/Bogota')
DEADLINE = date(2030, 6, 30)
PDF_99_MIB = 10_380_902


def pdf_bytes(size):
    """Generate an exact-size, one-page PDF with valid object offsets and xref."""
    def build(padding):
        stream = b'BT /F1 12 Tf 72 720 Td (HU07 QA) Tj ET\n' + b' ' * padding
        objects = [
            b'<< /Type /Catalog /Pages 2 0 R >>',
            b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
            b'/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
            b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
            b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        ]
        result, offsets = b'%PDF-1.4\n', [0]
        for number, body in enumerate(objects, 1):
            offsets.append(len(result))
            result += f'{number} 0 obj\n'.encode() + body + b'\nendobj\n'
        xref = len(result)
        result += b'xref\n0 6\n0000000000 65535 f \n'
        result += b''.join(f'{offset:010d} 00000 n \n'.encode() for offset in offsets[1:])
        return result + f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()

    padding = max(0, size - len(build(0)))
    for _ in range(5):
        result = build(padding)
        if len(result) == size:
            return result
        padding += size - len(result)
        if padding < 0:
            break
    raise ValueError('El PDF solicitado es demasiado pequeno.')


class ArticleSubmissionDeadlineTests(LiveServerTestCase):
    host = '127.0.0.1'

    @classmethod
    def setUpClass(cls):
        if settings.DATABASES['default']['ENGINE'] != 'django.db.backends.postgresql':
            raise RuntimeError('Esta QA requiere PostgreSQL configurado en backend/.env.')
        super().setUpClass()

    def setUp(self):
        self.directory = TemporaryDirectory(prefix='hu07-pdfs-')
        self.addCleanup(self.directory.cleanup)
        overrides = override_settings(
            ARTICLE_PDF_STORAGE_BACKEND='local', ARTICLE_PDF_ROOT=self.directory.name,
        )
        overrides.enable()
        self.addCleanup(overrides.disable)
        self.author = CustomUser.objects.create_user(email='hu07-author@example.com', full_name='QA Author')
        self.headers = self.auth(self.author)
        self.line, _ = ThematicLine.objects.get_or_create(name='HU07 QA')
        Conference.objects.create(
            edition_name='HU07 QA', submission_deadline=DEADLINE,
            evaluation_deadline=DEADLINE + timedelta(days=10),
            presentation_version_deadline=DEADLINE + timedelta(days=20),
            publication_version_deadline=DEADLINE + timedelta(days=30),
            event_start_date=DEADLINE + timedelta(days=40), event_end_date=DEADLINE + timedelta(days=44),
        )
        self.url = self.live_server_url + '/api/v1/articles/'

    def auth(self, user):
        return {'Authorization': f'Bearer {AccessToken.for_user(user)}'}

    def submit(self, content=None, when=None, mime='application/pdf'):
        # Input is UTC on purpose: the API must convert it to Bogota before comparing dates.
        instant = (when or datetime(2030, 6, 30, 12, tzinfo=BOGOTA)).astimezone(dt_timezone.utc)
        with patch('apps.articles.submission_views.timezone.now', return_value=instant):
            return requests.post(self.url, headers=self.headers, data={
                'title': 'HU07 functional QA', 'abstract': 'Submission and PDF integrity.',
                'keywords': 'qa, pdf', 'thematic_line': self.line.pk,
                'coauthors': json.dumps([{'full_name': 'QA Coauthor', 'email': 'hu07-coauthor@example.com',
                                         'affiliation': 'QA University'}]),
            }, files={'pdf': ('qa.pdf', content if content is not None else pdf_bytes(1024), mime)}, timeout=30)

    def download(self, article_id, headers=None):
        return requests.get(f'{self.url}{article_id}/pdf/',
                            headers=self.headers if headers is None else headers, timeout=30)

    def saved_files(self):
        return list(Path(self.directory.name).rglob('*.pdf'))

    def test_all_uploaded_pdfs_recover_exact_bytes_and_checksums(self):
        samples = []
        # Cover decimal MB and the binary MiB convention used by the existing 10 MiB validator.
        for size in [1024, 9_900_000, PDF_99_MIB, MAX_PDF_SIZE]:
            with self.subTest(bytes=size):
                original = pdf_bytes(size)
                started = perf_counter()
                uploaded = self.submit(original)
                upload_ms = (perf_counter() - started) * 1000
                self.assertEqual(uploaded.status_code, 201, uploaded.text)
                article_id = uploaded.json()['id']
                downloaded = self.download(article_id)
                self.assertEqual(downloaded.status_code, 200)
                actual = downloaded.content
                md5, sha256 = hashlib.md5(original).hexdigest(), hashlib.sha256(original).hexdigest()
                actual_md5, actual_sha256 = hashlib.md5(actual).hexdigest(), hashlib.sha256(actual).hexdigest()
                self.assertEqual(actual, original)
                self.assertEqual(len(actual), size)
                self.assertEqual(downloaded.headers['Content-Type'], 'application/pdf')
                self.assertIn('attachment;', downloaded.headers['Content-Disposition'])
                self.assertEqual((actual_md5, actual_sha256), (md5, sha256))
                self.assertTrue(CoAuthor.objects.filter(article_id=article_id).exists())
                samples.append({'bytes': size, 'upload_ms': upload_ms, 'upload_status': 201,
                                'download_status': 200, 'source_md5': md5, 'download_md5': actual_md5,
                                'source_sha256': sha256, 'download_sha256': actual_sha256})
        report = {'uploaded': len(samples), 'recovered': len(samples), 'recovery_percent': 100, 'samples': samples}
        (settings.BASE_DIR.parent / 'docs' / 'hu07-pdf-integrity.json').write_text(
            json.dumps(report, indent=2), encoding='utf-8',
        )
        self.assertEqual(Article.objects.count(), 4)
        self.assertEqual(ArticleVersion.objects.count(), 4)
        self.assertEqual(len(self.saved_files()), 4)
        print('\nPDF integrity: 4/4 recovered; MD5 and SHA256 match. '
              f'9.9 MiB POST: {samples[2]["upload_ms"]:.2f} ms')

    def test_midnight_boundary_and_utc_conversion(self):
        cases = [
            (datetime(2030, 6, 30, 23, 59, 59, tzinfo=BOGOTA), 201),
            (datetime(2030, 6, 30, 23, 59, 59, 999999, tzinfo=BOGOTA), 201),
            (datetime(2030, 7, 1, 0, 0, 0, tzinfo=BOGOTA), 400),
            (datetime(2030, 7, 1, 0, 0, 1, tzinfo=BOGOTA), 400),
        ]
        report = []
        for instant, expected in cases:
            with self.subTest(bogota=instant.isoformat()):
                before = (Article.objects.count(), ArticleVersion.objects.count(), CoAuthor.objects.count(), len(self.saved_files()))
                response = self.submit(when=instant)
                self.assertEqual(response.status_code, expected, response.text)
                if expected == 400:
                    self.assertIn('venci', response.json()['detail'])
                    self.assertEqual(before, (Article.objects.count(), ArticleVersion.objects.count(),
                                             CoAuthor.objects.count(), len(self.saved_files())))
                report.append({'bogota': instant.isoformat(), 'utc': instant.astimezone(dt_timezone.utc).isoformat(),
                               'expected_status': expected, 'actual_status': response.status_code})
        (settings.BASE_DIR.parent / 'docs' / 'hu07-deadline-results.json').write_text(
            json.dumps(report, indent=2), encoding='utf-8',
        )

    def test_oversized_and_invalid_pdfs_leave_no_data(self):
        for content, mime in [(pdf_bytes(MAX_PDF_SIZE + 1), 'application/pdf'),
                              (pdf_bytes(1024), 'text/plain'), (b'not a PDF', 'application/pdf'),
                              (b'', 'application/pdf')]:
            with self.subTest(size=len(content), mime=mime):
                self.assertEqual(self.submit(content, mime=mime).status_code, 400)
                self.assertFalse(Article.objects.exists())
                self.assertFalse(ArticleVersion.objects.exists())
                self.assertFalse(CoAuthor.objects.exists())
                self.assertEqual(self.saved_files(), [])

    def test_upload_received_across_midnight_is_rejected(self):
        before = datetime(2030, 6, 30, 23, 59, 59, tzinfo=BOGOTA)
        after = datetime(2030, 7, 1, 0, 0, 1, tzinfo=BOGOTA).astimezone(dt_timezone.utc)
        parse = MultiPartParser.parse

        def receive_after_close(parser, *args, **kwargs):
            parsed = parse(parser, *args, **kwargs)
            # The body really goes through Django's multipart parser; advance only its clock.
            from django.utils import timezone
            timezone.now.return_value = after
            return parsed

        with patch.object(MultiPartParser, 'parse', new=receive_after_close):
            self.assertEqual(self.submit(when=before).status_code, 400)
        self.assertFalse(Article.objects.exists())
        self.assertEqual(self.saved_files(), [])

    def test_download_authorization_and_missing_files(self):
        uploaded = self.submit()
        self.assertEqual(uploaded.status_code, 201)
        article_id = uploaded.json()['id']
        self.assertEqual(self.download(article_id, headers={}).status_code, 401)
        for role, expected in [(RoleName.AUTOR, 403), (RoleName.ADMIN, 200), (RoleName.COMITE, 200)]:
            with self.subTest(role=role):
                user = CustomUser.objects.create_user(email=f'hu07-{role}@example.com', full_name='QA', roles=[role])
                self.assertEqual(self.download(article_id, headers=self.auth(user)).status_code, expected)
        Article.objects.filter(pk=article_id).update(is_enabled=False)
        self.assertEqual(self.download(article_id).status_code, 404)
        Article.objects.filter(pk=article_id).update(is_enabled=True)
        self.saved_files()[0].unlink()
        self.assertEqual(self.download(article_id).status_code, 404)
        ArticleVersion.objects.filter(article_id=article_id).delete()
        self.assertEqual(self.download(article_id).status_code, 404)

    def test_version_failure_rolls_back_database_and_deletes_uploaded_pdf(self):
        with patch('apps.articles.submission_views.ArticleVersion.objects.create', side_effect=RuntimeError('QA DB failure')):
            self.assertEqual(self.submit().status_code, 500)
        self.assertFalse(Article.objects.exists())
        self.assertFalse(CoAuthor.objects.exists())
        self.assertFalse(ArticleVersion.objects.exists())
        self.assertEqual(self.saved_files(), [])

    def test_local_storage_does_not_overwrite_existing_pdf(self):
        storage.upload_pdf('articles/qa/v1.pdf', b'original')
        with self.assertRaises(FileExistsError):
            storage.upload_pdf('articles/qa/v1.pdf', b'changed')
        with storage.open_pdf('articles/qa/v1.pdf') as stored:
            self.assertEqual(stored.read(), b'original')
        self.assertEqual(len(self.saved_files()), 1)

    def test_supabase_storage_contract_and_missing_object(self):
        # SDK contract only; real byte-for-byte transfers are verified on local files above.
        with override_settings(ARTICLE_PDF_STORAGE_BACKEND='supabase'), patch('apps.articles.storage._bucket') as bucket:
            bucket.return_value.download.return_value = b'%PDF-cloud'
            self.assertEqual(storage.upload_pdf('articles/qa/v1.pdf', b'%PDF-cloud'), 'articles/qa/v1.pdf')
            bucket.return_value.upload.assert_called_once_with(
                'articles/qa/v1.pdf', b'%PDF-cloud', {'content-type': 'application/pdf', 'upsert': 'false'},
            )
            with storage.open_pdf('articles/qa/v1.pdf') as stored:
                self.assertEqual(stored.read(), b'%PDF-cloud')
            storage.delete_file('articles/qa/v1.pdf')
            bucket.return_value.remove.assert_called_once_with(['articles/qa/v1.pdf'])
            bucket.return_value.download.side_effect = StorageApiError('Missing', 'not_found', 404)
            with self.assertRaises(FileNotFoundError):
                storage.open_pdf('articles/qa/missing.pdf')

    @skipUnless(os.environ.get('QA_POSTMAN') == '1', 'Activar QA_POSTMAN=1 para ejecutar Newman')
    def test_postman_collection_before_and_after_deadline(self):
        root = settings.BASE_DIR
        newman = root / 'qa/node_modules/newman/bin/newman.js'
        self.assertTrue(newman.is_file(), 'Instala Newman segun docs/HU07_VALIDACION_POSTULACION.md')
        directory = Path(self.directory.name)
        content = pdf_bytes(PDF_99_MIB)
        (directory / 'hu07-9.9MiB.pdf').write_bytes(content)
        collection = root / 'qa/hu07-submission.postman_collection.json'
        summaries = []
        for instant, expected in [(datetime(2030, 6, 30, 23, 59, 59, tzinfo=BOGOTA), 201),
                                  (datetime(2030, 7, 1, 0, 0, 1, tzinfo=BOGOTA), 400)]:
            environment = {'name': 'Temporary HU07 QA', 'values': [
                {'key': key, 'value': value, 'enabled': True} for key, value in {
                    'baseUrl': self.live_server_url + '/api/v1',
                    'token': self.headers['Authorization'].removeprefix('Bearer '),
                    'thematicLineId': str(self.line.pk), 'expectedStatus': str(expected),
                    'expectedBytes': str(len(content)),
                }.items()
            ]}
            environment_path = directory / 'environment.json'
            environment_path.write_text(json.dumps(environment), encoding='utf-8')
            output = directory / 'newman.json'
            before = (Article.objects.count(), ArticleVersion.objects.count())
            with patch('apps.articles.submission_views.timezone.now', return_value=instant.astimezone(dt_timezone.utc)):
                result = subprocess.run([
                    'node', str(newman), 'run', str(collection), '--environment', str(environment_path),
                    '--working-dir', str(directory), '--reporters', 'json',
                    '--reporter-json-export', str(output), '--timeout-request', '10000',
                ], capture_output=True, text=True, timeout=60)
            if result.returncode and output.exists():
                failed_run = json.loads(output.read_text(encoding='utf-8'))['run']
                print('Newman failures:', [failure.get('error', {}).get('message') for failure in failed_run['failures']])
                for execution in failed_run['executions']:
                    response = execution.get('response') or {}
                    data = response.get('stream', {}).get('data', [])
                    print('Newman response:', response.get('code'), bytes(data[:200]).decode(errors='replace'))
            self.assertEqual(result.returncode, 0, result.stderr[-1000:])
            report = json.loads(output.read_text(encoding='utf-8'))['run']
            self.assertEqual(report['failures'], [])
            self.assertEqual(report['executions'][0]['response']['code'], expected)
            if expected == 201:
                received = bytes(report['executions'][1]['response']['stream']['data'])
                self.assertEqual(hashlib.sha256(received).digest(), hashlib.sha256(content).digest())
            else:
                self.assertEqual(len(report['executions']), 1)
                self.assertEqual(before, (Article.objects.count(), ArticleVersion.objects.count()))
            summaries.append({'bogota': instant.isoformat(), 'expected_status': expected,
                              'actual_status': report['executions'][0]['response']['code'],
                              'requests': report['stats']['requests']['total'],
                              'assertions': report['stats']['assertions']['total'],
                              'failures': len(report['failures'])})
        # Keep tokens and full Newman exports exclusively in the temporary directory.
        (root.parent / 'docs/hu07-postman-results.json').write_text(
            json.dumps(summaries, indent=2), encoding='utf-8',
        )
