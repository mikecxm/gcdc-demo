from django.contrib.auth import get_user_model
from django.contrib import admin

from .models import (
    Article,
    ArticleMetadataAudit,
    ArticleReviewer,
    ArticleVersion,
    CoAuthor,
    Conference,
    Evaluation,
    PresentacionAval,
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


class ArticleMetadataAuditInline(admin.TabularInline):
    model = ArticleMetadataAudit
    extra = 0
    readonly_fields = ("field_name", "old_value", "new_value", "modified_at")
    can_delete = False


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
    inlines = [CoAuthorInline, ArticleVersionInline, ArticleMetadataAuditInline]


@admin.register(ArticleMetadataAudit)
class ArticleMetadataAuditAdmin(admin.ModelAdmin):
    list_display = ("article", "field_name", "old_value", "new_value", "modified_at")
    list_filter = ("field_name", "modified_at")
    search_fields = ("article__title", "old_value", "new_value")
    readonly_fields = ("article", "field_name", "old_value", "new_value", "modified_at")


@admin.register(ArticleReviewer)
class ArticleReviewerAdmin(admin.ModelAdmin):
    list_display = ("article", "reviewer", "assigned_at")
    list_filter = ("reviewer",)


@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ("assignment", "version", "decision", "evaluated_at")
    list_filter = ("decision",)


@admin.register(PresentacionAval)
class PresentacionAvalAdmin(admin.ModelAdmin):
    list_display = ("article", "assignment", "status", "recorded_at", "created_at")
    list_filter = ("status", "recorded_at")
    search_fields = ("article__title", "assignment__reviewer__email")
