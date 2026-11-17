import base64
import json
from datetime import timedelta
from unittest.mock import patch

import jwt
from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.settings import api_settings
from rest_framework_simplejwt.tokens import AccessToken

from apps.users.models import CustomUser, LoginAudit

LOGIN_URL = "/api/v1/auth/login/"
PROTECTED_URL = "/api/v1/users/create/"  # exige autenticación y rol ADMIN o COMITE
EMAIL = "ana@univalle.edu.co"
PASSWORD = "ClaveSegura123*"
CLAVE_MALA = "Incorrecta-9876*"
OTRA_CLAVE = "otra-clave-distinta-de-mas-de-32-caracteres"


def _b64url(data):
    raw = json.dumps(data, separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


# El hasher MD5 solo se usa en pruebas: acelera las pruebas, no afecta producción.
@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class AuthSecurityBase(TestCase):
    def setUp(self):
        self.client = APIClient()
        patcher = patch("apps.users.views.validate_recaptcha", return_value=True)
        self.mock_captcha = patcher.start()
        self.addCleanup(patcher.stop)

        # create_user ya asigna el rol AUTOR por defecto: no se crea a mano
        self.user = self._crear_usuario(EMAIL)

    @staticmethod
    def _crear_usuario(email):
        return CustomUser.objects.create_user(
            email=email,
            password=PASSWORD,
            full_name="Usuario Prueba",
            affiliation="Univalle",
        )

    def _login(self, email=EMAIL, password=PASSWORD):
        return self.client.post(
            LOGIN_URL,
            {"email": email, "password": password, "recaptcha_token": "ok"},
            format="json",
        )

    def _access_token(self):
        return self._login().json()["access"]

    def _ruta_protegida(self, token=None):
        extra = {"HTTP_AUTHORIZATION": f"Bearer {token}"} if token else {}
        return self.client.post(PROTECTED_URL, {}, format="json", **extra)

class CredencialesNoRevelanInformacionTests(AuthSecurityBase):
    """Caja negra: lo que ve un atacante desde afuera."""

    def test_correo_inexistente_y_clave_mala_responden_igual(self):
        existente = self._login(password=CLAVE_MALA)
        inexistente = self._login(email="nadie@univalle.edu.co", password=CLAVE_MALA)
        self.assertEqual(existente.status_code, 401)
        self.assertEqual(inexistente.status_code, 401)
        self.assertEqual(existente.json(), inexistente.json())

    def test_cuenta_inactiva_responde_igual_que_clave_mala(self):
        inactivo = self._crear_usuario("inactivo@univalle.edu.co")
        inactivo.is_active = False
        inactivo.save()
        r_inactivo = self._login(email="inactivo@univalle.edu.co")  # clave correcta
        r_mala = self._login(password=CLAVE_MALA)
        self.assertEqual(r_inactivo.status_code, 401)
        self.assertEqual(r_inactivo.json(), r_mala.json())

    def test_cuenta_eliminada_logicamente_responde_igual_que_clave_mala(self):
        eliminado = self._crear_usuario("eliminado@univalle.edu.co")
        eliminado.deleted_at = timezone.now()
        eliminado.save()
        r_eliminado = self._login(email="eliminado@univalle.edu.co")  # clave correcta
        r_mala = self._login(password=CLAVE_MALA)
        self.assertEqual(r_eliminado.status_code, 401)
        self.assertEqual(r_eliminado.json(), r_mala.json())

    def test_captcha_invalido_responde_igual_exista_o_no_el_correo(self):
        self.mock_captcha.return_value = False
        existente = self._login()
        inexistente = self._login(email="nadie@univalle.edu.co")
        self.assertEqual(existente.status_code, 400)
        self.assertEqual(existente.json(), inexistente.json())

    def test_captcha_falso_no_entrega_tokens_con_credenciales_correctas(self):
        self.mock_captcha.return_value = False
        respuesta = self._login()
        self.assertEqual(respuesta.status_code, 400)
        self.assertNotIn("access", respuesta.json())
        self.assertNotIn("refresh", respuesta.json())

    def test_error_de_login_no_filtra_datos_sensibles(self):
        cuerpo = self._login(password=CLAVE_MALA).content.decode()
        for prohibido in (EMAIL, CLAVE_MALA, "Traceback", "md5$"):
            self.assertNotIn(prohibido, cuerpo)


class JwtSeguridadTests(AuthSecurityBase):
    """Caja blanca: firma, expiración e integridad del JWT."""

    def test_access_token_tiene_firma_hs256_vida_maxima_y_claims(self):
        token = self._access_token()
        self.assertEqual(jwt.get_unverified_header(token)["alg"], "HS256")

        payload = jwt.decode(
            token, api_settings.SIGNING_KEY, algorithms=[api_settings.ALGORITHM]
        )
        self.assertEqual(payload["token_type"], "access")
        self.assertLessEqual(payload["exp"] - payload["iat"], 3600)  # <= 60 min
        self.assertEqual(payload["roles"], ["AUTOR"])
        self.assertEqual(payload["active_role"], "AUTOR")
        self.assertEqual(payload["full_name"], "Usuario Prueba")

        # Con otra clave, la firma no valida
        with self.assertRaises(jwt.InvalidSignatureError):
            jwt.decode(token, OTRA_CLAVE, algorithms=["HS256"])

    def test_token_no_contiene_la_contrasena_ni_su_hash(self):
        token = self._access_token()
        payload = jwt.decode(
            token, api_settings.SIGNING_KEY, algorithms=[api_settings.ALGORITHM]
        )
        texto = json.dumps(payload)
        self.assertNotIn("password", payload)
        self.assertNotIn(PASSWORD, texto)
        self.assertNotIn(self.user.password, texto)

    def test_ruta_protegida_sin_token_retorna_401(self):
        self.assertEqual(self._ruta_protegida().status_code, 401)

    def test_token_expirado_retorna_401(self):
        token = AccessToken.for_user(self.user)
        token.set_exp(lifetime=-timedelta(minutes=1))
        respuesta = self._ruta_protegida(str(token))
        self.assertEqual(respuesta.status_code, 401)
        self.assertIn("expired", respuesta.content.decode().lower())

    def test_token_vigente_autentica_pero_rol_autor_recibe_403(self):
        # Control: demuestra que el 401 anterior se debe a la expiración,
        # no a que la ruta rechace todo.
        respuesta = self._ruta_protegida(self._access_token())
        self.assertEqual(respuesta.status_code, 403)

    def test_token_con_payload_alterado_retorna_401(self):
        token = self._access_token()
        header, _, firma = token.split(".")
        claims = jwt.decode(token, options={"verify_signature": False})
        claims["roles"] = ["ADMIN"]  # intento de escalar privilegios
        alterado = f"{header}.{_b64url(claims)}.{firma}"
        self.assertEqual(self._ruta_protegida(alterado).status_code, 401)

    def test_token_firmado_con_otra_clave_retorna_401(self):
        claims = jwt.decode(self._access_token(), options={"verify_signature": False})
        falso = jwt.encode(claims, OTRA_CLAVE, algorithm="HS256")
        self.assertEqual(self._ruta_protegida(falso).status_code, 401)

    def test_token_sin_firma_alg_none_retorna_401(self):
        claims = jwt.decode(self._access_token(), options={"verify_signature": False})
        sin_firma = jwt.encode(claims, None, algorithm="none")
        self.assertEqual(self._ruta_protegida(sin_firma).status_code, 401)

    def test_refresh_token_no_sirve_como_access(self):
        refresh = self._login().json()["refresh"]
        self.assertEqual(self._ruta_protegida(refresh).status_code, 401)


class FuerzaBrutaTests(AuthSecurityBase):
    """Peticiones masivas: el bloqueo debe frenar el ataque."""

    def test_peticiones_masivas_quedan_bloqueadas(self):
        codigos = [self._login(password=CLAVE_MALA).status_code for _ in range(30)]
        self.assertEqual(codigos[:5], [401] * 5)
        self.assertTrue(all(c == 429 for c in codigos[5:]))
        self.assertEqual(LoginAudit.objects.count(), 5)  # lo bloqueado no se registra

    def test_bloqueo_es_identico_para_correo_existente_e_inexistente(self):
        inexistente = "nadie@univalle.edu.co"
        for correo in (EMAIL, inexistente):
            for _ in range(5):
                self._login(email=correo, password=CLAVE_MALA)
        r_existente = self._login(email=EMAIL, password=CLAVE_MALA)
        r_inexistente = self._login(email=inexistente, password=CLAVE_MALA)
        self.assertEqual(r_existente.status_code, 429)
        self.assertEqual(r_existente.json(), r_inexistente.json())