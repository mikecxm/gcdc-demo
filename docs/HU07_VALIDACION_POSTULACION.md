# HU07 Pruebas de postulación y PDF

**Resultado local: aprobado.** 9 pruebas nuevas y 15 subcasos; regresión de
127 pruebas y 19 subcasos, todos aprobados. Postman/Newman: 5 comprobaciones aprobadas.

## Cómo se hizo

1. Se usó PostgreSQL con las credenciales existentes de `backend/.env`, sin modificarlas.
   Django creó y eliminó su base temporal de pruebas; no se insertaron datos QA en la base local de trabajo.
2. Pytest levantó un servidor HTTP real y envió multipart con JWT. Los PDF se guardaron
   en disco temporal y se descargaron por `GET /api/v1/articles/{id}/pdf/`.
3. Se compararon los bytes completos, el tamaño, MD5 y SHA-256: **4/4 PDF recuperados**.
   Tamaños: 1.024 bytes, 9.900.000 bytes, **9,9 MiB = 10.380.902 bytes** y 10 MiB exactos.
   La subida de 9,9 MiB tardó **63,88 ms** en la regresión local. Esta subtarea no define un SLA de subida.
4. Se controló el reloj, sin esperar a la medianoche: acepta `23:59:59` y
   `23:59:59.999999`; rechaza `00:00:00` y `00:00:01` del día siguiente en **America/Bogota**.
   También rechaza una carga que termina de recibirse después del cierre.
5. La colección Postman se ejecutó con Newman antes y después del cierre: POST 201
   y descarga 200 antes; POST 400 después. El SHA-256 descargado también se verificó en Pytest.

## Qué se corrigió y por qué

Faltaba una ruta de descarga protegida. Se añadió para el autor propietario,
ADMIN y COMITE; otros usuarios reciben 401/403 y los PDF ausentes, 404.
El almacenamiento local permite verificar archivos reales sin claves de Supabase;
**Supabase sigue siendo el valor predeterminado** de la aplicación.

Postman detectó que rechazar un multipart grande antes de leerlo podía dejar la
conexión esperando. Ahora se recibe el multipart, se comprueba el cierre y solo
entonces se validan y guardan los datos. Un rechazo no deja artículos, versiones,
coautores ni PDF persistidos. También se verificaron rollback y limpieza si falla la BD.

## Archivos y líneas

Rutas relativas a `gcdc-demo`, para la versión entregada:

| Archivo | Líneas | Cambio |
| --- | --- | --- |
| `backend/apps/articles/test_article_submission_deadlines.py` | 1–303 | Suite nueva: PDF válido de tamaño exacto, hashes, reloj, permisos, errores y Postman. |
| `backend/apps/articles/submission_views.py` | 46–49 y 64 | Lee el multipart antes del control temporal y reutiliza sus datos. |
| `backend/apps/articles/download_views.py` | 1–28 | Descarga autenticada de la última versión con `FileResponse`. |
| `backend/apps/articles/urls.py` | 5 y 24 | Registra la ruta `/articles/{id}/pdf/`. |
| `backend/apps/articles/storage.py` | 1–20 y 39–75 | Añade archivos locales, apertura del PDF y traducción de objeto ausente a 404; conserva el adaptador Supabase. |
| `backend/config/settings.py` | 52–54 | Selector de almacenamiento y carpeta privada de PDF. |
| `backend/qa/hu07-submission.postman_collection.json` | 1–44 | Colección importable: subida multipart y descarga con aserciones. |
| `backend/qa/package.json` y `package-lock.json` | 1–7 y 1–1804 | Fijan Newman 6.2.3 y sus dependencias solo para QA. |
| `.gitignore` | 21 | Evita versionar PDF locales de usuarios. `.env` ya estaba excluido. |

Tecnologías: **Python, Pytest/pytest-django, Django REST Framework, PostgreSQL,
Requests, hashlib y Postman/Newman**. Solo se simulan el reloj, fallos controlados
y el contrato del SDK de Supabase; las transferencias locales usan HTTP y archivos reales.

## Repetir y ver la evidencia

Desde `backend`, con PostgreSQL iniciado y `.env` configurado:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-qa.txt
npm.cmd ci --prefix qa
$env:QA_POSTMAN='1'
.\.venv\Scripts\python.exe -m pytest apps/articles/test_article_submission_deadlines.py -q --junitxml=../docs/hu07-submission-results.xml
```

Para repetir la regresión, sustituir la última línea por:

```powershell
.\.venv\Scripts\python.exe -m pytest apps/articles apps/conferences apps/reviews apps/users --ignore=apps/users/test_user_list_performance.py -q --junitxml=../docs/hu07-regression-results.xml
```

Se excluye la carga independiente de HU04 para no sobrescribir sus métricas.
La nueva suite activa almacenamiento temporal automáticamente; no cambia `.env`.

- [Integridad y tiempos](hu07-pdf-integrity.json): hashes originales y descargados de los cuatro PDF.
- [Límites temporales](hu07-deadline-results.json): hora de Bogotá/UTC y códigos esperados y obtenidos.
- [Postman](hu07-postman-results.json): tres solicitudes, cinco aserciones y cero fallos.
- [Suite específica](hu07-submission-results.xml) y [regresión](hu07-regression-results.xml): cero fallos y cero omisiones.

El XML incluye los subcasos: 24 casos específicos y 146 en la regresión.
**Alcance:** todos los criterios funcionales locales se cumplieron. Supabase/Render
requiere una prueba posterior con sus credenciales; aquí no se certifica almacenamiento remoto.
Newman es una herramienta de desarrollo: npm informó 19 alertas transitivas
(incluida una crítica); no se instala como dependencia del backend desplegado.

**Para sustentarlo:** “Subimos y recuperamos cuatro PDF idénticos, verificamos dos
hashes y probamos los segundos alrededor del cierre. Postman destapó una espera
en cargas vencidas; la corregimos leyendo el cuerpo antes de decidir. La suite
comprueba que los rechazos y errores no dejen datos ni archivos huérfanos”.
