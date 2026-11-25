from django.contrib.auth import get_user_model
from django.db import models

from apps.conferences.models import ArticleReviewer, CoAuthor
from apps.users.models import RoleName

User = get_user_model()


def get_balanced_reviewer_suggestions(article, limit=6):
    """
    GCDC-161 (HU-12): Algoritmo de sugerencia balanceada de jurados.

    Retorna una lista de miembros del comité sugeridos como jurados para el artículo dado,
    ordenados por menor carga asignada (balanceo) y excluyendo:
    - El autor responsable del artículo.
    - Los coautores registrados del artículo (por email).
    - Jurados ya asignados al artículo.

    Args:
        article: Instancia de Article.
        limit: Máximo de sugerencias a retornar.

    Returns:
        QuerySet de usuarios con anotación `current_assignments`.
    """
    # IDs de personas con conflicto de interés
    coauthor_emails = list(
        CoAuthor.objects.filter(article=article).values_list("email", flat=True)
    )
    already_assigned_ids = list(
        ArticleReviewer.objects.filter(article=article).values_list(
            "reviewer_id", flat=True
        )
    )

    # Excluir: autor, coautores (por email), ya asignados
    excluded_ids = [article.responsible_author_id] + already_assigned_ids

    candidates = (
        User.objects.filter(
            is_active=True,
            deleted_at__isnull=True,
            user_roles__role__name=RoleName.COMITE,
        )
        .exclude(id__in=excluded_ids)
        .exclude(email__in=coauthor_emails)
        .annotate(
            current_assignments=models.Count("reviewer_assignments"),
            thematic_affinity=models.Count(
                "reviewer_assignments",
                filter=models.Q(
                    reviewer_assignments__article__thematic_line=article.thematic_line
                ),
            ),
        )
        .order_by("current_assignments", "-thematic_affinity", "full_name")[:limit]
    )

    return candidates


def validate_reviewer_conflicts(article, reviewer_ids):
    """
    GCDC-161 (HU-12): Valida que ninguno de los jurados propuestos tenga conflicto de interés.

    Conflictos:
    1. El jurado es el autor responsable del artículo.
    2. El jurado es un coautor del artículo (por email).
    3. El jurado ya fue asignado a este artículo.
    4. El jurado no tiene rol COMITE.

    Returns:
        Lista de errores (vacía si no hay conflictos).
    """
    errors = []

    # 1. Verificar que los usuarios existen y tienen rol COMITE
    reviewers = User.objects.filter(id__in=reviewer_ids, is_active=True)
    found_ids = set(reviewers.values_list("id", flat=True))
    missing_ids = set(reviewer_ids) - found_ids
    if missing_ids:
        errors.append(
            f"Los siguientes IDs de usuario no existen o están inactivos: {sorted(missing_ids)}"
        )
        return errors

    for reviewer in reviewers:
        if not reviewer.has_role(RoleName.COMITE):
            errors.append(
                f"El usuario {reviewer.email} (ID {reviewer.id}) no tiene rol COMITE."
            )

    # 2. Autor responsable no puede ser jurado de su propio artículo
    if article.responsible_author_id in reviewer_ids:
        errors.append(
            "Conflicto de interés: el autor responsable no puede ser jurado de su propio artículo."
        )

    # 3. Coautores no pueden ser jurados
    coauthor_emails = set(
        CoAuthor.objects.filter(article=article).values_list("email", flat=True)
    )
    for reviewer in reviewers:
        if reviewer.email in coauthor_emails:
            errors.append(
                f"Conflicto de interés: {reviewer.email} (ID {reviewer.id}) es coautor del artículo."
            )

    # 4. Jurados ya asignados
    already_assigned = set(
        ArticleReviewer.objects.filter(
            article=article, reviewer_id__in=reviewer_ids
        ).values_list("reviewer_id", flat=True)
    )
    if already_assigned:
        errors.append(
            f"Los siguientes jurados ya están asignados a este artículo: {sorted(already_assigned)}"
        )

    return errors
