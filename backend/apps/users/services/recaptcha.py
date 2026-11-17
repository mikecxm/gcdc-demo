import requests
from django.conf import settings

RECAPTCHA_VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify"


def validate_recaptcha(token, remote_ip=None):
    """Verifica el token de reCAPTCHA v2 contra Google. Falla cerrada: ante
    cualquier problema (token vacío, clave ausente, Google caído) devuelve False."""
    if not token or not isinstance(token, str):
        return False

    secret = getattr(settings, "RECAPTCHA_SECRET_KEY", "")
    if not secret:
        return False

    payload = {"secret": secret, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        response = requests.post(RECAPTCHA_VERIFY_URL, data=payload, timeout=5)
        response.raise_for_status()
        return bool(response.json().get("success", False))
    except (requests.RequestException, ValueError):
        return False