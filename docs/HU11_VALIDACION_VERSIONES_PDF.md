# HU-11 Validación de versionamiento e integridad de PDFs

**Resultado local: aprobado.** La suite enfocada de HU-11 pasó **11 pruebas** y
la suite de artículos pasó **88 pruebas, 1 omitida y 15 subtests**, usando el
motor PostgreSQL configurado para Django. Las llamadas a Supabase se aislaron
con un storage falso; no se hicieron llamadas de red a un bucket externo.

## En palabras sencillas

La QA verifica que el autor responsable pueda reemplazar el PDF mientras el
plazo esté vigente, que cada archivo quede registrado con un número de versión
correlativo y que se pueda volver a descargar sin alterar sus bytes. También
comprueba que archivos inválidos, demasiado grandes, subidos fuera de plazo o
por otro autor no se guarden.

## Contrato verificado

### Historial

```http
GET /api/v1/articles/{id}/versions/
```

Solo el autor responsable puede consultar el historial. Devuelve una lista
ordenada por `version_number`, con los campos:

```json
{
  "id": 12,
  "version_number": 2,
  "stage": "INICIAL",
  "uploaded_at": "2026-11-22T..."
}
```

### Reemplazo

```http
POST /api/v1/articles/{id}/versions/
Content-Type: multipart/form-data
```

El campo exacto del archivo es `pdf`. La respuesta exitosa es `201 Created` y
contiene `id`, `version_number`, `stage` y `uploaded_at`. El servidor genera la
ruta `articles/{id}/v{n}.pdf` y guarda la etapa `INICIAL`.

El archivo se valida con estos criterios:

- `Content-Type` del archivo debe ser `application/pdf`.
- El archivo no puede superar **10 MiB** (10 × 1024 × 1024 bytes).
- Los primeros cinco bytes deben ser `%PDF-`.

**Límite de la validación actual:** el backend no ejecuta un parser para
verificar toda la estructura interna del PDF. Por tanto, reconocer la firma
inicial no demuestra que todas las tablas, objetos y referencias del archivo
sean válidos.

### Fecha límite

La subida se controla con `Conference.submission_deadline`, comparada con la
fecha actual en la zona horaria `America/Bogota`. Una fecha pasada devuelve
`400 Bad Request` con el mensaje `El plazo para actualizar el PDF ya venció.`;
el propio día del plazo todavía se permite la subida.

Además, el artículo debe estar activo (`is_enabled=True`) y en estado
`POSTULADO`. Solo su autor responsable puede subirlo. Otro autor recibe `403`;
un artículo deshabilitado o en otro estado recibe `400`.

### Almacenamiento y descarga

En Supabase, el storage usa el bucket privado configurado por
`SUPABASE_BUCKET` (por defecto, `article-pdfs`), envía los bytes recibidos con
`content-type: application/pdf` y `upsert: false`. El fallback local persiste
los mismos bytes bajo `ARTICLE_PDF_ROOT`.

La API no publica una URL firmada. La descarga autenticada pasa por:

```http
GET /api/v1/articles/{id}/pdf/?version_number={n}
```

Sin `version_number`, se descarga la versión más reciente. La respuesta se sirve
como `application/pdf`, después de comprobar permisos.

## Cómo se hizo

1. Se confirmó que `settings.DATABASES['default']['ENGINE']` es
   `django.db.backends.postgresql`.
2. Pytest-django preparó una base de pruebas temporal; los fixtures no insertan
   datos en la base de trabajo.
3. Las solicitudes se hicieron con Django `APIClient` y JWT de una cuenta
   `AUTOR` responsable.
4. El test de Supabase reemplaza la instancia del cliente por un bucket falso
   en memoria. Comprueba nombre de bucket, ruta, opciones, MIME y bytes exactos
   sin depender de credenciales ni de red.
5. Se descargan versiones específicas y la más reciente. Los bytes descargados
   y su SHA-256 se comparan con el archivo original.
6. También se prueba el fallback local con una carpeta temporal.

## Casos y resultados

| Caso | Verificación | Resultado |
| --- | --- | --- |
| Versiones válidas | Dos subidas devuelven `201`, con números 1 y 2; el historial `GET` devuelve `200` ordenado. | **PASS** |
| Integridad Supabase simulado | Se verifican bucket, ruta `v1`/`v2`, MIME `application/pdf`, bytes y descarga de cada versión con SHA-256 idéntico. | **PASS** |
| Descarga actual | Sin número de versión, el endpoint devuelve la última versión con `200` y bytes íntegros. | **PASS** |
| MIME o firma inválidos | Cuatro variantes devuelven `400`; no se crea versión ni se invoca almacenamiento. | **PASS** |
| Tamaño mayor a 10 MiB | Devuelve `400`; no se crea versión ni se sube el archivo. | **PASS** |
| Fecha vencida y límite del plazo | Fecha pasada devuelve `400` sin guardar; el día límite devuelve `201`. | **PASS** |
| Otro autor | POST desde otra cuenta `AUTOR` recibe `403`; no hay cambios en storage. | **PASS** |
| Artículo deshabilitado | POST recibe `400`; no se crea versión ni se sube el archivo. | **PASS** |
| Fallback local | POST y descarga funcionan; los bytes y el hash se preservan. | **PASS** |

