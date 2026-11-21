import json

from rest_framework import serializers

from apps.conferences.models import Article, CoAuthor, ThematicLine

MAX_PDF_SIZE = 10 * 1024 * 1024  # 10 MB, límite del informe


class CoAuthorInputSerializer(serializers.Serializer):
    """Datos de un coautor. No necesita cuenta en la plataforma."""

    full_name = serializers.CharField(max_length=255)
    email = serializers.EmailField()
    affiliation = serializers.CharField(max_length=255)
    is_corresponding_author = serializers.BooleanField(required=False, default=False)


class ArticleSubmissionSerializer(serializers.Serializer):
    """Valida la postulación inicial de un artículo (multipart con PDF)."""

    title = serializers.CharField(max_length=255)
    abstract = serializers.CharField()
    keywords = serializers.CharField(max_length=255)
    thematic_line = serializers.PrimaryKeyRelatedField(
        queryset=ThematicLine.objects.all()
    )
    coauthors = serializers.JSONField(required=False, default=list)
    pdf = serializers.FileField()

    def validate_coauthors(self, value):
        # En multipart la lista llega como texto JSON.
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except ValueError:
                raise serializers.ValidationError("Debe ser una lista JSON válida.")
        if not isinstance(value, list):
            raise serializers.ValidationError("Debe ser una lista de coautores.")
        serializer = CoAuthorInputSerializer(data=value, many=True)
        serializer.is_valid(raise_exception=True)
        return serializer.validated_data

    def validate_pdf(self, value):
        if value.size > MAX_PDF_SIZE:
            raise serializers.ValidationError("El PDF no puede superar 10 MB.")
        if value.content_type != "application/pdf":
            raise serializers.ValidationError("El archivo debe ser application/pdf.")
        header = value.read(5)
        value.seek(0)
        if header != b"%PDF-":
            raise serializers.ValidationError("El archivo no es un PDF válido.")
        return value


class CoAuthorSerializer(serializers.ModelSerializer):
    class Meta:
        model = CoAuthor
        fields = ["full_name", "email", "affiliation", "is_corresponding_author"]


class ArticleSerializer(serializers.ModelSerializer):
    """Respuesta del endpoint: el artículo con sus coautores."""

    coauthors = CoAuthorSerializer(many=True, read_only=True)

    class Meta:
        model = Article
        fields = [
            "id",
            "title",
            "abstract",
            "keywords",
            "thematic_line",
            "status",
            "is_enabled",
            "submitted_at",
            "coauthors",
        ]