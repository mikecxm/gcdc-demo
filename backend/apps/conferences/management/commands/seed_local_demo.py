"""Datos repetibles para probar postulaciones contra PostgreSQL local."""
import secrets
from datetime import timedelta
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.articles import storage
from apps.conferences.models import (
    Article, ArticleStatus, ArticleVersion, CoAuthor, Conference, ThematicLine,
)
from apps.users.models import CustomUser, RoleName


def demo_pdf():
    """PDF de una página con tabla de referencias válida, visible en el visor."""
    stream = b'BT /F1 18 Tf 50 750 Td (Symposia - articulo de prueba local) Tj ET'
    objects = [
        b'<< /Type /Catalog /Pages 2 0 R >>',
        b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
        b'/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
        b'<< /Length ' + str(len(stream)).encode() + b' >>\nstream\n' + stream + b'\nendstream',
    ]
    result = b'%PDF-1.4\n'
    offsets = [0]
    for number, obj in enumerate(objects, 1):
        offsets.append(len(result))
        result += f'{number} 0 obj\n'.encode() + obj + b'\nendobj\n'
    xref = len(result)
    result += b'xref\n0 6\n0000000000 65535 f \n'
    result += b''.join(f'{offset:010} 00000 n \n'.encode() for offset in offsets[1:])
    return result + f'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n'.encode()


class Command(BaseCommand):
    help = 'Crea conferencia vigente, cuentas y artículos de demostración sin borrar datos.'

    def handle(self, *args, **options):
        db = settings.DATABASES['default']
        if db.get('HOST', '') not in ('', 'localhost', '127.0.0.1', '::1'):
            raise CommandError('Este comando solo permite bases de datos locales.')
        if settings.ARTICLE_PDF_STORAGE_BACKEND != 'local':
            raise CommandError('Configura ARTICLE_PDF_STORAGE_BACKEND=local antes de continuar.')

        today = timezone.now().astimezone(ZoneInfo('America/Bogota')).date()
        password = secrets.token_urlsafe(16)
        with transaction.atomic():
            for role, label in ((RoleName.AUTOR, 'Autor'), (RoleName.COMITE, 'Comité'), (RoleName.ADMIN, 'Administrador')):
                email = f'{role.lower()}.demo@example.com'
                if not CustomUser.objects.filter(email=email).exists():
                    CustomUser.objects.create_user(
                        email=email, password=password, roles=[role],
                        full_name=f'{label} Demo Local', affiliation='Universidad del Valle',
                    )
                    self.stdout.write(f'Cuenta creada: {email} | Contraseña: {password}')

            conference, _ = Conference.objects.update_or_create(
                edition_name='Symposia — pruebas locales',
                defaults={
                    'submission_deadline': today + timedelta(days=30),
                    'evaluation_deadline': today + timedelta(days=45),
                    'presentation_version_deadline': today + timedelta(days=60),
                    'publication_version_deadline': today + timedelta(days=90),
                    'event_start_date': today + timedelta(days=75),
                    'event_end_date': today + timedelta(days=77),
                    'talk_duration_minutes': 45,
                },
            )
            latest = Conference.objects.first()
            if latest.pk != conference.pk:
                raise CommandError('Hay otra conferencia más reciente; revisa sus fechas antes de sembrar datos.')

            lines = [ThematicLine.objects.get_or_create(name=name)[0] for name in (
                'Sistemas Inteligentes', 'Tecnologías en Informática', 'Educación en Informática',
                'Sistemas de Software', 'Software en la práctica',
            )]
            authors = CustomUser.objects.filter(is_active=True, roles__name=RoleName.AUTOR).distinct()
            states = [ArticleStatus.POSTULADO, ArticleStatus.EN_REVISION, ArticleStatus.ACEPTADO,
                      ArticleStatus.AVAL_PRESENTACION, ArticleStatus.AVAL_PUBLICACION]
            for author in authors:
                for line, state in zip(lines, states):
                    article, created = Article.objects.get_or_create(
                        responsible_author=author, title=f'[DEMO LOCAL] Investigación en {line.name}',
                        defaults={
                            'abstract': f'Artículo de demostración para verificar el catálogo, los metadatos y el PDF de {line.name}.',
                            'keywords': 'demostración, conferencia, pruebas', 'thematic_line': line, 'status': state,
                        },
                    )
                    if created:
                        path = f'articles/{article.pk}/v1.pdf'
                        storage.upload_pdf(path, demo_pdf())
                        ArticleVersion.objects.create(article=article, version_number=1, pdf_url=path)
                        CoAuthor.objects.create(
                            article=article, full_name='Coautor de demostración',
                            email='coautor.demo@example.com', affiliation='Universidad del Valle',
                        )
            self.stdout.write(self.style.SUCCESS(
                f'Conferencia: {conference.edition_name}; postulaciones hasta {conference.submission_deadline}. '
                f'Totales: {Conference.objects.count()} conferencias, {Article.objects.count()} artículos, '
                f'{ArticleVersion.objects.count()} versiones PDF.'
            ))
