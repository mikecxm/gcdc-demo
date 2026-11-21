from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.users.models import CustomUser, LoginAudit

LOGIN_URL = "/api/v1/auth/login/"
EMAIL = "ana@univalle.edu.co"
PASSWORD = "ClaveSegura123*"

@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
@patch("apps.users.views.validate_recaptcha", return_value=True)
class LoginAuditTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        CustomUser.objects.create_user(
            email=EMAIL,
            password=PASSWORD,
            full_name="Ana Prueba",
            affiliation="Univalle",
        )

    def _login(self, email=EMAIL, password=PASSWORD):
        return self.client.post(
            LOGIN_URL,
            {"email": email, "password": password, "recaptcha_token": "ok"},
            format="json",
        )

    def test_cada_intento_se_registra_con_ip_y_fecha(self, _mock):
        self._login(password="mala")
        registro = LoginAudit.objects.get()
        self.assertEqual(registro.email, EMAIL)
        self.assertEqual(registro.ip_address, "127.0.0.1")
        self.assertFalse(registro.is_successful)
        self.assertIsNotNone(registro.timestamp)

    def test_cinco_fallos_y_el_sexto_se_rechaza(self, _mock):
        for _ in range(5):
            self.assertEqual(self._login(password="mala").status_code, 401)
        self.assertEqual(self._login(password="mala").status_code, 429)
        # el intento bloqueado no se registra
        self.assertEqual(LoginAudit.objects.count(), 5)

    def test_bloqueado_rechaza_incluso_la_clave_correcta(self, _mock):
        for _ in range(5):
            self._login(password="mala")
        self.assertEqual(self._login().status_code, 429)

    def test_login_exitoso_reinicia_el_contador(self, _mock):
        for _ in range(4):
            self.assertEqual(self._login(password="mala").status_code, 401)
        self.assertEqual(self._login().status_code, 200)
        for _ in range(4):
            self.assertEqual(self._login(password="mala").status_code, 401)

    def test_bloqueo_no_afecta_a_otros_correos(self, _mock):
        for _ in range(5):
            self._login(password="mala")
        CustomUser.objects.create_user(
            email="luis@univalle.edu.co",
            password=PASSWORD,
            full_name="Luis Prueba",
            affiliation="Univalle",
        )
        self.assertEqual(self._login(email="luis@univalle.edu.co").status_code, 200)

    def test_correo_inexistente_tambien_se_audita(self, _mock):
        respuesta = self._login(email="nadie@univalle.edu.co", password="x")
        self.assertEqual(respuesta.status_code, 401)
        self.assertTrue(LoginAudit.objects.filter(email="nadie@univalle.edu.co").exists())