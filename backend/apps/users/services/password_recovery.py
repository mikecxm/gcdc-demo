import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.db import transaction
from django.utils import timezone

from apps.users.models import CustomUser, PasswordResetPin

logger = logging.getLogger(__name__)

PIN_EXPIRATION_MINUTES = 10
MAX_PIN_ATTEMPTS = 3


class InvalidResetPin(Exception):
    pass


class PasswordResetEmailError(Exception):
    pass


def request_password_reset_pin(email):
    email = email.strip().lower()

    with transaction.atomic():
        user = (
            CustomUser.all_objects.select_for_update()
            .filter(
                email=email,
                is_active=True,
                deleted_at__isnull=True,
            )
            .first()
        )

        if not user:
            return

        # Invalidar cualquier PIN anterior.
        PasswordResetPin.objects.filter(
            user=user,
            is_used=False,
        ).update(is_used=True)

        pin = f"{secrets.randbelow(1_000_000):06d}"

        reset_pin = PasswordResetPin.objects.create(
            user=user,
            pin_hash=make_password(pin),
            expires_at=timezone.now()
            + timedelta(minutes=PIN_EXPIRATION_MINUTES),
        )

    try:
        send_mail(
            subject="Código de recuperación de contraseña - GCDC",
            message=(
                f"Tu código de recuperación es: {pin}\n\n"
                "Este código es válido durante 10 minutos.\n"
                "Si no solicitaste este cambio, ignora este mensaje."
            ),
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as exc:
        reset_pin.is_used = True
        reset_pin.save(update_fields=["is_used"])
        logger.exception("Error enviando PIN de recuperación")
        raise PasswordResetEmailError from exc


def validate_new_password(password):
    if (
        len(password) < 8
        or not any(char.isdigit() for char in password)
        or not any(not char.isalnum() for char in password)
    ):
        raise ValueError(
            "La contraseña debe tener mínimo 8 caracteres, "
            "un número y un símbolo."
        )


def reset_user_password(email, pin, new_password):
    email = email.strip().lower()
    error = False

    with transaction.atomic():
        user = (
            CustomUser.all_objects.select_for_update()
            .filter(
                email=email,
                is_active=True,
                deleted_at__isnull=True,
            )
            .first()
        )

        if not user:
            error = True
        else:
            reset_pin = (
                PasswordResetPin.objects.select_for_update()
                .filter(user=user, is_used=False)
                .order_by("-created_at")
                .first()
            )

            if not reset_pin:
                error = True

            elif (
                reset_pin.expires_at <= timezone.now()
                or reset_pin.attempts >= MAX_PIN_ATTEMPTS
            ):
                reset_pin.is_used = True
                reset_pin.save(update_fields=["is_used"])
                error = True

            elif not check_password(pin, reset_pin.pin_hash):
                reset_pin.attempts += 1

                if reset_pin.attempts >= MAX_PIN_ATTEMPTS:
                    reset_pin.is_used = True

                reset_pin.save(update_fields=["attempts", "is_used"])
                error = True

            else:
                user.set_password(new_password)
                user.save(update_fields=["password", "updated_at"])

                # Invalidar todos los PIN pendientes.
                PasswordResetPin.objects.filter(
                    user=user,
                    is_used=False,
                ).update(is_used=True)

    # Se lanza fuera de atomic para conservar los intentos registrados.
    if error:
        raise InvalidResetPin