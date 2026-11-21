from decouple import config
from io import BytesIO

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import FileSystemStorage
from django.core.exceptions import ImproperlyConfigured
from supabase import create_client
from storage3.exceptions import StorageApiError

_client = None


def _local_storage():
    backend = settings.ARTICLE_PDF_STORAGE_BACKEND
    if backend not in ('local', 'supabase'):
        raise ImproperlyConfigured('ARTICLE_PDF_STORAGE_BACKEND debe ser local o supabase.')
    if backend == 'local':
        return FileSystemStorage(location=settings.ARTICLE_PDF_ROOT)
    return None


def _get_client():
    """Cliente de Supabase con la clave de servicio (solo en el servidor)."""
    global _client
    if _client is None:
        _client = create_client(
            config("SUPABASE_URL"),
            config("SUPABASE_SERVICE_KEY"),
        )
    return _client


def _bucket():
    bucket_name = config("SUPABASE_BUCKET", default="article-pdfs")
    return _get_client().storage.from_(bucket_name)


def upload_pdf(path, content):
    """Sube un PDF al bucket privado y devuelve su ruta."""
    local = _local_storage()
    if local is not None:
        saved_path = local.save(path, ContentFile(content))
        if saved_path != path:
            local.delete(saved_path)
            raise FileExistsError(path)
        return path
    _bucket().upload(
        path,
        content,
        {"content-type": "application/pdf", "upsert": "false"},
    )
    return path


def delete_file(path):
    """Borra un archivo del bucket (para deshacer una subida si algo falla)."""
    local = _local_storage()
    if local is not None:
        local.delete(path)
        return
    _bucket().remove([path])


def open_pdf(path):
    """Abre el PDF privado para que la API lo entregue tras comprobar permisos."""
    local = _local_storage()
    if local is not None:
        return local.open(path, 'rb')
    try:
        return BytesIO(_bucket().download(path))
    except StorageApiError as error:
        if str(error.status) == '404' or error.code in ('NoSuchKey', 'not_found'):
            raise FileNotFoundError(path) from error
        raise
