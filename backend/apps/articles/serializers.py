from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.conferences.models import Article, CoAuthor, Conference, ThematicLine

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
    Cumple con el contrato esperado tanto por frontend como por el DoD de GCDC-145 y GCDC-149.
    """

    thematic_line = serializers.CharField(source="thematic_line.name", read_only=True)
    thematic_line_id = serializers.IntegerField(source="thematic_line.id", read_only=True)
    responsible_author = AuthorPublicSerializer(read_only=True)
    coauthors = CoAuthorDetailSerializer(many=True, read_only=True)
    pdf_url = serializers.SerializerMethodField()
    submission_deadline = serializers.SerializerMethodField()

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
            "submission_deadline",
            "coauthors",
        ]
        read_only_fields = fields

    def get_pdf_url(self, obj) -> str:
        """Retorna la URL del PDF correspondiente a la versión más reciente."""
        latest_version = obj.versions.order_by("-version_number").first()
        if latest_version and latest_version.pdf_url:
            return latest_version.pdf_url
        return ""

    def get_submission_deadline(self, obj):
        if not hasattr(self, "_submission_deadline"):
            self._submission_deadline = Conference.objects.order_by(
                "-event_start_date"
            ).values_list("submission_deadline", flat=True).first()
        return self._submission_deadline


class ArticleUpdateSerializer(serializers.ModelSerializer):
    """
    GCDC-149 (HU-09): Serializador para actualización parcial (PATCH) de metadatos.
    Permite modificar: title, abstract, keywords y thematic_line.
    """

    thematic_line = serializers.PrimaryKeyRelatedField(
        queryset=ThematicLine.objects.all(), required=False
    )
    thematic_line_id = serializers.PrimaryKeyRelatedField(
        queryset=ThematicLine.objects.all(), source="thematic_line", required=False
    )

    class Meta:
        model = Article
        fields = [
            "title",
            "abstract",
            "keywords",
            "thematic_line",
            "thematic_line_id",
        ]

    def to_internal_value(self, data):
        # Flexibilidad: si thematic_line viene como nombre en texto, resolver al ID correspondiente
        mutable_data = data.copy() if hasattr(data, "copy") else dict(data)
        if "thematic_line" in mutable_data and isinstance(mutable_data["thematic_line"], str):
            val = mutable_data["thematic_line"].strip()
            if not val.isdigit():
                thematic_obj = ThematicLine.objects.filter(name__iexact=val).first()
                if thematic_obj:
                    mutable_data["thematic_line"] = thematic_obj.id

        return super().to_internal_value(mutable_data)

    def validate_title(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El título no puede estar vacío.")
        return cleaned

    def validate_abstract(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("El resumen no puede estar vacío.")
        return cleaned

    def validate_keywords(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("Las palabras clave no pueden estar vacías.")
        return cleaned
