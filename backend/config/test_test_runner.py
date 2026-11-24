from unittest.mock import Mock, patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from .test_runner import IsolatedDatabaseTestRunner


class DatabaseTestIsolationTests(SimpleTestCase):
    @patch("config.test_runner.DiscoverRunner.setup_databases", return_value="isolated")
    @patch("config.test_runner.connections")
    def test_closes_existing_pool_before_creating_test_database(self, connections, setup):
        connection = Mock(vendor="postgresql", alias="default")
        connection.settings_dict = {"NAME": "development", "OPTIONS": {"pool": True}}
        connection.creation._get_test_db_name.return_value = "test_development"
        connections.all.return_value = [connection]
        connections.__getitem__.return_value = connection

        def check_safe_setup(**kwargs):
            connection.close.assert_called_once()
            connection.close_pool.assert_called_once()
            self.assertNotIn("pool", connection.settings_dict["OPTIONS"])
            connection.settings_dict["NAME"] = "test_development"
            return "isolated"

        setup.side_effect = check_safe_setup
        self.assertEqual(IsolatedDatabaseTestRunner().setup_databases(), "isolated")
        self.assertTrue(connection.settings_dict["OPTIONS"]["pool"])
        self.assertEqual(connection.settings_dict["NAME"], "test_development")

    @patch("config.test_runner.DiscoverRunner.setup_databases")
    @patch("config.test_runner.connections")
    def test_refuses_development_database_as_test_target(self, connections, setup):
        connection = Mock(vendor="postgresql")
        connection.settings_dict = {"NAME": "development", "OPTIONS": {"pool": True}}
        connection.creation._get_test_db_name.return_value = "development"
        connections.all.return_value = [connection]
        with self.assertRaises(ImproperlyConfigured):
            IsolatedDatabaseTestRunner().setup_databases()
        setup.assert_not_called()
        connection.close.assert_not_called()

    @patch("config.test_runner.DiscoverRunner.teardown_databases")
    @patch("config.test_runner.connections")
    def test_drops_test_pool_before_restoring_development_name(self, connections, teardown):
        connection = Mock(vendor="postgresql", alias="default")
        connection.settings_dict = {"NAME": "test_development", "OPTIONS": {"pool": True}}
        connections.__getitem__.return_value = connection
        runner = IsolatedDatabaseTestRunner()
        runner._postgres_pools = {"default": True}

        def check_safe_teardown(old_config, **kwargs):
            connection.close.assert_called_once()
            connection.close_pool.assert_called_once()
            self.assertNotIn("pool", connection.settings_dict["OPTIONS"])
            connection.settings_dict["NAME"] = "development"

        teardown.side_effect = check_safe_teardown
        runner.teardown_databases([])
        self.assertTrue(connection.settings_dict["OPTIONS"]["pool"])
        self.assertEqual(connection.settings_dict["NAME"], "development")
