from django_filters import rest_framework as filters

from .models import CustomUser, RoleName


class UserFilter(filters.FilterSet):
    role = filters.ChoiceFilter(field_name="roles__name", choices=RoleName.choices)
    affiliation = filters.CharFilter(lookup_expr="icontains")
    is_active = filters.BooleanFilter()

    class Meta:
        model = CustomUser
        fields = ["role", "affiliation", "is_active"]
