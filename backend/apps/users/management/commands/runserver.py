"""Keep Django runserver behavior with a backlog sized for concurrent QA."""
from django.contrib.staticfiles.management.commands.runserver import Command as DjangoRunserver
from config.servers import LocalWSGIServer


class Command(DjangoRunserver):
    server_cls = LocalWSGIServer
