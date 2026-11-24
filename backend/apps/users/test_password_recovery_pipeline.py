import unittest
import re
from datetime import timedelta
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import CustomUser, PasswordResetPin

LOGIN_URL = "/api/v1/auth/login/"
EMAIL = "ana@univalle.edu.co"
CLAVE_ANTERIOR = "ClaveSegura123*"
CLAVE_NUEVA = "Nueva#2026x1"
OTRA_CLAVE_NUEVA = "Otra#2026y2"


# MD5 y locmem solo se usan en pruebas: aceleran y evitan enviar correos reales.
@override_settings(
    PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"],
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
)
class RecuperacionBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        patcher = patch("apps.users.views.validate_recaptcha", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.user = CustomUser.objects.create_user(
            email=EMAIL,
            password=CLAVE_ANTERIOR,
            full_name="Usuario Prueba",
            affiliation="Univalle",
        )

    # ---------- ayudas ----------
    def _solicitar(self, email=EMAIL):
        return self.client.post(
            reverse("password-reset-request"), {"email": email}, format="json"
        )

    def _confirmar(self, pin, clave=CLAVE_NUEVA, email=EMAIL):
        return self.client.post(
            reverse("password-reset-confirm"),
            {"email": email, "pin": pin, "new_password": clave},
            format="json",
        )

    def _login(self, password, email=EMAIL):
        return self.client.post(
            LOGIN_URL,
            {"email": email, "password": password, "recaptcha_token": "ok"},
            format="json",
        )

    def _pin_del_correo(self):
        """Lee el PIN de 6 dígitos del último correo enviado."""
        self.assertTrue(mail.outbox, "No se envió ningún correo")
        encontrado = re.search(r"\b(\d{6})\b", mail.outbox[-1].body)
        self.assertIsNotNone(encontrado, "El correo no trae un PIN de 6 dígitos")
        return encontrado.group(1)

    @staticmethod
    def _pin_incorrecto(pin_real):
        return "000000" if pin_real != "000000" else "111111"

    def _pin_vigente(self):
        return PasswordResetPin.objects.filter(user=self.user).order_by("-created_at").first()

    def _clave_actual_es(self, clave):
        self.user.refresh_from_db()
        return self.user.check_password(clave)


class CicloCompletoTests(RecuperacionBase):
    def test_solicitar_verificar_y_cambiar_la_clave(self):
        respuesta = self._solicitar()
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [EMAIL])

        pin = self._pin_del_correo()
        respuesta = self._confirmar(pin)
        self.assertEqual(respuesta.status_code, 200)
        self.assertTrue(self._clave_actual_es(CLAVE_NUEVA))

    def test_el_pin_no_se_guarda_en_claro(self):
        self._solicitar()
        pin = self._pin_del_correo()
        registro = self._pin_vigente()
        self.assertNotEqual(registro.pin_hash, pin)
        self.assertNotIn(pin, registro.pin_hash)

    def test_correo_con_mayusculas_y_espacios_funciona(self):
        self._solicitar("  ANA@Univalle.edu.co ")
        pin = self._pin_del_correo()
        respuesta = self._confirmar(pin, email="  ANA@Univalle.edu.co ")
        self.assertEqual(respuesta.status_code, 200)

    def test_nuevo_pin_invalida_el_anterior(self):
        self._solicitar()
        pin_viejo = self._pin_del_correo()
        self._solicitar()
        pin_nuevo = self._pin_del_correo()
        if pin_viejo == pin_nuevo:
            self.skipTest("Los dos PIN salieron iguales (1 en un millón); repetir")

        self.assertEqual(self._confirmar(pin_viejo).status_code, 400)
        self.assertFalse(self._clave_actual_es(CLAVE_NUEVA))
        self.assertEqual(self._confirmar(pin_nuevo).status_code, 200)


