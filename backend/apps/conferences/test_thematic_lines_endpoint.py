from django.test import TestCase
from rest_framework.test import APIClient

from apps.users.models import CustomUser, RoleName

URL = "/api/v1/conferences/thematic-lines/"

OFFICIAL_LINES = {
    "Sistemas Inteligentes",
    "Tecnologías en Informática",
    "Educación en Informática",
    "Sistemas de Software",
    "Software en la práctica",
}


class ThematicLineListTests(TestCase):
    def setUp(self):
        self.user = CustomUser.objects.create_user(
            email="autor@correounivalle.edu.co",
            password="Clave-Segura-123",
            full_name="Autor de Prueba",
            affiliation="Universidad del Valle",
            roles=[RoleName.AUTOR],
        )
        self.client = APIClient()

    def test_authenticated_user_gets_the_five_official_lines(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(URL)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 5)
        names = {item["name"] for item in response.data}
        self.assertEqual(names, OFFICIAL_LINES)

    def test_each_line_has_id_and_name(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get(URL)
        for item in response.data:
            self.assertEqual(set(item.keys()), {"id", "name"})

    def test_anonymous_user_is_rejected(self):
        response = self.client.get(URL)
        self.assertIn(response.status_code, (401, 403))

    def test_post_is_not_allowed(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.post(URL, {"name": "Nueva línea"}, format="json")
        self.assertEqual(response.status_code, 405)