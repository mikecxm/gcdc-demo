from rest_framework import serializers
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated

from .models import ThematicLine


class ThematicLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThematicLine
        fields = ["id", "name"]


class ThematicLineListView(ListAPIView):
    """GET /api/v1/conferences/thematic-lines/ : las 5 líneas temáticas oficiales."""

    queryset = ThematicLine.objects.all()
    serializer_class = ThematicLineSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None  # Son solo 5: se devuelve la lista completa