class InicioDeSesionTrasCambioTests(RecuperacionBase):
    def test_la_clave_nueva_inicia_sesion_y_la_anterior_da_401(self):
        self._solicitar()
        self._confirmar(self._pin_del_correo())

        con_nueva = self._login(CLAVE_NUEVA)
        self.assertEqual(con_nueva.status_code, 200)
        self.assertIn("access", con_nueva.json())
        self.assertIn("refresh", con_nueva.json())

        con_anterior = self._login(CLAVE_ANTERIOR)
        self.assertEqual(con_anterior.status_code, 401)

    def test_antes_de_confirmar_la_clave_anterior_sigue_funcionando(self):
        self._solicitar()
        self.assertEqual(self._login(CLAVE_ANTERIOR).status_code, 200)


class BloqueoPorIntentosTests(RecuperacionBase):
    def test_tres_pin_incorrectos_revocan_el_pin(self):
        self._solicitar()
        pin = self._pin_del_correo()
        malo = self._pin_incorrecto(pin)

        for intento in range(3):
            with self.subTest(intento=intento + 1):
                self.assertEqual(self._confirmar(malo).status_code, 400)

        registro = self._pin_vigente()
        self.assertEqual(registro.attempts, 3)
        self.assertTrue(registro.is_used)

    def test_con_pin_correcto_despues_de_3_fallos_sigue_bloqueado(self):
        self._solicitar()
        pin = self._pin_del_correo()
        malo = self._pin_incorrecto(pin)
        for _ in range(3):
            self._confirmar(malo)

        respuesta = self._confirmar(pin)
        self.assertEqual(respuesta.status_code, 400)
        self.assertTrue(self._clave_actual_es(CLAVE_ANTERIOR))
        self.assertEqual(self._login(CLAVE_ANTERIOR).status_code, 200)

    def test_dos_fallos_y_luego_el_pin_correcto_si_funciona(self):
        self._solicitar()
        pin = self._pin_del_correo()
        malo = self._pin_incorrecto(pin)
        self._confirmar(malo)
        self._confirmar(malo)

        self.assertEqual(self._confirmar(pin).status_code, 200)
        self.assertTrue(self._clave_actual_es(CLAVE_NUEVA))

    def test_tras_el_bloqueo_se_puede_pedir_un_pin_nuevo(self):
        self._solicitar()
        malo = self._pin_incorrecto(self._pin_del_correo())
        for _ in range(3):
            self._confirmar(malo)

        self._solicitar()
        self.assertEqual(self._confirmar(self._pin_del_correo()).status_code, 200)


class ExpiracionTests(RecuperacionBase):
    def test_pin_vencido_se_rechaza_y_se_revoca(self):
        self._solicitar()
        pin = self._pin_del_correo()
        PasswordResetPin.objects.filter(user=self.user).update(
            expires_at=timezone.now() - timedelta(minutes=1)
        )

        self.assertEqual(self._confirmar(pin).status_code, 400)
        self.assertTrue(self._pin_vigente().is_used)
        self.assertTrue(self._clave_actual_es(CLAVE_ANTERIOR))

    def test_el_pin_vence_a_los_10_minutos(self):
        antes = timezone.now()
        self._solicitar()
        despues = timezone.now()
        vence = self._pin_vigente().expires_at
        self.assertGreaterEqual(vence, antes + timedelta(minutes=10))
        self.assertLessEqual(vence, despues + timedelta(minutes=10))

    def test_pin_a_punto_de_vencer_todavia_sirve(self):
        self._solicitar()
        pin = self._pin_del_correo()
        PasswordResetPin.objects.filter(user=self.user).update(
            expires_at=timezone.now() + timedelta(minutes=1)
        )
        self.assertEqual(self._confirmar(pin).status_code, 200)


class NoReutilizacionTests(RecuperacionBase):
    def test_el_pin_no_se_puede_usar_dos_veces(self):
        self._solicitar()
        pin = self._pin_del_correo()
        self.assertEqual(self._confirmar(pin).status_code, 200)

        segunda = self._confirmar(pin, clave=OTRA_CLAVE_NUEVA)
        self.assertEqual(segunda.status_code, 400)
        self.assertTrue(self._clave_actual_es(CLAVE_NUEVA))
        self.assertFalse(self._clave_actual_es(OTRA_CLAVE_NUEVA))

    def test_confirmar_sin_haber_solicitado_pin_da_400(self):
        self.assertEqual(self._confirmar("123456").status_code, 400)


