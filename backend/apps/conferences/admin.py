from django.contrib import admin

from .models import Article, CoAuthor, Conference, ThematicLine


@admin.register(ThematicLine)
class ThematicLineAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Conference)
class ConferenceAdmin(admin.ModelAdmin):
    list_display = (
        "edition_name",
        "submission_deadline",
        "evaluation_deadline",
        "event_start_date",
        "event_end_date",
    )


class CoAuthorInline(admin.TabularInline):
    model = CoAuthor
    extra = 1


@admin.register(Article)
class ArticleAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "thematic_line",
        "responsible_author",
        "status",
        "submitted_at",
    )
    list_filter = ("status", "thematic_line")
    search_fields = ("title", "keywords", "responsible_author__email")
    inlines = [CoAuthorInline]