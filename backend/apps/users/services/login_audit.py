from datetime import timedelta

from django.utils import timezone

from apps.users.models import LoginAudit

MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW = timedelta(minutes=15)


def record_attempt(email, ip_address, is_successful):
    """Registra un intento de login con su IP y marca de tiempo."""
    return LoginAudit.objects.create(
        email=email.strip().lower(),
        ip_address=ip_address,
        is_successful=is_successful,
    )


def is_locked_out(email):
    """True si hay 5 o más fallos para el correo en los últimos 15 minutos.

    Un login exitoso dentro de la ventana reinicia el contador.
    """
    email = email.strip().lower()
    start = timezone.now() - LOCKOUT_WINDOW
    last_ok = (
        LoginAudit.objects.filter(
            email=email, is_successful=True, timestamp__gte=start
        )
        .order_by("-timestamp")
        .values_list("timestamp", flat=True)
        .first()
    )
    if last_ok:
        start = last_ok
    return (
        LoginAudit.objects.filter(
            email=email, is_successful=False, timestamp__gt=start
        ).count()
        >= MAX_FAILED_ATTEMPTS
    )