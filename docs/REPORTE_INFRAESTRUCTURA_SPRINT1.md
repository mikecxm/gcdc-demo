# Reporte de Infraestructura, Regla de Oro y Modelado de Base de Datos - Sprint 1 (GCDC)

**Sistema de Gestión Científica de Conferencia (GCDC) — Universidad del Valle**  
**Rama de Trabajo:** `feature/sprint1-db-indexes-and-fields`  
**Fecha:** 10 de Noviembre de 2026  
**Autor:** Braulio Robledo — Scrum Master / Desarrollador Full-Stack  
**Objetivo Ejecutivo:** Consolidación de infraestructura base, aislamiento de entornos de desarrollo para evitar colisiones en Git y resolución integral de las 6 subtareas de base de datos asignadas al Sprint 1.

---

## 1. Cabecera y Metadatos de la Rama

| Atributo | Detalle |
| :--- | :--- |
| **Proyecto** | Gestión Científica de Conferencia (GCDC) |
| **Institución** | Universidad del Valle — Escuela de Ingeniería de Sistemas |
| **Rama Git** | `feature/sprint1-db-indexes-and-fields` |
| **Rama Destino (PR)** | `main` |
| **Stack Backend** | Django 5.1+, Django REST Framework, SimpleJWT, PostgreSQL 16 (Supabase) / SQLite 3 local |
| **Stack Frontend** | React 18+, TypeScript, Vite, Tailwind CSS, React Hook Form, Zod, Axios |
| **Commit Base de Aislamiento** | `5d0a453` (*chore(arch): apply Golden Rule isolation, untrack db.sqlite3 and pre-register API routes*) |
| **Cobertura de Pruebas** | 15 pruebas unitarias automatizadas ejecutadas y aprobadas (100% OK) |

---

## 2. Pilar 1: Implementación de la "Regla de Oro" (Aislamiento de Git y Entornos)

Durante el inicio del Sprint 1, con un equipo de 7 desarrolladores trabajando en ramas paralelas, se identificó un riesgo crítico de merge conflicts y corrupción del historial de versiones si se compartían artefactos binarios o puntos de entrada únicos. Para blindar el repositorio, se aplicó la **Regla de Oro**:

### 2.1. Desindexación y Blindaje de Base de Datos Local
1. **Desindexación de `backend/db.sqlite3`:** Se ejecutó `git rm --cached backend/db.sqlite3` para eliminar el archivo binario del seguimiento de Git sin borrarlo del entorno local de desarrollo.
2. **Blindaje en `.gitignore`:**
   ```gitignore
   # Ambientes locales y bases de datos binarias
   *.sqlite3
   backend/db.sqlite3
   .env
   backend/.env
   __pycache__/
   *.pyc
   node_modules/
   dist/
   ```
   Esto garantiza que las transacciones y pruebas locales de cada desarrollador permanezcan aisladas, evitando sobreescrituras destructivas entre máquinas.

### 2.2. Pre-enrutamiento Modular en `backend/config/urls.py`
Para evitar que los desarrolladores colisionen editando el archivo central de URLs cada vez que agregan un endpoint, se pre-registraron de forma declarativa las rutas de todos los dominios del sistema:

```python
urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/users/', include('apps.users.urls')),
    path('api/v1/conferences/', include('apps.conferences.urls')),
    path('api/v1/articles/', include('apps.articles.urls')),
    path('api/v1/reviews/', include('apps.reviews.urls')),
]
```
Cada aplicación (`apps/users/`, `apps/conferences/`, `apps/articles/`, `apps/reviews/`) mantiene su propio `urls.py` aislado. Si un submódulo no existe previamente, se crea un `urls.py` base con lista vacía `urlpatterns = []` para que Django compile sin advertencias.

### 2.3. Reorganización Modular en Frontend (React 18 + Vite)
En el frontend se adoptó la arquitectura por dominios:
- `src/components/users/` (gestión de usuarios y formularios RBAC).
- `src/components/articles/` (postulación y metadatos de artículos).
- `src/components/reviews/` (evaluación y dictámenes del comité).

Para mantener 100% de compatibilidad hacia atrás con los imports existentes de otros compañeros, se conservó `src/components/UserCreationForm.tsx` como un re-export ligero hacia el componente oficial:
```typescript
export { default } from './users/UserCreationForm';
export * from './users/UserCreationForm';
```

---

## 3. Pilar 2: Consolidación de las 6 Subtareas de Base de Datos (PostgreSQL / Django ORM)

Se implementaron y validaron las 6 especificaciones técnicas de bases de datos requeridas en el Sprint 1:

