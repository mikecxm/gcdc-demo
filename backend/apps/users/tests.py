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
