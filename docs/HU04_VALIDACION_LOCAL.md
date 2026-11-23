# HU04 Validación funcional y de rendimiento local

**Fecha: 21 de noviembre de 2026. Estado: criterios locales cumplidos.**
Con 1.000 usuarios en PostgreSQL, 50 GET sincronizados promediaron **259,34 ms**.
Chrome y Locust también aprobaron el promedio máximo de 400 ms. La suite completa
terminó con **49 pruebas y 12 subcasos aprobados**, sin fallos ni pruebas omitidas.

## Preparación de la base local

Se utilizaron el servidor PostgreSQL de la PC y las variables `DB_NAME`, `DB_USER`,
`DB_PASSWORD`, `DB_HOST` y `DB_PORT` de `backend/.env`. La base configurada `gcdc`
no existía; se creó y se ejecutaron todas las migraciones Django.
No se requirió conexión a la base original ni a Supabase.

El procedimiento queda reproducible en `backend/prepare_local_postgres.py:12–31`:
conecta a la base administrativa `postgres`, consulta `pg_database` y ejecuta
`CREATE DATABASE` solamente si falta la base configurada. Usa parámetros y
`sql.Identifier` para el nombre; conserva una base existente. El rol local necesita
permiso `CREATEDB`, también para las bases temporales de Django.

Desde `backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-qa.txt
.\.venv\Scripts\python.exe prepare_local_postgres.py
.\.venv\Scripts\python.exe manage.py migrate --noinput
```

Las pruebas crean `test_gcdc`, aplican las migraciones y cargan datos ficticios;
al finalizar eliminan esa base temporal. Los 1.000 usuarios QA no se insertan en
`gcdc`. Debe reservarse `test_gcdc` para este uso y dejar libre el puerto 8000.

## Tecnologías y ejecución

- **Pytest y pytest-django:** ejecutan las aserciones y aíslan PostgreSQL.
- **Requests, ThreadPoolExecutor y Barrier:** disparan 50 GET HTTP con JWT juntos.
- **Django runserver y WSGI con hilos:** sirven el endpoint real.
- **Psycopg 3 y psycopg-pool:** reutilizan conexiones a PostgreSQL.
- **Playwright y Chrome instalado:** controlan el frontend Vite y miden Axios.
- **Locust:** mantiene 50 usuarios activos durante 15 segundos y genera CSV/HTML.

En una terminal, desde `frontend`:

```powershell
Copy-Item .env.example .env.local
npm run dev -- --host 127.0.0.1
```

La configuración apunta a `http://127.0.0.1:8000/api/v1/` y `users/`.
En otra terminal, desde `backend`:

```powershell
$env:QA_BROWSER='1'
$env:QA_LOCUST='1'
.\.venv\Scripts\python.exe -m pytest apps/users -s -q --junitxml=../docs/hu04-users-regression-results.xml
```

La prueba de Chrome levanta `python manage.py runserver 127.0.0.1:8000 --noreload`
contra la base temporal, prepara una sesión ADMIN con JWT válido y abre
`http://127.0.0.1:5173/#usuarios`. Luego cierra Chrome y runserver automáticamente.
No hay respuestas HTTP simuladas. Requiere Chrome en su ruta estándar de Windows;
`QA_CHROME` permite indicar otro ejecutable. Sin `QA_BROWSER=1` esta comprobación
se omite; sin `QA_LOCUST=1` se omite la carga sostenida. La ejecución registrada
activó ambas variables.

## Qué verifica el script

El archivo principal es `backend/apps/users/test_user_list_performance.py`:

| Líneas | Comprobación |
| --- | --- |
| 25–37 | PostgreSQL obligatorio, IPv4 y capacidad HTTP compartida con runserver. |
| 39–55 | Un ADMIN y 999 autores; 125 afiliaciones especiales, 63 autores activos esperados. |
| 60–96 | Calentamiento, barrera de 50 hilos, GET con rol/afiliación/estado, media ≤400 ms, HTTP 200 y conteos. |
| 99–197 | Chrome sobre Vite, tres rondas de 50 GET Axios, filtros visibles y recorrido de las siete páginas. |
| 198–218 | Locust con 50 usuarios, conteo esperado, cero fallos y promedio ≤400 ms. |
| 223–239 | Sigue todos los enlaces DRF y compara cantidad, IDs únicos y conjunto exacto esperado. |
| 241–247 | Ocho búsquedas especiales con HTTP 200 y conteos conocidos de 125 o cero. |

