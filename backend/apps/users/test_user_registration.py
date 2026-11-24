import statistics
import time
import uuid

import factory
from django.contrib.auth.hashers import identify_hasher
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from apps.users.models import CustomUser, Role, RoleName, UserRole

CLAVE = "ClaveSegura123*"
HASHER_RAPIDO = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # solo para pruebas
LIMITE_SEGUNDOS = 0.1  # criterio de la subtarea: 401/403 en <= 100 ms
NOMBRES_MALICIOSOS = [
    "<script>alert(1)</script>",
    "<img src=x onerror=alert(1)>",
    "Ana <b>Perez</b>",
]


def asignar_unico_rol(user, nombre_rol):
    """create_user ya asigna AUTOR por defecto: aqui dejamos exactamente un rol."""
    UserRole.objects.filter(user=user).delete()
    rol, _ = Role.objects.get_or_create(name=nombre_rol)
    UserRole.objects.create(user=user, role=rol)


class UserFactory(factory.django.DjangoModelFactory):
    """Fixture de usuarios: UserFactory(role=RoleName.ADMIN), por ejemplo."""

    class Meta:
        model = CustomUser

    email = factory.Sequence(lambda n: f"usuario{n}@univalle.edu.co")
    full_name = factory.Sequence(lambda n: f"Usuario Prueba {n}")
    affiliation = "Universidad del Valle"
    password = CLAVE
    role = RoleName.AUTOR

    @classmethod
    def _create(cls, model_class, *args, **kwargs):
        rol = kwargs.pop("role")
        user = model_class.objects.create_user(*args, **kwargs)
        asignar_unico_rol(user, rol)
        return user