### Subtarea 1: GCDC-134 (HU-05) — Campos de Perfil y Auditoría de Usuario
- **Modelo:** `CustomUser` (`backend/apps/users/models.py`)
- **Objetivo:** Ampliar la tabla de usuarios con afiliación institucional, biografía académica y timestamp de actualización automática.
- **Implementación:**
  ```python
  affiliation = models.CharField(_("afiliación institucional"), max_length=255, blank=True, default="")
  bio = models.TextField(_("biografía académica"), null=True, blank=True)
  updated_at = models.DateTimeField(_("fecha de actualización"), auto_now=True)
  ```

### Subtarea 2: GCDC-138 (HU-06) — Soft-Delete y Managers de Auditoría
- **Modelo:** `CustomUser` (`backend/apps/users/models.py`)
- **Objetivo:** Garantizar baja lógica de usuarios sin pérdida de integridad referencial histórica.
- **Implementación:**
  ```python
  deleted_at = models.DateTimeField(_("fecha de eliminación"), null=True, blank=True)

  def soft_delete(self):
      self.is_active = False
      self.deleted_at = timezone.now()
      self.save(update_fields=["is_active", "deleted_at", "updated_at"])
  ```
  Gestores configurados para no romper el backend de autenticación de Django:
  - `objects = ActiveUserManager()` (excluye usuarios con `deleted_at__isnull=False` en consultas de negocio).
  - `all_objects = CustomUserManager()` (acceso completo para auditoría y superusuarios).

### Subtarea 3: GCDC-130 (HU-04) — Índices B-Tree para Búsqueda Rápida
- **Modelos:** `CustomUser` y `UserRole` (`backend/apps/users/models.py`)
- **Objetivo:** Acelerar cláusulas WHERE y ORDER BY en la tabla de usuarios y sus roles asociados.
- **Implementación en `CustomUser.Meta`:**
  ```python
  indexes = [
      models.Index(fields=["email"], name="idx_user_email"),
      models.Index(fields=["affiliation"], name="idx_user_affiliation"),
      models.Index(fields=["is_active", "email"], name="idx_user_active_email"),
  ]
  ```
- **Implementación en `UserRole.Meta`:**
  ```python
  indexes = [
      models.Index(fields=["role", "user"], name="idx_user_role_user_role"),
  ]
  ```

### Subtarea 4: GCDC-154 (HU-10) — Campos de Deshabilitación de Artículo
- **Modelo:** `Article` (`backend/apps/conferences/models.py`)
- **Objetivo:** Permitir deshabilitar un artículo registrando el motivo y fecha, sin eliminar su historial de postulación.
- **Implementación:**
  ```python
  class ArticleStatus(models.TextChoices):
      ...
      DESHABILITADO = "DESHABILITADO", _("Deshabilitado")

  is_enabled = models.BooleanField(_("habilitado"), default=True, db_index=True)
  disabled_reason = models.TextField(_("motivo de deshabilitación"), null=True, blank=True)
  disabled_at = models.DateTimeField(_("fecha de deshabilitación"), null=True, blank=True)
  is_permanently_disabled = models.BooleanField(_("deshabilitado de forma irreversible"), default=False)
  ```

### Subtarea 5: GCDC-146 (HU-08) — Índices Compuestos B-Tree en Artículos
- **Modelo:** `Article` (`backend/apps/conferences/models.py`)
- **Objetivo:** Optimizar las búsquedas del catálogo general del comité y la vista privada de autor.
- **Implementación en `Article.Meta`:**
  ```python
  indexes = [
      models.Index(fields=["status"], name="articulo_status_idx"),
      models.Index(
          fields=["is_enabled", "thematic_line", "status"],
          name="idx_art_enabled_topic_status",
      ),
      models.Index(
          fields=["responsible_author", "is_enabled"],
          name="idx_art_author_enabled",
      ),
  ]
  ```

