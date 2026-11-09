from django.contrib import admin

from .models import ThematicLine


@admin.register(ThematicLine)
class ThematicLineAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)