El filtro combinado usa `role=AUTOR`, `is_active=true` y afiliación
`ñ & O'Hara + 100%_`. Se prueban comillas, ñ, ampersand, signo más, porcentaje,
guion bajo, un texto similar a inyección SQL y un emoji.

La barrera sincroniza 50 envíos cliente; el pool limita a 12 las conexiones SQL,
sin reducir las 50 peticiones HTTP. Chrome lanza 50 promesas juntas y puede limitar
las conexiones HTTP/1.1; por eso la ráfaga sincronizada se comprueba además con
Requests. Locust usa pausas de 0,1–0,3 s entre peticiones por usuario.

## Resultados y evidencia

| Requisito | Resultado final | Evidencia en esta carpeta |
| --- | --- | --- |
| 50 GET sincronizados; promedio ≤400 ms | **259,34 ms**, máximo 395,04 ms; 50 respuestas 200 | [hu04-http-results.json](hu04-http-results.json) |
| GET filtrado desde frontend real | Tres medias: **260,97 / 261,51 / 285,43 ms** | [hu04-browser-results.json](hu04-browser-results.json) |
| Carga sostenida con 50 usuarios | **2.270 GET**, media **121,86 ms**, cero fallos | [JSON final Locust](hu04-locust-results.json), [CSV](hu04-locust_stats.csv), [HTML](hu04-locust.html) |
| Cero discrepancias paginadas | **63 usuarios únicos, 7 páginas**, tanto API como interfaz | [XML completo](hu04-users-regression-results.xml), JSON de Chrome |
| Caracteres especiales sin HTTP 500 | **8 subcasos aprobados**, respuestas 200 y conteos exactos | XML completo, método `test_special_characters` |
| Vista conectada a datos reales | 1.000 usuarios, filtros visibles y 63 coincidencias | [hu04-browser.png](hu04-browser.png) |
| Regresión | **49 pruebas + 12 subcasos**, 10 pruebas frontend y build aprobado | XML completo; `npm run test:users` y `npm run build` |

El XML completo cuenta los subcasos como casos separados: muestra 61 casos,
mientras la consola Pytest muestra 49 pruebas y 12 subcasos. La última ejecución
específica de rendimiento pasó 4 pruebas y 8 subcasos y está en
[hu04-performance-results.xml](hu04-performance-results.xml). El JSON final de
Locust se escribe al salir; el CSV es un corte periódico y puede contener menos
peticiones que el total final.
El SLA solicitado se aplica al **promedio**, no al máximo individual.
Los GET medidos incluyen HTTP local, JWT, consultas y respuesta; Axios incluye
también lectura JSON y espera del navegador. Hay una petición de calentamiento
por escenario; no se mide arranque en frío.

La interfaz descarga el listado paginado y aplica sus filtros locales. La
prueba comprueba esos filtros y mide, por separado, GET filtrados contra la API.
Aplicar rol, estado y búsqueda hasta el siguiente pintado tomó **161,97 ms**,
incluido el control Playwright. La descarga inicial de todas las páginas y el
render completo de la aplicación no forman parte del SLA de un GET filtrado.

## Fallos detectados y correcciones

| Estado comprobado | Promedio de 50 GET | Corrección |
| --- | --- | --- |
| Inicial | 2.675,88 ms, falló | El cliente interno secuencial anterior no certificaba concurrencia. Se añadió HTTP real. |
| Destino HTTP `127.0.0.1` | 774,16 ms, falló | Evita el coste observado usando `localhost` en este Windows. |
| Cola HTTP de 128 en lugar de 10 | 564,08 ms, falló | Acepta la ráfaga sin una cola de escucha demasiado pequeña; se aplica a pruebas y runserver. |
| Pool PostgreSQL, primera comprobación | 292,55 ms, aprobó | Reutiliza entre 4 y 12 conexiones en lugar de abrir una nueva por cada petición. |
| Comprobación final | **259,34 ms, aprobó** | Confirma la solución junto con Chrome, Locust y las pruebas funcionales. |