@override_settings(PASSWORD_HASHERS=HASHER_RAPIDO)
class BaseRoles(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.register_url = reverse("user-register")
        self.admin_create_url = reverse("admin-user-create")
        self.autor = UserFactory(role=RoleName.AUTOR)
        self.comite = UserFactory(role=RoleName.COMITE)
        self.admin = UserFactory(role=RoleName.ADMIN)

    def _payload(self, **extra):
        data = {
            "email": f"nuevo{uuid.uuid4().hex[:8]}@univalle.edu.co",
            "password": CLAVE,
            "full_name": "Nombre Valido",
            "affiliation": "Universidad del Valle",
        }
        data.update(extra)
        return data


class FixturesDeRolesTests(BaseRoles):
    def test_cada_fixture_tiene_exactamente_su_rol(self):
        esperados = [
            (self.autor, RoleName.AUTOR),
            (self.comite, RoleName.COMITE),
            (self.admin, RoleName.ADMIN),
        ]
        for user, rol in esperados:
            with self.subTest(rol=rol):
                self.assertEqual(set(user.roles.values_list("name", flat=True)), {rol})
                self.assertTrue(user.has_role(rol))


class MatrizDePermisosTests(BaseRoles):
    def test_quien_puede_crear_usuarios_como_administrador(self):
        casos = [(None, 401), (self.autor, 403), (self.comite, 201), (self.admin, 201)]
        for user, esperado in casos:
            with self.subTest(usuario=getattr(user, "email", "anonimo")):
                self.client.force_authenticate(user=user)  # None = sin sesion
                r = self.client.post(
                    self.admin_create_url,
                    self._payload(role=RoleName.AUTOR),
                    format="json",
                )
                self.assertEqual(r.status_code, esperado)


class HashDeContrasenaTests(TestCase):
    """Sin hasher rapido: se comprueba el algoritmo real de la configuracion."""

    def test_contrasena_no_queda_en_texto_plano(self):
        email = f"hash{uuid.uuid4().hex[:8]}@univalle.edu.co"
        r = APIClient().post(
            reverse("user-register"),
            {
                "email": email,
                "password": CLAVE,
                "full_name": "Nombre Valido",
                "affiliation": "Universidad del Valle",
            },
            format="json",
        )
        self.assertEqual(r.status_code, 201)
        user = CustomUser.objects.get(email=email)
        self.assertNotEqual(user.password, CLAVE)
        self.assertNotIn(CLAVE, user.password)
        algoritmo = identify_hasher(user.password).algorithm
        self.assertNotIn(algoritmo, {"md5", "sha1", "unsalted_md5", "unsalted_sha1", "crypt"})
        self.assertTrue(user.check_password(CLAVE))


class SanitizacionDelNombreTests(BaseRoles):
    def test_registro_publico_rechaza_scripts_en_el_nombre(self):
        for nombre in NOMBRES_MALICIOSOS:
            with self.subTest(nombre=nombre):
                datos = self._payload(full_name=nombre)
                r = self.client.post(self.register_url, datos, format="json")
                self.assertEqual(r.status_code, 400)
                self.assertIn("full_name", r.data)
                self.assertFalse(CustomUser.objects.filter(email=datos["email"]).exists())

    def test_creacion_por_admin_rechaza_scripts_en_el_nombre(self):
        self.client.force_authenticate(user=self.admin)
        for nombre in NOMBRES_MALICIOSOS:
            with self.subTest(nombre=nombre):
                datos = self._payload(full_name=nombre, role=RoleName.AUTOR)
                r = self.client.post(self.admin_create_url, datos, format="json")
                self.assertEqual(r.status_code, 400)
                self.assertFalse(CustomUser.objects.filter(email=datos["email"]).exists())

    def test_actualizacion_propia_rechaza_scripts_en_el_nombre(self):
        self.client.force_authenticate(user=self.autor)
        url = reverse("user-detail", kwargs={"pk": self.autor.id})
        for nombre in NOMBRES_MALICIOSOS:
            with self.subTest(nombre=nombre):
                r = self.client.patch(url, {"full_name": nombre}, format="json")
                self.assertEqual(r.status_code, 400)
                self.autor.refresh_from_db()
                self.assertNotEqual(self.autor.full_name, nombre)

    def test_nombre_legitimo_con_tildes_y_apostrofe_se_acepta(self):
        datos = self._payload(full_name="María José O'Connor-Peña")
        r = self.client.post(self.register_url, datos, format="json")
        self.assertEqual(r.status_code, 201)
        creado = CustomUser.objects.get(email=datos["email"])
        self.assertEqual(creado.full_name, "María José O'Connor-Peña")


class TiempoDeRespuestaNoAutorizadaTests(BaseRoles):
    def _medir(self, nombre, peticion, esperado):
        peticion()  # calentamiento
        tiempos = []
        for _ in range(20):
            inicio = time.perf_counter()
            r = peticion()
            tiempos.append(time.perf_counter() - inicio)
            self.assertEqual(r.status_code, esperado)
        mediana = statistics.median(tiempos)
        print(f"\n{nombre}: mediana={mediana * 1000:.1f} ms, max={max(tiempos) * 1000:.1f} ms")
        self.assertLess(mediana, LIMITE_SEGUNDOS)

    def test_sin_token_responde_401_rapido(self):
        self._medir(
            "401 sin token",
            lambda: self.client.post(self.admin_create_url, {}, format="json"),
            401,
        )

    def test_token_invalido_responde_401_rapido(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer token.invalido.firma")
        self._medir(
            "401 token invalido",
            lambda: self.client.post(self.admin_create_url, {}, format="json"),
            401,
        )

    def test_autor_creando_usuarios_responde_403_rapido(self):
        self.client.force_authenticate(user=self.autor)
        self._medir(
            "403 autor crea usuarios",
            lambda: self.client.post(self.admin_create_url, {}, format="json"),
            403,
        )

    def test_autor_editando_a_otro_responde_403_rapido(self):
        otro = UserFactory(role=RoleName.AUTOR)
        self.client.force_authenticate(user=self.autor)
        url = reverse("user-detail", kwargs={"pk": otro.id})
        self._medir(
            "403 autor edita a otro",
            lambda: self.client.patch(url, {"bio": "x"}, format="json"),
            403,
        )