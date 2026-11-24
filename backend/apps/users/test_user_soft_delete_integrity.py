from unittest.mock import patch

from django.db import transaction
from django.db.models import ProtectedError
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient, APITestCase

from apps.conferences.models import Article, ArticleStatus, ThematicLine
from apps.users.models import CustomUser, RoleName, UserRole

LOGIN_URL = "/api/v1/auth/login/"
CLAVE = "ClaveSegura123*"


def _items(respuesta):
    """El listado puede venir paginado ({'results': [...]}) o como lista simple."""
    datos = respuesta.json()
    return datos["results"] if isinstance(datos, dict) else datos


# MD5 solo se usa en pruebas: acelera la creación de usuarios, no afecta producción.
@override_settings(PASSWORD_HASHERS=["django.contrib.auth.hashers.MD5PasswordHasher"])
class BajaBase(APITestCase):
    def setUp(self):
        patcher = patch("apps.users.views.validate_recaptcha", return_value=True)
        patcher.start()
        self.addCleanup(patcher.stop)

        self.anonimo = APIClient()
        self.cliente_admin = APIClient()

        self.admin = CustomUser.objects.create_user(
            email="baja.admin@correounivalle.edu.co", password=CLAVE,
            full_name="Admin", roles=[RoleName.ADMIN],
        )
        self.comite = CustomUser.objects.create_user(
            email="baja.comite@correounivalle.edu.co", password=CLAVE,
            full_name="Comite", roles=[RoleName.COMITE],
        )
        # Sin roles: create_user asigna AUTOR por defecto
        self.autor = CustomUser.objects.create_user(
            email="baja.autor@correounivalle.edu.co", password=CLAVE,
            full_name="Autor",
        )

        linea, _ = ThematicLine.objects.get_or_create(name="Baja integridad test")
        self.articulo_1 = Article.objects.create(
            title="Articulo uno", abstract="Resumen uno", keywords="uno",
            thematic_line=linea, responsible_author=self.autor,
            status=ArticleStatus.POSTULADO,
        )
        self.articulo_2 = Article.objects.create(
            title="Articulo dos", abstract="Resumen dos", keywords="dos",
            thematic_line=linea, responsible_author=self.autor,
            status=ArticleStatus.EN_REVISION,
        )
        self.ids_articulos = [self.articulo_1.pk, self.articulo_2.pk]

    # ---------- ayudas ----------
    def _login(self, email, password=CLAVE):
        return self.anonimo.post(
            LOGIN_URL,
            {"email": email, "password": password, "recaptcha_token": "ok"},
            format="json",
        )

    def _dar_de_baja_al_autor(self):
        self.cliente_admin.force_authenticate(user=self.admin)
        respuesta = self.cliente_admin.delete(
            reverse("user-detail", kwargs={"pk": self.autor.pk})
        )
        self.assertEqual(respuesta.status_code, 204)

    def _articulos_como_dicts(self):
        return list(
            Article.objects.filter(pk__in=self.ids_articulos).order_by("pk").values()
        )

    def _como_comite(self):
        cliente = APIClient()
        cliente.force_authenticate(user=self.comite)
        return cliente


class BloqueoDeSesionTrasBajaTests(BajaBase):
    def test_antes_de_la_baja_el_autor_si_inicia_sesion(self):
        self.assertEqual(self._login(self.autor.email).status_code, 200)

    def test_tras_la_baja_el_login_con_clave_correcta_da_401(self):
        self._dar_de_baja_al_autor()
        respuesta = self._login(self.autor.email)
        self.assertEqual(respuesta.status_code, 401)
        self.assertNotIn("access", respuesta.json())
        self.assertNotIn("refresh", respuesta.json())

    def test_tras_la_baja_el_token_de_acceso_previo_da_401(self):
        access = self._login(self.autor.email).json()["access"]
        self._dar_de_baja_al_autor()
        respuesta = self.anonimo.get(
            reverse("article-list"), HTTP_AUTHORIZATION=f"Bearer {access}"
        )
        self.assertEqual(respuesta.status_code, 401)

    def test_tras_la_baja_el_token_de_refresh_previo_no_renueva_la_sesion(self):
        refresh = self._login(self.autor.email).json()["refresh"]
        self._dar_de_baja_al_autor()
        respuesta = self.anonimo.post(
            reverse("auth-refresh"), {"refresh": refresh}, format="json"
        )
        self.assertEqual(respuesta.status_code, 401)
        self.assertNotIn("access", respuesta.json())


class IntegridadDeArticulosTests(BajaBase):
    def test_los_articulos_no_cambian_con_la_baja_del_autor(self):
        antes = self._articulos_como_dicts()
        self._dar_de_baja_al_autor()
        self.assertEqual(self._articulos_como_dicts(), antes)

    def test_los_articulos_siguen_apuntando_al_autor_dado_de_baja(self):
        self._dar_de_baja_al_autor()
        for pk in self.ids_articulos:
            with self.subTest(articulo=pk):
                articulo = Article.objects.get(pk=pk)
                self.assertEqual(articulo.responsible_author_id, self.autor.pk)
                self.assertTrue(articulo.is_enabled)

    def test_el_comite_sigue_viendo_los_articulos_en_el_listado(self):
        self._dar_de_baja_al_autor()
        respuesta = self._como_comite().get(reverse("article-list"))
        self.assertEqual(respuesta.status_code, 200)
        ids = {item["id"] for item in _items(respuesta)}
        self.assertTrue(set(self.ids_articulos).issubset(ids))

    def test_el_comite_sigue_viendo_el_detalle_de_cada_articulo(self):
        self._dar_de_baja_al_autor()
        cliente = self._como_comite()
        for pk in self.ids_articulos:
            with self.subTest(articulo=pk):
                respuesta = cliente.get(reverse("article-detail", kwargs={"pk": pk}))
                self.assertEqual(respuesta.status_code, 200)

    def test_el_autor_dado_de_baja_sigue_en_la_base_con_sus_roles(self):
        roles_antes = UserRole.objects.filter(user=self.autor).count()
        self._dar_de_baja_al_autor()
        usuario = CustomUser.all_objects.get(pk=self.autor.pk)
        self.assertFalse(usuario.is_active)
        self.assertIsNotNone(usuario.deleted_at)
        self.assertEqual(UserRole.objects.filter(user=self.autor).count(), roles_antes)

    def test_borrado_fisico_del_autor_con_articulos_esta_protegido(self):
        usuario = CustomUser.all_objects.get(pk=self.autor.pk)
        with self.assertRaises(ProtectedError):
            with transaction.atomic():
                usuario.delete()
        self.assertEqual(Article.objects.filter(pk__in=self.ids_articulos).count(), 2)