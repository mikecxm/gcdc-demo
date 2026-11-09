from django.db import migrations

ROLES = ["ADMIN", "COMITE", "AUTOR"]


def create_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    for name in ROLES:
        Role.objects.get_or_create(name=name)


def remove_roles(apps, schema_editor):
    Role = apps.get_model("users", "Role")
    Role.objects.filter(name__in=ROLES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0002_role_userrole_and_more"),
    ]

    operations = [
        migrations.RunPython(create_roles, remove_roles),
    ]