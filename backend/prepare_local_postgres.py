"""Create the configured local database if absent; never alter existing tables."""
import os

import django
import psycopg
from psycopg import sql

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()


def main():
    from django.conf import settings

    database = settings.DATABASES['default']
    if database['ENGINE'] != 'django.db.backends.postgresql':
        raise SystemExit('Configura DB_NAME en backend/.env para usar PostgreSQL.')
    if database['HOST'] not in ('localhost', '127.0.0.1', '::1'):
        raise SystemExit('Este script prepara exclusivamente PostgreSQL local.')
    with psycopg.connect(
        dbname='postgres', user=database['USER'], password=database['PASSWORD'],
        host=database['HOST'], port=database['PORT'], autocommit=True,
    ) as connection:
        exists = connection.execute(
            'SELECT 1 FROM pg_database WHERE datname = %s', (database['NAME'],),
        ).fetchone()
        if exists:
            print('La base local configurada ya existe.')
        else:
            connection.execute(sql.SQL('CREATE DATABASE {}').format(sql.Identifier(database['NAME'])))
            print('Base local configurada creada. Ejecuta manage.py migrate --noinput.')


if __name__ == '__main__':
    main()