### Subtarea 6: GCDC-150 (HU-09) — Auditoría Histórica de Metadatos de Artículo
- **Modelo:** `ArticleMetadataAudit` (`backend/apps/conferences/models.py`)
- **Objetivo:** Auditar automáticamente cualquier cambio realizado en los metadatos (`title`, `abstract`).
- **Implementación:**
  ```python
  class ArticleMetadataAudit(models.Model):
      article = models.ForeignKey(Article, on_delete=models.CASCADE, related_name="metadata_audits")
      field_name = models.CharField(max_length=50)
      old_value = models.TextField(null=True, blank=True)
      new_value = models.TextField(null=True, blank=True)
      modified_at = models.DateTimeField(auto_now_add=True, db_index=True)

      class Meta:
          db_table = "auditoria_metadatos_articulo"
          ordering = ["-modified_at"]
  ```
  **Trigger / Señal automática:**
  ```python
  @receiver(pre_save, sender=Article)
  def audit_article_metadata(sender, instance, **kwargs):
      if instance.pk:
          try:
              old = Article.objects.only("title", "abstract").get(pk=instance.pk)
          except Article.DoesNotExist:
              return
          for field_name in ("title", "abstract"):
              old_val = getattr(old, field_name, None)
              new_val = getattr(instance, field_name, None)
              if old_val != new_val:
                  ArticleMetadataAudit.objects.create(
                      article=instance,
                      field_name=field_name,
                      old_value=old_val,
                      new_value=new_val,
                  )
  ```

---

## 4. Pilar 3: Control de Migraciones y Prevención de Inconsistencias

### 4.1. Migraciones Generadas y Aplicadas
Se crearon 6 archivos de migración estructurados linealmente:

1. **`users/migrations/0005_customuser_bio_alter_customuser_affiliation.py`**: Adición de campos `bio` y `updated_at`, flexibilización de `affiliation`.
2. **`users/migrations/0006_alter_customuser_managers.py`**: Configuración de `ActiveUserManager` como manager predeterminado en `CustomUser`.
3. **`users/migrations/0007_remove_customuser_custom_user_active_idx_and_more.py`**: Creación de índices B-Tree (`idx_user_email`, `idx_user_affiliation`, `idx_user_active_email`, `idx_user_role_user_role`).
4. **`conferences/migrations/0005_article_disabled_at_article_disabled_reason_and_more.py`**: Atributos `is_enabled`, `disabled_reason`, `disabled_at`, `is_permanently_disabled` y estado `DESHABILITADO`.
5. **`conferences/migrations/0006_article_idx_art_enabled_topic_status_and_more.py`**: Índices compuestos `idx_art_enabled_topic_status` e `idx_art_author_enabled`.
6. **`conferences/migrations/0007_articlemetadataaudit.py`**: Creación de la tabla `auditoria_metadatos_articulo` vinculada a `Article`.

### 4.2. Prevención de `InconsistentMigrationHistory`
- **Árbol Lineal:** Cada migración depende explícitamente de la anterior en su respectiva aplicación, evitando bifurcaciones no deseadas en el grafo de migraciones.
- **Sincronización:** Al no trackear `db.sqlite3` en Git, cada desarrollador ejecuta `python manage.py migrate` sobre su esquema limpio sin choques de llaves foráneas o IDs de migración duplicados.

---

## 5. Pilar 4: Resultados de Pruebas Unitarias y Estado Final

### 5.1. Ejecución de Pruebas Automatizadas
Se ejecutó la suite de pruebas unitarias sobre ambas aplicaciones:
```bash
python backend/manage.py test apps.users apps.conferences
```

**Resultado:**
```text
Creating test database for alias 'default'...
...............
----------------------------------------------------------------------
Ran 15 tests in 58.265s

OK
Destroying test database for alias 'default'...
Found 15 test(s).
System check identified no issues (0 silenced).
```
- **Total de pruebas ejecutadas:** 15 pruebas.
- **Aprobadas:** 15 (100% OK).
- **Fallos / Errores:** 0.

### 5.2. Estado del Árbol de Git
```text
On branch feature/sprint1-db-indexes-and-fields
Changes to be committed / not staged:
  modified:   backend/apps/conferences/admin.py
  modified:   backend/apps/conferences/models.py
  modified:   backend/apps/conferences/tests.py
  modified:   backend/apps/users/models.py
  modified:   backend/apps/users/serializers.py
  modified:   backend/apps/users/tests.py
Untracked files (migraciones):
  backend/apps/conferences/migrations/0005_*.py
  backend/apps/conferences/migrations/0006_*.py
  backend/apps/conferences/migrations/0007_*.py
  backend/apps/users/migrations/0005_*.py
  backend/apps/users/migrations/0006_*.py
  backend/apps/users/migrations/0007_*.py
```

---

## 6. Conclusión y Recomendación de Despliegue
La rama `feature/sprint1-db-indexes-and-fields` se encuentra totalmente validada, sin errores de linting ni de base de datos.
- Todos los modelos responden al esquema PostgreSQL de producción en Supabase y al SQLite local.
- Se recomienda proceder con el Pull Request hacia `main` e instruir al resto del equipo a ejecutar `python backend/manage.py migrate` al actualizar su rama local.