Son mediciones sucesivas del mismo equipo, no una atribución experimental exacta
del coste de cada componente. No se aumentó el umbral ni se añadieron cachés de
respuestas. JWT, permisos, filtros y conteos siguen ejecutándose contra PostgreSQL.

También se sustituyó en `App.jsx` la tabla fija y sus números ficticios por
`UserListView` con `loadConfiguredUsers`. Se retiró el contador fijo 128 del menú.
La URL Axios elimina la barra final para evitar dobles barras en renovación JWT.

## Archivos y líneas exactas

Referencias a la versión entregada; los números cambian si se edita después.

| Archivo relativo a `gcdc-demo` | Líneas modificadas o añadidas | Motivo |
| --- | --- | --- |
| `backend/prepare_local_postgres.py` | 1–35 | Preparación local repetible. |
| `backend/config/settings.py` | 97–102 | `CONN_MAX_AGE=0`, pool mínimo 4, máximo 12, espera máxima 10 s. |
| `backend/config/servers.py` | 1–11 | Cola HTTP 128 compartida por servidor local y pruebas. |
| `backend/apps/users/management/commands/runserver.py` | 1–7 | Usa esa cola también con `python manage.py runserver`. |
| `backend/apps/users/management/__init__.py` y `backend/apps/users/management/commands/__init__.py` | Archivos vacíos nuevos | Permiten descubrir el comando Django. |
| `backend/apps/users/test_user_list_performance.py` | 1–247 | Suite principal; métodos detallados arriba. |
| `backend/locustfile.py` | 1–33 | Carga sostenida autenticada, conteos esperados y resumen final al salir. |
| `backend/requirements.txt` | 48–49 | Psycopg 3.3.9 y pool 3.3.3. Se conserva la codificación UTF-16 existente. |
| `backend/requirements-qa.txt` | 1–5 | Pytest 9.2.0, pytest-django 4.14.0, Locust 2.47.0, Playwright 1.65.2. |
| `backend/pytest.ini` | 1–3 | Selección de configuración y archivos Django. |
| `frontend/src/App.jsx` | 2–3 y 447–452 | Importa y monta el directorio conectado; reemplaza la tabla fija. El contador fijo se retiró junto al menú de la línea 341. |
| `frontend/src/services/api.ts` | 30 | IPv4 predeterminado y normalización de URL. |
| `frontend/.env.example` | 1–4 | URL local y ruta de listado confirmada. |
| `frontend/.env.local` | 1–2 | Configuración usada en esta PC; está ignorada por Git. |
| `frontend/qa-user-list-performance.js` | 1–19 | Auxiliar manual previo para DevTools; la evidencia principal es Playwright. |
| `frontend/USER_DIRECTORY_QA.md` | 1–27 | Actualiza integración y QA comprobada. |
| `docs/USER_LIST_API.md` | 33–55 y 74–119 | Registra PostgreSQL y reemplaza el pendiente por la validación final. |

## Sustentación breve

“Creamos y migramos PostgreSQL local. Pytest generó 1.000 usuarios y disparó
50 GET con JWT al mismo tiempo. Falló inicialmente; corregimos el destino IPv4,
la cola HTTP y la reutilización de conexiones PostgreSQL. El promedio final fue
259,34 ms. Chrome y Locust también pasaron. Comparamos todas las páginas con
los 63 usuarios esperados y probamos ocho búsquedas especiales sin errores.
Los JSON, XML, CSV y la captura guardan la evidencia.”

**Pendiente externo:** repetir contra Supabase cuando Miguel despliegue en Render.
La aprobación actual corresponde al entorno local acordado.
