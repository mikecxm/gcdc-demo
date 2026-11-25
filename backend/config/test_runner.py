"""Keep PostgreSQL pools from crossing between development and test databases."""
from django.core.exceptions import ImproperlyConfigured
from django.db import connections
from django.test.runner import DiscoverRunner


class IsolatedDatabaseTestRunner(DiscoverRunner):
    def setup_databases(self, **kwargs):
        self._postgres_pools = {}
        for connection in connections.all():
            if connection.vendor != "postgresql":
                continue
            test_name = connection.creation._get_test_db_name()
            if test_name == connection.settings_dict["NAME"]:
                raise ImproperlyConfigured(
                    "La base de pruebas debe ser distinta de la base de desarrollo."
                )
            # A pool is cached by alias, not by database name. Never carry a
            # development pool into Django's database creation/migration phase.
            connection.close()
            connection.close_pool()
            pool = connection.settings_dict["OPTIONS"].pop("pool", None)
            if pool:
                self._postgres_pools[connection.alias] = pool
        databases = super().setup_databases(**kwargs)
        # Only now is NAME pointing at the migrated test database. A fresh
        # pool can safely serve concurrent test requests without using dev.
        for alias, pool in self._postgres_pools.items():
            connection = connections[alias]
            connection.close()
            connection.settings_dict["OPTIONS"]["pool"] = pool
        return databases

    def teardown_databases(self, old_config, **kwargs):
        for alias in self._postgres_pools:
            connection = connections[alias]
            connection.close()
            connection.close_pool()
            connection.settings_dict["OPTIONS"].pop("pool", None)
        try:
            return super().teardown_databases(old_config, **kwargs)
        finally:
            # Django has restored the development database name. Do not
            # retain a pool connected to the now-destroyed test database.
            for alias, pool in self._postgres_pools.items():
                connections[alias].settings_dict["OPTIONS"]["pool"] = pool