## Cómo repetir la suite

Con PostgreSQL iniciado, dependencias instaladas y las variables de entorno
necesarias para cargar settings configuradas, desde `backend`:

```powershell
..\venv\Scripts\python.exe -m pytest -q apps\articles\test_article_pdf_versioning.py
```

Salida observada:

```text
11 passed in 9.24s
```

Para repetir todas las pruebas de artículos:

```powershell
..\venv\Scripts\python.exe -m pytest -q apps\articles
```

Salida observada:

```text
88 passed, 1 skipped, 15 subtests passed in 97.43s
```

La ejecución completa también corre una prueba preexistente de rendimiento de
HU-07 y actualiza sus tiempos en `docs/hu07-pdf-integrity.json`; si se repite,
revisar/restaurar ese archivo antes de preparar otros cambios.

## Pasos para Postman

Usa una cuenta `AUTOR` responsable del artículo. Define:

```text
baseUrl = http://localhost:8000/api/v1
articleId = <ID del artículo activo en estado POSTULADO>
```

En todos los casos configura:

```http
Authorization: Bearer <JWT_TOKEN>
Accept: application/json
```

### Subida válida

1. Método: `POST`
2. URL: `{{baseUrl}}/articles/{{articleId}}/versions/`
3. Body → `form-data`: clave `pdf`, tipo **File**, selecciona un PDF real.
4. No escribas manualmente el encabezado `Content-Type`; Postman debe generar
   `multipart/form-data` y su `boundary`.
5. Esperado: `201 Created`, con `version_number` correlativo.
6. Repite la petición para comprobar el siguiente número.

Para revisar el historial:

```http
GET {{baseUrl}}/articles/{{articleId}}/versions/
```

Esperado: `200 OK`, versiones en orden ascendente.

Para descargar una versión concreta:

```http
GET {{baseUrl}}/articles/{{articleId}}/pdf/?version_number=1
```

Postman debe recibir `200 OK` y `Content-Type: application/pdf`.

### PDF corrupto o MIME inválido

1. Repite el `POST` con la clave `pdf` de tipo File y un archivo `.pdf` cuyos
   bytes no empiecen por `%PDF-`.
2. Esperado: `400 Bad Request`; no se crea una versión.
3. Para probar MIME, selecciona en Postman el tipo de contenido de la parte como
   `text/plain` y usa un archivo cuyo nombre termine en `.pdf`.
4. Esperado: `400 Bad Request` por MIME incorrecto.

### Archivo mayor a 10 MiB

Adjunta en `pdf` un PDF de más de 10 MiB. Se espera `400 Bad Request`, sin una
nueva entrada en el historial.

### Fecha fuera de plazo

Con acceso de administrador, establece `submission_deadline` de la conferencia
más reciente a una fecha pasada. Luego repite el POST válido con el token del
autor. Se espera `400 Bad Request` y el mensaje de plazo vencido. Restaura la
fecha original después de la prueba; preferiblemente haz este escenario en una
base de pruebas o entorno aislado.

### Control de acceso y estado

- Usa el token de otro autor: `POST` debe responder `403 Forbidden`.
- Deshabilita el artículo y usa el token del autor dueño: `POST` debe responder
  `400 Bad Request`.
- En ambos escenarios no debe aparecer una versión nueva.

## Guion breve para exponer

> “Probé el versionamiento de PDFs con PostgreSQL. El autor responsable puede
> subir versiones consecutivas mientras el plazo de postulación siga vigente.
> Para verificar integridad, el almacenamiento de Supabase se simuló en memoria:
> comparé los bytes y el SHA-256 del archivo original con las descargas de cada
> versión, sin depender de la red. También comprobé rechazo de MIME, firma y
> tamaño inválidos, fecha vencida, autor incorrecto y artículo deshabilitado.
> Las 11 pruebas específicas y la regresión de artículos pasaron. La validación
> actual comprueba MIME, tamaño y firma `%PDF-`, pero no parsea la estructura
> completa del PDF.”

**Alcance:** la integridad del proveedor Supabase se prueba mediante un fake
determinista; no es una prueba de conectividad ni disponibilidad del servicio
remoto. Las credenciales y el bucket reales no se usan en la suite.
