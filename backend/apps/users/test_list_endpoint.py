from time import perf_counter

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import AccessToken

from .models import CustomUser, Role, RoleName, UserRole


class UserListEndpointTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = CustomUser.objects.create_user(
            email="directory-admin@example.com", full_name="Admin",
            affiliation="Administration", roles=[RoleName.ADMIN],
        )
        author_role, _ = Role.objects.get_or_create(name=RoleName.AUTOR)
        users = CustomUser.objects.bulk_create([
            CustomUser(
                email=f"author{i}@example.com", full_name=f"Author {i}",
                affiliation="Univalle" if i < 15 else "Other",
                is_active=i % 2 == 0,
            )
            for i in range(999)
        ])
        UserRole.objects.bulk_create([
            UserRole(user=user, role=author_role) for user in users
        ])
        cls.author = users[0]
        cls.inactive = users[1]

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(self.admin)
        self.url = reverse("user-list")

    def test_pagination_and_safe_payload(self):
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), {"count", "next", "previous", "results"})
        self.assertEqual(response.data["count"], 1000)
        self.assertEqual(len(response.data["results"]), 10)
        self.assertIsNone(response.data["previous"])
        self.assertIsNotNone(response.data["next"])
        self.assertEqual(set(response.data["results"][0]), {
            "id", "email", "full_name", "affiliation", "roles", "is_active", "created_at",
        })
        second = self.client.get(response.data["next"])
        self.assertIsNotNone(second.data["previous"])
        self.assertTrue(
            {u["id"] for u in response.data["results"]}.isdisjoint(
                u["id"] for u in second.data["results"]
            )
        )

    def test_combined_filters(self):
        response = self.client.get(self.url, {"role": "AUTOR", "affiliation": "Univalle"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 15)
        self.assertIn("role=AUTOR", response.data["next"])
        self.assertIn("affiliation=Univalle", response.data["next"])
        for active, expected in [("true", 8), ("false", 7)]:
            with self.subTest(active=active):
                response = self.client.get(self.url, {
                    "role": "AUTOR", "affiliation": "univalle", "is_active": active,
                })
                self.assertEqual(response.data["count"], expected)
                for user in response.data["results"]:
                    self.assertIn("AUTOR", user["roles"])
                    self.assertEqual(user["affiliation"], "Univalle")
                    self.assertEqual(user["is_active"], active == "true")

    def test_soft_deleted_users_are_excluded(self):
        CustomUser.objects.filter(pk=self.inactive.pk).update(deleted_at=timezone.now())
        response = self.client.get(self.url, {"affiliation": "Univalle", "is_active": "false"})
        self.assertEqual(response.data["count"], 6)

    def test_invalid_role_and_page(self):
        self.assertEqual(self.client.get(self.url, {"role": "INVALID"}).status_code, 400)
        self.assertEqual(self.client.get(self.url, {"page": 101}).status_code, 404)
        self.assertEqual(self.client.get(self.url, {"affiliation": "Missing"}).data["results"], [])

    def test_permissions(self):
        self.client.force_authenticate(None)
        self.assertEqual(self.client.get(self.url).status_code, 401)
        self.client.force_authenticate(self.author)
        self.assertEqual(self.client.get(self.url).status_code, 403)
        committee = CustomUser.objects.create_user(
            email="committee@example.com", full_name="Committee", roles=[RoleName.COMITE],
        )
        self.client.force_authenticate(committee)
        self.assertEqual(self.client.get(self.url).status_code, 200)

    def test_query_budget_and_latency_for_1000_users(self):
        # Warm imports and URL resolution before measuring the request.
        self.client.get(self.url)
        for params in [{}, {"role": "AUTOR", "affiliation": "Univalle"}]:
            with self.subTest(params=params):
                started = perf_counter()
                # ADMIN permission, count, paginated users, prefetched roles.
                with self.assertNumQueries(4):
                    response = self.client.get(self.url, params)
                elapsed = perf_counter() - started
                self.assertEqual(response.status_code, 200)
                self.assertLessEqual(elapsed, 0.4)

    def test_latency_with_jwt_for_1000_users(self):
        self.client.force_authenticate(None)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.admin)}")
        for params in [{}, {"role": "AUTOR", "affiliation": "Univalle"}]:
            self.client.get(self.url, params)
            durations = []
            for _ in range(20):
                started = perf_counter()
                response = self.client.get(self.url, params)
                durations.append((perf_counter() - started) * 1000)
                self.assertEqual(response.status_code, 200)
            maximum = max(durations)
            print(
                f"\nUsers JWT benchmark {params}: "
                f"mean={sum(durations) / len(durations):.1f} ms, max={maximum:.1f} ms"
            )
            self.assertLessEqual(maximum, 400)
