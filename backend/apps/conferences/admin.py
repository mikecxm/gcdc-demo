from django.contrib import admin

from .models import (
    Article,
    ArticleVersion,
    CoAuthor,
    Conference,
    JuryAssignment,
    JuryEvaluation,
    ThematicLine,
)


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


class ArticleVersionInline(admin.TabularInline):
    model = ArticleVersion
    extra = 0
    readonly_fields = ("uploaded_at",)


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
    inlines = [CoAuthorInline, ArticleVersionInline]

@admin.register(JuryAssignment)
class JuryAssignmentAdmin(admin.ModelAdmin):
    list_display = ("article", "juror", "assigned_at")
    list_filter = ("juror",)


@admin.register(JuryEvaluation)
class JuryEvaluationAdmin(admin.ModelAdmin):
    list_display = ("assignment", "version", "verdict", "evaluated_at")
    list_filter = ("verdict",)