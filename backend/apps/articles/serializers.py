from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.conferences.models import Article, CoAuthor, ThematicLine

User = get_user_model()


class AuthorPublicSerializer(serializers.ModelSerializer):
    """Información pública del autor responsable del artículo."""

    class Meta:
        model = User
        fields = [
            "id",
            "full_name",
            "email",
            "affiliation",
        ]
        read_only_fields = fields


class CoAuthorDetailSerializer(serializers.ModelSerializer):
    """Información detallada de los coautores registrados para el artículo."""

    class Meta:
        model = CoAuthor
        fields = [
            "id",
            "full_name",
            "email",
            "affiliation",
            "is_corresponding_author",
        ]
        read_only_fields = fields


class ArticleDetailSerializer(serializers.ModelSerializer):
    """
    Serializador completo para listado y detalle de artículos.
    Cumple con el contrato esperado tanto por frontend como por el DoD de GCDC-145.
    """

    thematic_line = serializers.CharField(source="thematic_line.name", read_only=True)
    thematic_line_id = serializers.IntegerField(source="thematic_line.id", read_only=True)
    responsible_author = AuthorPublicSerializer(read_only=True)
    coauthors = CoAuthorDetailSerializer(many=True, read_only=True)
    pdf_url = serializers.SerializerMethodField()

    class Meta:
        model = Article
        fields = [
            "id",
            "title",
            "abstract",
            "keywords",
            "thematic_line",
            "thematic_line_id",
            "responsible_author",
            "status",
            "is_enabled",
            "submitted_at",
            "pdf_url",
            "coauthors",
        ]
        read_only_fields = fields

    def get_pdf_url(self, obj) -> str:
        """Retorna la URL del PDF correspondiente a la versión más reciente."""
        latest_version = obj.versions.order_by("-version_number").first()
        if latest_version and latest_version.pdf_url:
            return latest_version.pdf_url
        return ""
