from django.db.models import Q
import django_filters

from apps.conferences.models import Article


class ArticleFilter(django_filters.FilterSet):
    """
    Filtros avanzados para la consulta y listado de artículos.
    Aprovecha los índices de base de datos idx_art_enabled_topic_status e idx_art_author_enabled.
    """

    thematic_line = django_filters.CharFilter(method="filter_thematic_line")
    thematic_line_id = django_filters.NumberFilter(field_name="thematic_line_id")
    status = django_filters.CharFilter(method="filter_status")
    search = django_filters.CharFilter(method="filter_search")
    author_id = django_filters.NumberFilter(field_name="responsible_author_id")

    class Meta:
        model = Article
        fields = [
            "thematic_line",
            "thematic_line_id",
            "status",
            "search",
            "author_id",
        ]

    def filter_thematic_line(self, queryset, name, value):
        if not value or value.strip().upper() == "ALL":
            return queryset
        val = value.strip()
        if val.isdigit():
            return queryset.filter(thematic_line_id=int(val))
        return queryset.filter(thematic_line__name__icontains=val)

    def filter_status(self, queryset, name, value):
        if not value or value.strip().upper() == "ALL":
            return queryset
        return queryset.filter(status__iexact=value.strip())

    def filter_search(self, queryset, name, value):
        if not value or not value.strip():
            return queryset
        query = value.strip()
        return queryset.filter(
            Q(title__icontains=query)
            | Q(abstract__icontains=query)
            | Q(keywords__icontains=query)
        )
