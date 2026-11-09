from django.db import migrations

LINES = [
    "Sistemas Inteligentes",
    "Tecnologías en Informática",
    "Educación en Informática",
    "Sistemas de Software",
    "Software en la práctica",
]


def create_lines(apps, schema_editor):
    ThematicLine = apps.get_model("conferences", "ThematicLine")
    for name in LINES:
        ThematicLine.objects.get_or_create(name=name)


def remove_lines(apps, schema_editor):
    ThematicLine = apps.get_model("conferences", "ThematicLine")
    ThematicLine.objects.filter(name__in=LINES).delete()


class Migration(migrations.Migration):

    dependencies = [
        ("conferences", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(create_lines, remove_lines),
    ]