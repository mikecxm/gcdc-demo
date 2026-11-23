from django.contrib.auth import get_user_model
from django.db import models

from apps.conferences.models import ArticleReviewer, CoAuthor
from apps.users.models import RoleName

User = get_user_model()


def validate_reviewer_conflicts(article, reviewer_ids):
    """
    GCDC-161 (HU-12): Valida que ninguno de los jurados propuestos tenga conflicto de interés.

    Conflictos:
    1. El jurado es el autor responsable del artículo.
    2. El jurado es un coautor registrado del artículo (por email o nombre).
    3. El jurado ya fue asignado previamente a este artículo.
    4. El jurado no cuenta con el rol COMITE.

    Returns:
        Lista de errores (vacía si no hay ningún conflicto).
    """
    errors = []

    # 1. Verificar existencia y rol COMITE
    reviewers = list(User.objects.filter(id__in=reviewer_ids, is_active=True))
    found_ids = {r.id for r in reviewers}
    missing_ids = set(reviewer_ids) - found_ids
    if missing_ids:
        errors.append(
            f"Los siguientes IDs de jurado no existen o están inactivos: {sorted(missing_ids)}."
        )
        return errors

    for reviewer in reviewers:
        if not reviewer.has_role(RoleName.COMITE):
            errors.append(
                f"El usuario {reviewer.email} (ID {reviewer.id}) no cuenta con rol COMITE."
            )

    # 2. Conflicto: autor responsable no puede ser jurado de su propio artículo
    if article.responsible_author_id in reviewer_ids:
        errors.append(
            "Conflicto de interés: el autor responsable no puede ser asignado como jurado de su propio artículo."
        )

    # 3. Conflicto: coautores no pueden ser jurados
    coauthors = list(CoAuthor.objects.filter(article=article))
    coauthor_emails = {c.email.strip().lower() for c in coauthors if c.email}
    coauthor_names = {c.full_name.strip().lower() for c in coauthors if c.full_name}

    for reviewer in reviewers:
        rev_email = reviewer.email.strip().lower() if reviewer.email else ""
        rev_name = reviewer.full_name.strip().lower() if reviewer.full_name else ""

        if rev_email and rev_email in coauthor_emails:
            errors.append(
                f"Conflicto de interés: {reviewer.full_name} ({reviewer.email}) es coautor del artículo."
            )
        elif rev_name and rev_name in coauthor_names:
            errors.append(
                f"Conflicto de interés: {reviewer.full_name} ({reviewer.email}) coincide con el coautor del artículo."
            )

    # 4. Jurados ya asignados
    already_assigned = set(
        ArticleReviewer.objects.filter(
            article=article, reviewer_id__in=reviewer_ids
        ).values_list("reviewer_id", flat=True)
    )
    if already_assigned:
        errors.append(
            f"Los siguientes jurados ya se encuentran asignados a este artículo: {sorted(already_assigned)}."
        )

    return errors


def get_balanced_reviewer_suggestions(article, limit=10):
    """
    GCDC-161 (HU-12): Algoritmo de sugerencia balanceada considerando línea temática y menor carga asignada.

    Filtra miembros del comité excluyendo conflictos de interés y ordena por:
    1. Afinidad con la línea temática del artículo (si la bio/afiliación coincide).
    2. Menor cantidad de artículos asignados como jurado (balance de carga).
    """
    # Excluir autor y ya asignados
    already_assigned_ids = list(
        ArticleReviewer.objects.filter(article=article).values_list(
            "reviewer_id", flat=True
        )
    )
    excluded_ids = set(already_assigned_ids)
    if article.responsible_author_id:
        excluded_ids.add(article.responsible_author_id)

    # Excluir coautores por email
    coauthor_emails = list(
        CoAuthor.objects.filter(article=article).values_list("email", flat=True)
    )

    committee_users = (
        User.objects.filter(
            is_active=True,
            deleted_at__isnull=True,
            user_roles__role__name=RoleName.COMITE,
        )
        .exclude(id__in=excluded_ids)
        .exclude(email__in=coauthor_emails)
        .annotate(assigned_article_count=models.Count("reviewer_assignments"))
        .order_by("assigned_article_count", "full_name")
        .distinct()
    )

    thematic_name = article.thematic_line.name.lower() if article.thematic_line else ""

    results = []
    for user in committee_users[:limit]:
        bio_text = f"{user.affiliation} {user.bio or ''}".lower()
        has_affinity = bool(thematic_name and thematic_name in bio_text)
        results.append(
            {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "affiliation": user.affiliation,
                "roles": ["COMITE"],
                "thematic_lines": [article.thematic_line.name] if has_affinity else [],
                "assigned_article_count": user.assigned_article_count,
                "has_thematic_affinity": has_affinity,
            }
        )

    # Ordenar priorizando afinidad temática y luego menor carga
    results.sort(key=lambda x: (not x["has_thematic_affinity"], x["assigned_article_count"]))
    return results
