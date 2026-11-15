from decouple import config
from supabase import create_client

_client = None


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
    _bucket().upload(
        path,
        content,
        {"content-type": "application/pdf", "upsert": "false"},
    )
    return path


def delete_file(path):
    """Borra un archivo del bucket (para deshacer una subida si algo falla)."""
    _bucket().remove([path])