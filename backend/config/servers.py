"""Shared local HTTP capacity for runserver and concurrent integration QA."""
from django.core.servers.basehttp import ThreadedWSGIServer, WSGIServer


class LocalWSGIServer(WSGIServer):
    # Django defaults to 10 pending TCP connections; QA starts 50 together.
    request_queue_size = 128


class LocalThreadedWSGIServer(ThreadedWSGIServer):
    request_queue_size = LocalWSGIServer.request_queue_size
