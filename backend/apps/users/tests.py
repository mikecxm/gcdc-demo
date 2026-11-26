from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from .models import Role, RoleName, UserRole

User = get_user_model()


class UserRegistrationTests(APITestCase):
    def setUp(self):
        self.register_url = reverse("user-register")
        self.admin_create_url = reverse("admin-user-create")

        # Asegurar existencia de roles en base de datos
        for role_name in RoleName.values:
            Role.objects.get_or_create(name=role_name)

        # Crear usuarios para pruebas de RBAC
        self.admin_user = User.objects.create_user(
            email="admin@univalle.edu.co",
            password="AdminPassword123!",
            full_name="Admin Principal",
            affiliation="Universidad del Valle",
            roles=[RoleName.ADMIN],
        )

        self.committee_user = User.objects.create_user(
            email="comite@univalle.edu.co",
            password="ComitePassword123!",
            full_name="Miembro Comité",
            affiliation="Universidad del Valle",
            roles=[RoleName.COMITE],
        )

        self.author_user = User.objects.create_user(
            email="autor@univalle.edu.co",
            password="AutorPassword123!",
            full_name="Investigador Autor",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

    def test_public_registration_success_forces_autor_role(self):
        payload = {
            "email": "nuevo.autor@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Nuevo Autor",
            "affiliation": "Universidad del Valle",
            "role": "ADMIN",  # Intento de escalar privilegios en endpoint público
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data)
        self.assertEqual(response.data["email"], "nuevo.autor@univalle.edu.co")
        self.assertEqual(response.data["roles"], [RoleName.AUTOR])

        # Verificar base de datos y hash
        created_user = User.objects.get(email="nuevo.autor@univalle.edu.co")
        self.assertTrue(created_user.check_password("Password123!"))
        self.assertTrue(created_user.has_role(RoleName.AUTOR))
        self.assertFalse(created_user.has_role(RoleName.ADMIN))
        self.assertTrue(created_user.is_active)

    def test_public_registration_ignores_submitted_roles(self):
        payload = {
            "email": "registro.sin_escalacion@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Registro Público",
            "affiliation": "Universidad del Valle",
            "roles": [RoleName.ADMIN, RoleName.COMITE],
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["roles"], [RoleName.AUTOR])

    def test_public_registration_duplicate_email_returns_400(self):
        payload = {
            "email": "autor@univalle.edu.co",  # Ya existe
            "password": "Password123!",
            "full_name": "Duplicado",
            "affiliation": "Universidad del Valle",
        }
        response = self.client.post(self.register_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)

    def test_admin_create_requires_authentication(self):
        payload = {
            "email": "otro@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Sin Auth",
            "affiliation": "Universidad del Valle",
            "role": RoleName.AUTOR,
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_admin_create_forbidden_for_author_role(self):
        self.client.force_authenticate(user=self.author_user)
        payload = {
            "email": "otro@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Autor No Autorizado",
            "affiliation": "Universidad del Valle",
            "role": RoleName.AUTOR,
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_create_allows_committee_user(self):
        self.client.force_authenticate(user=self.committee_user)
        payload = {
            "email": "creado.por.comite@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Nuevo Colega",
            "affiliation": "Universidad del Valle",
            "role": RoleName.COMITE,
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data)
        self.assertEqual(response.data["roles"], [RoleName.COMITE])

    def test_admin_create_allows_admin_to_create_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "email": "nuevo.admin@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Nuevo Administrador",
            "affiliation": "Universidad del Valle",
            "role": RoleName.ADMIN,
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotIn("password", response.data)
        self.assertEqual(response.data["roles"], [RoleName.ADMIN])

    def test_committee_can_create_user_with_multiple_non_admin_roles(self):
        self.client.force_authenticate(user=self.committee_user)
        payload = {
            "email": "multirol.comite@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Usuario Multirol",
            "affiliation": "Universidad del Valle",
            "roles": [RoleName.COMITE, RoleName.AUTOR],
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set(response.data["roles"]), {RoleName.COMITE, RoleName.AUTOR})

    def test_committee_cannot_create_user_with_admin_role(self):
        self.client.force_authenticate(user=self.committee_user)
        payload = {
            "email": "no.admin.por.comite@univalle.edu.co",
            "password": "Password123!",
            "full_name": "No Administrador",
            "affiliation": "Universidad del Valle",
            "roles": [RoleName.COMITE, RoleName.ADMIN],
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            User.objects.filter(email="no.admin.por.comite@univalle.edu.co").exists()
        )

    def test_admin_can_create_user_with_multiple_roles_including_admin(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "email": "admin.autor@univalle.edu.co",
            "password": "Password123!",
            "full_name": "Administrador Autor",
            "affiliation": "Universidad del Valle",
            "roles": [RoleName.ADMIN, RoleName.AUTOR],
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(set(response.data["roles"]), {RoleName.ADMIN, RoleName.AUTOR})

    def test_admin_create_rejects_short_password(self):
        self.client.force_authenticate(user=self.admin_user)
        payload = {
            "email": "pass.corto@univalle.edu.co",
            "password": "123",
            "full_name": "Pass Corto",
            "affiliation": "Universidad del Valle",
            "role": RoleName.AUTOR,
        }
        response = self.client.post(self.admin_create_url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_user_update_affiliation_and_bio_updates_timestamp(self):
        """GCDC-134: Modificar affiliation y bio con tildes y caracteres especiales y comprobar updated_at."""
        import time

        initial_updated_at = self.author_user.updated_at
        time.sleep(0.01)

        new_affiliation = "Universidad del Valle — Sede Meléndez (Facultad de Ingeniería)"
        new_bio = (
            "Investigador sénior en Computación Cuántica, Inteligencia Artificial "
            "y Optimización Estocástica. Área: Métodos Formales & Criptografía moderna."
        )

        self.author_user.affiliation = new_affiliation
        self.author_user.bio = new_bio
        self.author_user.save()

        self.author_user.refresh_from_db()

        self.assertEqual(self.author_user.affiliation, new_affiliation)
        self.assertEqual(self.author_user.bio, new_bio)
        self.assertGreater(self.author_user.updated_at, initial_updated_at)

    def test_user_public_serializer_exposes_bio_and_updated_at(self):
        """GCDC-134: UserPublicSerializer expone bio y updated_at en representación pública."""
        from .serializers import UserPublicSerializer

        self.author_user.bio = "Biografía de prueba con acentuación: Educación y Gestión."
        self.author_user.save()

        data = UserPublicSerializer(self.author_user).data
        self.assertIn("bio", data)
        self.assertIn("updated_at", data)
        self.assertEqual(data["bio"], self.author_user.bio)

    def test_user_soft_delete_audit_and_managers(self):
        """GCDC-138: Baja lógica mediante soft_delete() y filtrado por managers (active_objects, all_objects)."""
        target_user = User.objects.create_user(
            email="eliminar.autor@univalle.edu.co",
            password="Password123!",
            full_name="Usuario Para Baja",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        # Pre-condición: el usuario está activo y aparece en active_objects
        self.assertTrue(target_user.is_active)
        self.assertIsNone(target_user.deleted_at)
        self.assertTrue(User.active_objects.filter(id=target_user.id).exists())

        # Ejecutar baja lógica
        target_user.soft_delete()

        # 1. La fila sigue existiendo en la base de datos (all_objects)
        self.assertTrue(User.all_objects.filter(id=target_user.id).exists())

        # 2. is_active es False y deleted_at tiene timestamp asignado
        target_user.refresh_from_db()
        self.assertFalse(target_user.is_active)
        self.assertIsNotNone(target_user.deleted_at)

        # 3. El usuario ya NO aparece en active_objects
        self.assertFalse(User.active_objects.filter(id=target_user.id).exists())

    def test_btree_indexes_and_combined_queries(self):
        """GCDC-130: Verificar índices B-Tree en CustomUser y UserRole y consultas combinadas."""
        # 1. Verificar índices declarados en CustomUser
        user_index_names = {idx.name for idx in User._meta.indexes}
        self.assertIn("idx_user_email", user_index_names)
        self.assertIn("idx_user_affiliation", user_index_names)
        self.assertIn("idx_user_active_email", user_index_names)

        # 2. Verificar índice compuesto declarado en UserRole
        userrole_index_names = {idx.name for idx in UserRole._meta.indexes}
        self.assertIn("idx_userrole_role_user", userrole_index_names)

        # 3. Consultas combinadas por is_active, affiliation y roles
        authors = User.objects.filter(
            is_active=True,
            affiliation="Universidad del Valle",
            roles__name=RoleName.AUTOR,
        ).distinct()

        self.assertIn(self.author_user, authors)
        self.assertNotIn(self.admin_user, authors)

        # Consultas con filtro y ordenamiento aprovechando el índice en affiliation
        univalle_users = User.objects.filter(
            affiliation__startswith="Universidad"
        ).order_by("affiliation", "email")
        self.assertGreaterEqual(univalle_users.count(), 3)

from unittest.mock import patch

from django.contrib.auth.hashers import make_password
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from apps.users.models import CustomUser, Role, RoleName, UserRole

LOGIN_URL = "/api/v1/auth/login/"


class LoginCaptchaTests(TestCase):
    def setUp(self):
        self.api = APIClient()
        self.password = "Clave12345*"
        self.user = CustomUser.objects.create(
            email="ana@univalle.edu.co",
            full_name="Ana Pérez",
            affiliation="Universidad del Valle",
            password=make_password(self.password),
            is_active=True,
        )
        role, _ = Role.objects.get_or_create(name=RoleName.AUTOR)
        UserRole.objects.create(user=self.user, role=role)

    def _payload(self, **extra):
        data = {"email": self.user.email, "password": self.password}
        data.update(extra)
        return data

    def test_sin_captcha_retorna_400(self):
        r = self.api.post(LOGIN_URL, self._payload(), format="json")
        self.assertEqual(r.status_code, 400)

    @patch("apps.users.views.validate_recaptcha", return_value=False)
    def test_captcha_falso_con_credenciales_correctas_retorna_400(self, _mock):
        r = self.api.post(LOGIN_URL, self._payload(recaptcha_token="falso"), format="json")
        self.assertEqual(r.status_code, 400)

    @patch("apps.users.views.validate_recaptcha", return_value=True)
    def test_login_valido_retorna_200_y_tokens_con_roles(self, _mock):
        r = self.api.post(LOGIN_URL, self._payload(recaptcha_token="ok"), format="json")
        self.assertEqual(r.status_code, 200)
        self.assertIn("access", r.data)
        self.assertIn("refresh", r.data)
        self.assertEqual(r.data["roles"], ["AUTOR"])
        self.assertEqual(r.data["active_role"], "AUTOR")
        self.assertEqual(r.data["full_name"], "Ana Pérez")

        token = AccessToken(r.data["access"])
        self.assertLessEqual(token["exp"] - token["iat"], 3600)  # <= 60 min

    @patch("apps.users.views.validate_recaptcha", return_value=True)
    def test_credenciales_incorrectas_retorna_401_generico(self, _mock):
        r = self.api.post(
            LOGIN_URL,
            {"email": self.user.email, "password": "mala", "recaptcha_token": "ok"},
            format="json",
        )
        self.assertEqual(r.status_code, 401)


class UserUpdateEndpointTests(APITestCase):
    """Pruebas unitarias para GCDC-133: Actualización de datos de usuario (HU-05)."""

    def setUp(self):
        for role_name in RoleName.values:
            Role.objects.get_or_create(name=role_name)

        self.author_1 = User.objects.create_user(
            email="autor1.update@univalle.edu.co",
            password="Password123!",
            full_name="Autor Uno",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        self.author_2 = User.objects.create_user(
            email="autor2.update@univalle.edu.co",
            password="Password123!",
            full_name="Autor Dos",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        self.admin = User.objects.create_user(
            email="admin.update@univalle.edu.co",
            password="Password123!",
            full_name="Admin Update",
            affiliation="Universidad del Valle",
            roles=[RoleName.ADMIN],
        )

        self.committee = User.objects.create_user(
            email="comite.update@univalle.edu.co",
            password="Password123!",
            full_name="Comite Update",
            affiliation="Universidad del Valle",
            roles=[RoleName.COMITE],
        )

    def test_unauthenticated_user_returns_401(self):
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.patch(url, {"full_name": "Nuevo Nombre"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_author_updates_own_profile_success(self):
        import time

        initial_updated_at = self.author_1.updated_at
        time.sleep(0.01)

        self.client.force_authenticate(user=self.author_1)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        payload = {
            "full_name": "Autor Uno Modificado",
            "affiliation": "Facultad de Ingeniería — Univalle",
            "bio": "Investigador en Sistemas Distribuidos y Criptografía.",
        }
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["full_name"], "Autor Uno Modificado")
        self.assertEqual(response.data["affiliation"], "Facultad de Ingeniería — Univalle")
        self.assertEqual(response.data["bio"], payload["bio"])
        self.assertIn("updated_at", response.data)

        self.author_1.refresh_from_db()
        self.assertEqual(self.author_1.full_name, "Autor Uno Modificado")
        self.assertEqual(self.author_1.affiliation, "Facultad de Ingeniería — Univalle")
        self.assertEqual(self.author_1.bio, payload["bio"])
        self.assertGreater(self.author_1.updated_at, initial_updated_at)

    def test_author_cannot_update_another_author_profile_returns_403(self):
        self.client.force_authenticate(user=self.author_1)
        url = reverse("user-detail", kwargs={"pk": self.author_2.id})
        response = self.client.patch(url, {"full_name": "Hack Nombre"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_update_another_user_profile(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        payload = {"full_name": "Nombre Corregido por Admin"}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.author_1.refresh_from_db()
        self.assertEqual(self.author_1.full_name, "Nombre Corregido por Admin")

    def test_committee_can_update_author_profile(self):
        self.client.force_authenticate(user=self.committee)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        payload = {"affiliation": "Instituto de Investigación"}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.author_1.refresh_from_db()
        self.assertEqual(self.author_1.affiliation, "Instituto de Investigación")

    def test_author_cannot_self_assign_admin_role(self):
        self.client.force_authenticate(user=self.author_1)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        payload = {"role": RoleName.ADMIN}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("role", response.data)
        self.author_1.refresh_from_db()
        self.assertFalse(self.author_1.has_role(RoleName.ADMIN))
        self.assertTrue(self.author_1.has_role(RoleName.AUTOR))

    def test_committee_can_assign_multiple_non_admin_roles(self):
        self.client.force_authenticate(user=self.committee)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.patch(
            url, {"roles": [RoleName.COMITE, RoleName.AUTOR]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data["roles"]), {RoleName.COMITE, RoleName.AUTOR})
        self.author_1.refresh_from_db()
        self.assertEqual(
            set(self.author_1.roles.values_list("name", flat=True)),
            {RoleName.COMITE, RoleName.AUTOR},
        )

    def test_committee_can_update_own_roles_without_admin(self):
        self.client.force_authenticate(user=self.committee)
        url = reverse("user-detail", kwargs={"pk": self.committee.id})
        response = self.client.patch(
            url, {"roles": [RoleName.COMITE, RoleName.AUTOR]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(set(response.data["roles"]), {RoleName.COMITE, RoleName.AUTOR})

    def test_committee_cannot_assign_admin_role_to_self(self):
        self.client.force_authenticate(user=self.committee)
        url = reverse("user-detail", kwargs={"pk": self.committee.id})
        response = self.client.patch(
            url, {"roles": [RoleName.COMITE, RoleName.ADMIN]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.committee.refresh_from_db()
        self.assertEqual(
            set(self.committee.roles.values_list("name", flat=True)),
            {RoleName.COMITE},
        )

    def test_committee_cannot_assign_admin_role(self):
        self.client.force_authenticate(user=self.committee)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.patch(
            url, {"roles": [RoleName.ADMIN, RoleName.AUTOR]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.author_1.refresh_from_db()
        self.assertEqual(
            set(self.author_1.roles.values_list("name", flat=True)),
            {RoleName.AUTOR},
        )

    def test_admin_can_edit_multiple_roles_and_assign_admin(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.patch(
            url,
            {"roles": [RoleName.ADMIN, RoleName.COMITE, RoleName.AUTOR]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.data["roles"]),
            {RoleName.ADMIN, RoleName.COMITE, RoleName.AUTOR},
        )

    def test_committee_cannot_remove_an_existing_admin_role(self):
        self.client.force_authenticate(user=self.committee)
        url = reverse("user-detail", kwargs={"pk": self.admin.id})
        response = self.client.patch(
            url, {"roles": [RoleName.AUTOR]}, format="json"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.has_role(RoleName.ADMIN))

    def test_email_cannot_be_changed_via_patch(self):
        self.client.force_authenticate(user=self.author_1)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        original_email = self.author_1.email
        payload = {"email": "hacked@univalle.edu.co", "full_name": "Nombre Válido"}
        response = self.client.patch(url, payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.author_1.refresh_from_db()
        self.assertEqual(self.author_1.email, original_email)

    def test_get_user_detail_returns_public_serializer(self):
        self.client.force_authenticate(user=self.author_1)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], self.author_1.email)
        self.assertNotIn("password", response.data)
        self.assertIn("roles", response.data)


class UserSoftDeleteEndpointTests(APITestCase):
    """Pruebas unitarias para GCDC-137: Baja lógica de usuario (HU-06)."""

    def setUp(self):
        for role_name in RoleName.values:
            Role.objects.get_or_create(name=role_name)

        self.author_1 = User.objects.create_user(
            email="autor1.softdelete@univalle.edu.co",
            password="Password123!",
            full_name="Autor SoftDelete Uno",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        self.author_2 = User.objects.create_user(
            email="autor2.softdelete@univalle.edu.co",
            password="Password123!",
            full_name="Autor SoftDelete Dos",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )

        self.admin = User.objects.create_user(
            email="admin.softdelete@univalle.edu.co",
            password="Password123!",
            full_name="Admin SoftDelete",
            affiliation="Universidad del Valle",
            roles=[RoleName.ADMIN],
        )

        self.committee = User.objects.create_user(
            email="comite.softdelete@univalle.edu.co",
            password="Password123!",
            full_name="Comite SoftDelete",
            affiliation="Universidad del Valle",
            roles=[RoleName.COMITE],
        )

    def test_unauthenticated_user_delete_returns_401(self):
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_author_cannot_delete_another_user_returns_403(self):
        self.client.force_authenticate(user=self.author_1)
        url = reverse("user-detail", kwargs={"pk": self.author_2.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.author_2.refresh_from_db()
        self.assertTrue(self.author_2.is_active)
        self.assertIsNone(self.author_2.deleted_at)

    def test_author_cannot_delete_self_returns_403(self):
        self.client.force_authenticate(user=self.author_1)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.author_1.refresh_from_db()
        self.assertTrue(self.author_1.is_active)
        self.assertIsNone(self.author_1.deleted_at)

    def test_admin_cannot_delete_self_returns_400(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", kwargs={"pk": self.admin.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("detail", response.data)
        self.assertEqual(response.data["detail"], "No puedes desactivar tu propia cuenta.")
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.is_active)
        self.assertIsNone(self.admin.deleted_at)

    def test_admin_can_soft_delete_author_returns_204(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.author_1.refresh_from_db()
        self.assertFalse(self.author_1.is_active)
        self.assertIsNotNone(self.author_1.deleted_at)

        # La fila persiste en all_objects pero desaparece de active_objects
        self.assertTrue(User.all_objects.filter(id=self.author_1.id).exists())
        self.assertFalse(User.active_objects.filter(id=self.author_1.id).exists())

    def test_committee_can_soft_delete_author_returns_204(self):
        self.client.force_authenticate(user=self.committee)
        url = reverse("user-detail", kwargs={"pk": self.author_2.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        self.author_2.refresh_from_db()
        self.assertFalse(self.author_2.is_active)
        self.assertIsNotNone(self.author_2.deleted_at)
        self.assertFalse(User.active_objects.filter(id=self.author_2.id).exists())

    def test_soft_deleted_user_cannot_authenticate_with_prior_jwt(self):
        # Emitir token JWT previo a la baja lógica
        token = str(RefreshToken.for_user(self.author_1).access_token)

        # Admin da de baja al autor
        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # El autor intenta usar su JWT previo
        self.client.force_authenticate(user=None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(response.data.get("code"), "user_inactive")

    def test_cannot_delete_already_soft_deleted_user_returns_404(self):
        self.author_1.soft_delete()

        self.client.force_authenticate(user=self.admin)
        url = reverse("user-detail", kwargs={"pk": self.author_1.id})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

