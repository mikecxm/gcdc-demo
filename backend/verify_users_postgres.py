"""Run user endpoint QA on an isolated PostgreSQL test database."""
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django

django.setup()

from django.conf import settings
from django.test.utils import get_runner

if settings.DATABASES["default"]["ENGINE"] != "django.db.backends.postgresql":
    sys.exit(
        "Configura backend/.env con DB_NAME, DB_USER, DB_PASSWORD, DB_HOST y DB_PORT. "
        "Esta verificacion requiere PostgreSQL."
    )

if __name__ == "__main__":
    # Django creates and removes test_<DB_NAME>; application tables are untouched.
    runner = get_runner(settings)(verbosity=2, interactive=False)
    sys.exit(bool(runner.run_tests(["apps.users.test_list_endpoint"])))
