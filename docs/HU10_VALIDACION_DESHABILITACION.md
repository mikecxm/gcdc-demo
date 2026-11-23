# HU-10 Validación de deshabilitación lógica de artículos

**Resultado local: aprobado.** La suite focalizada pasó **10 pruebas en 14,14 s**
con el motor PostgreSQL configurado para Django.

## En palabras sencillas

La deshabilitación lógica oculta un artículo sin borrarlo de la base de datos.
La QA verifica que:

- Solo `COMITE` y `ADMIN` puedan deshabilitarlo; `AUTOR` recibe una respuesta
  `403 Forbidden`.
- Se exija un motivo y que un artículo ya deshabilitado no se pueda deshabilitar
  otra vez.
- La operación guarde el motivo, la fecha, el estado, el usuario que la realizó
  y un registro de auditoría.
- Después de deshabilitarlo, el artículo no aparezca en las consultas de
  artículos ni pueda consultarse en detalle.
- Los endpoints disponibles de sugerencias y asignación de evaluadores tampoco
  acepten el artículo deshabilitado.

## Cómo se hizo

1. Se ejecutó la prueba Django con `pytest` y `pytest-django`, usando
   `@pytest.mark.django_db`. Django tiene configurado
   `django.db.backends.postgresql`; la suite usa la base de pruebas de Django.
2. El fixture crea un autor, un usuario `COMITE`, un usuario `ADMIN`, una línea
   temática y un artículo para cada caso.
3. Las solicitudes se hacen con `APIClient` contra las vistas reales. La
   autenticación usa JWT con el encabezado
   `Authorization: Bearer <token>`.
4. Se comprueba tanto la respuesta HTTP como el estado del artículo y los
   registros `ArticleMetadataAudit` guardados en la base.

## Casos y resultados

| Caso | Qué comprueba | Resultado |
| --- | --- | --- |
| Permisos | `AUTOR` intenta deshabilitar y recibe `403`; el artículo permanece activo y no se genera auditoría. | **PASS** |
| Deshabilitación por `COMITE` y `ADMIN` | Ambos reciben `200`; el artículo queda inactivo, con estado `DESHABILITADO`, motivo y fecha. | **PASS** |
| Auditoría | Se registran los cambios de `is_enabled`, `status`, `disabled_reason`, `disabled_at` y `disabled_by`. | **PASS** |
| Motivo obligatorio | Motivo ausente, vacío o compuesto solo por espacios recibe `400`; el artículo no cambia. | **PASS** |
| Repetición | Deshabilitar un artículo ya deshabilitado recibe `400` y no crea otra auditoría. | **PASS** |
| Visibilidad del autor | El listado responde `200` sin el artículo y el detalle responde `404`. | **PASS** |
| Consultas de `COMITE` y `ADMIN` | El listado responde `200` sin el artículo; detalle, sugerencias de evaluadores y asignación responden `404`. | **PASS** |

Los 10 resultados incluyen casos parametrizados para ambos roles editoriales y
para las variantes de motivo inválido.

## Contrato de la petición para Postman

**Deshabilitar un artículo**

```http
POST http://localhost:8000/api/v1/articles/{id}/disable/
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

```json
{
  "reason": "Motivo de deshabilitación"
}
```

Respuestas esperadas:

- `200 OK`: el usuario tiene rol `COMITE` o `ADMIN` y el artículo estaba activo.
- `400 Bad Request`: el motivo falta/está vacío o el artículo ya estaba
  deshabilitado.
- `403 Forbidden`: el usuario tiene rol `AUTOR`.

La respuesta `200` incluye `id`, `status`, `is_enabled`, `disabled_reason` y
`disabled_at`.

## Endpoints de consulta después de deshabilitar

| Método y ruta | Resultado esperado |
| --- | --- |
| `GET /api/v1/articles/` | `200 OK`; el ID del artículo no aparece. |
| `GET /api/v1/articles/{id}/` | `404 Not Found`. |
| `GET /api/v1/reviews/suggest-reviewers/?article_id={id}` | `404 Not Found`. |
| `POST /api/v1/reviews/assign-reviewers/` con `article_id` deshabilitado | `404 Not Found`. |

**Alcance:** la suite cubre las consultas de artículos y los endpoints de
evaluadores indicados. No cubre un endpoint de agenda.

## Cómo repetir la suite

Con PostgreSQL y el entorno virtual del proyecto disponibles, desde `backend`:

```powershell
..\venv\Scripts\python.exe -m pytest -q apps\articles\test_article_disable_workflow.py
```

La salida aprobada fue:

```text
10 passed in 14.14s
```

Esta ejecución corresponde a la suite focalizada de HU-10; no representa por sí
sola la ejecución de toda la suite del backend.

## Guion breve para exponer

> “Probé la deshabilitación lógica con tres roles: autor, comité y
> administrador. El autor no puede deshabilitar artículos; comité y
> administración sí, siempre que indiquen un motivo. También comprobé que la
> operación guarda la fecha y quién la realizó en la auditoría. Después de la
> baja, el artículo deja de aparecer en el listado y no se puede abrir ni usar
> en los endpoints de evaluadores. Las 10 pruebas focalizadas pasaron usando
> PostgreSQL.”
