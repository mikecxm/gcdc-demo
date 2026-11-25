from rest_framework import serializers

from apps.conferences.models import ArticleReviewer


class ReviewerAssignmentInputSerializer(serializers.Serializer):
    """
    GCDC-161 (HU-12): Validación de entrada para la asignación de jurados.
    Recibe el ID del artículo y una lista de exactamente 3 IDs de jurados.
    """

    article_id = serializers.IntegerField()
    reviewer_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=3,
        max_length=3,
        help_text="Lista de exactamente 3 IDs de miembros del comité a asignar como jurados.",
    )

    def validate_reviewer_ids(self, value):
        if len(set(value)) != 3:
            raise serializers.ValidationError(
                "Los 3 jurados deben ser personas distintas (IDs duplicados)."
            )
        return value


class ReviewerAssignmentOutputSerializer(serializers.ModelSerializer):
    """Respuesta de cada asignación de jurado creada."""

    reviewer_id = serializers.IntegerField(source="reviewer.id")
    reviewer_email = serializers.EmailField(source="reviewer.email")
    reviewer_name = serializers.CharField(source="reviewer.full_name")

    class Meta:
        model = ArticleReviewer
        fields = [
            "id",
            "reviewer_id",
            "reviewer_email",
            "reviewer_name",
            "assigned_at",
        ]
        read_only_fields = fields


class ReviewerSuggestionSerializer(serializers.Serializer):
    """Respuesta para las sugerencias de jurados balanceados."""

    id = serializers.IntegerField()
    email = serializers.EmailField()
    full_name = serializers.CharField()
    affiliation = serializers.CharField()
    current_assignments = serializers.IntegerField(
        help_text="Cantidad actual de artículos asignados como jurado."
    )
    thematic_affinity = serializers.IntegerField(
        help_text="Cantidad de artículos ya evaluados en la misma línea temática.",
        default=0,
    )