class ValidacionesDeEntradaTests(RecuperacionBase):
    def test_pin_con_formato_invalido_da_400_y_no_suma_intentos(self):
        self._solicitar()
        for pin in ["abc", "12345", "1234567", ""]:
            with self.subTest(pin=pin):
                self.assertEqual(self._confirmar(pin).status_code, 400)
        self.assertEqual(self._pin_vigente().attempts, 0)

    def test_clave_nueva_debil_da_400_y_no_consume_el_pin(self):
        self._solicitar()
        pin = self._pin_del_correo()
        for clave in ["corta1*", "sinnumero*abc", "SinSimbolo123"]:
            with self.subTest(clave=clave):
                self.assertEqual(self._confirmar(pin, clave=clave).status_code, 400)
        self.assertEqual(self._pin_vigente().attempts, 0)
        self.assertEqual(self._confirmar(pin).status_code, 200)

    def test_correo_invalido_da_400(self):
        self.assertEqual(self._solicitar("esto-no-es-un-correo").status_code, 400)
        self.assertEqual(self._confirmar("123456", email="nada").status_code, 400)


class NoRevelaExistenciaTests(RecuperacionBase):
    def test_solicitar_responde_igual_exista_o_no_el_correo(self):
        existente = self._solicitar(EMAIL)
        inexistente = self._solicitar("nadie@univalle.edu.co")
        self.assertEqual(existente.status_code, 200)
        self.assertEqual(inexistente.status_code, 200)
        self.assertEqual(existente.json(), inexistente.json())

    def test_correo_inexistente_no_envia_correo_ni_crea_pin(self):
        self._solicitar("nadie@univalle.edu.co")
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(PasswordResetPin.objects.count(), 0)

    def test_confirmar_con_correo_inexistente_da_el_mismo_400(self):
        self._solicitar()
        pin = self._pin_del_correo()
        real = self._confirmar(self._pin_incorrecto(pin))
        falso = self._confirmar(pin, email="nadie@univalle.edu.co")
        self.assertEqual(real.status_code, 400)
        self.assertEqual(falso.status_code, 400)
        self.assertEqual(real.json(), falso.json())


class CuentasNoElegiblesTests(RecuperacionBase):
    def test_cuenta_inactiva_responde_200_sin_enviar_nada(self):
        CustomUser.all_objects.filter(pk=self.user.pk).update(is_active=False)
        self.assertEqual(self._solicitar().status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(PasswordResetPin.objects.count(), 0)

    def test_cuenta_eliminada_responde_200_sin_enviar_nada(self):
        CustomUser.all_objects.filter(pk=self.user.pk).update(deleted_at=timezone.now())
        self.assertEqual(self._solicitar().status_code, 200)
        self.assertEqual(len(mail.outbox), 0)
        self.assertEqual(PasswordResetPin.objects.count(), 0)


class FalloDeCorreoTests(RecuperacionBase):
    def test_si_falla_el_envio_responde_503_y_revoca_el_pin(self):
        with patch(
            "apps.users.services.password_recovery.send_mail",
            side_effect=Exception("SMTP caído"),
        ):
            respuesta = self._solicitar()
        self.assertEqual(respuesta.status_code, 503)
        self.assertTrue(self._pin_vigente().is_used)

class FiltracionPorFalloDeCorreoTests(RecuperacionBase):
    """Hallazgo QA: si el correo falla, la respuesta no debe delatar si la cuenta existe."""

    @unittest.expectedFailure  # Quitar cuando el equipo corrija PasswordResetRequestView
    def test_fallo_de_correo_responde_igual_exista_o_no_la_cuenta(self):
        with patch(
            "apps.users.services.password_recovery.send_mail",
            side_effect=Exception("SMTP caído"),
        ):
            existente = self._solicitar(EMAIL)
            inexistente = self._solicitar("nadie@univalle.edu.co")

        self.assertEqual(
            existente.status_code,
            inexistente.status_code,
            "El estado HTTP distingue cuentas existentes de inexistentes",
        )