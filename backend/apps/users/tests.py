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
