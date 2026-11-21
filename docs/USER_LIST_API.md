# Listado de usuarios

`GET /api/v1/users/` requiere autenticacion y rol ADMIN o COMITE.

Parametros opcionales, combinados con AND:

| Parametro | Valores / comportamiento |
| --- | --- |
| `role` | `ADMIN`, `COMITE`, `AUTOR`; un valor desconocido devuelve 400 |
| `affiliation` | Coincidencia parcial sin distinguir mayusculas |
| `is_active` | `true` o `false` |
| `page` | Numero de pagina, empezando por 1; pagina inexistente devuelve 404 |

Ejemplo: `/api/v1/users/?role=AUTOR&affiliation=Univalle&is_active=true`

La respuesta contiene `count`, `next`, `previous` y `results`. Cada pagina
devuelve hasta 10 usuarios, ordenados por ID. Los enlaces conservan los filtros.
Un listado vacio devuelve 200 con `count: 0` y `results: []`.

Cada usuario contiene exclusivamente `id`, `email`, `full_name`, `affiliation`,
`roles`, `is_active` y `created_at`. Se excluyen usuarios eliminados logicamente;
los usuarios inactivos siguen disponibles para el filtro administrativo.

## Verificacion

Desde `backend`, ejecutar `python manage.py test apps.users`.
La suite incluye un catalogo de 1.000 usuarios y verifica filtros simultaneos,
paginacion, permisos, campos expuestos y un presupuesto de cuatro consultas
para peticiones autenticadas como ADMIN sin incluir el coste de autenticar JWT.
Se verifica una duracion maxima local de 400 ms despues de una peticion de
calentamiento, tanto para el listado como para filtros combinados.

Validacion PostgreSQL local (2026-11-21): las siete pruebas del listado
aprobaron usando las credenciales de `backend/.env` y una base temporal
`test_gcdc`, creada y eliminada por Django. Se aplicaron todas las migraciones.
La base original del proyecto no es necesaria para esta validacion.
La suite completa `python manage.py test apps.users --noinput` tambien
aprobo: 45 pruebas sobre PostgreSQL local.

Con 1.000 usuarios, autenticacion JWT y 20 peticiones por escenario despues
del calentamiento, se obtuvieron los siguientes tiempos:

| Escenario | Media | Maximo | Criterio |
| --- | --- | --- | --- |
| Listado sin filtros | 5,0 ms | 5,4 ms | <= 400 ms: aprobado |
| Rol AUTOR y afiliacion Univalle | 8,7 ms | 11,8 ms | <= 400 ms: aprobado |

Tambien aprobaron filtros combinados, paginacion, permisos, campos seguros,
exclusion de eliminados logicamente y el presupuesto de cuatro consultas
con autenticacion forzada. Queda completada la verificacion de latencia del
endpoint en peticiones secuenciales. Esto NO completa el criterio de HU-04
de 50 peticiones simultaneas; ver la evidencia siguiente.

La medicion local usa el cliente de pruebas con autenticacion forzada; no mide
red, servidor HTTP, validacion JWT ni carga concurrente.

### Verificacion automatica en PostgreSQL

Configurar `backend/.env` con las credenciales PostgreSQL y ejecutar desde `backend`:

```powershell
.\.venv\Scripts\python.exe verify_users_postgres.py
```

El script exige PostgreSQL y ejecuta siete pruebas en una base temporal
`test_<DB_NAME>`. El usuario PostgreSQL necesita permiso CREATEDB. Django crea
y elimina esa base de prueba; las tablas de la aplicacion no se modifican.
Usar un nombre de base reservado para QA, sin una base `test_<DB_NAME>` existente.

La prueba JWT adicional mide 20 peticiones por escenario con 1.000 usuarios,
incluye validacion JWT, imprime media y maximo en milisegundos y falla si alguna
supera 400 ms. Usa el cliente Django y no incluye transporte HTTP ni concurrencia.

### HU-04: concurrencia HTTP real (2026-11-21)

Resultado final: **SLA local aprobado**, despues de corregir la resolucion
del destino HTTP, la cola TCP y la reutilizacion de conexiones PostgreSQL.
La medicion inicial (2675,88 ms de promedio) queda como antecedente del fallo.
Los resultados actuales, comandos y lineas exactas estan en
[HU04_VALIDACION_LOCAL.md](HU04_VALIDACION_LOCAL.md).

`backend/apps/users/test_user_list_performance.py` crea 1.000 usuarios
en PostgreSQL temporal y sirve HTTP con LiveServerTestCase (servidor WSGI
con hilos de Django, puerto temporal; no usa el cliente interno de pruebas).
Una barrera libera 50 hilos juntos, cada uno hace un GET filtrado con JWT.
Se mide desde antes de enviar hasta recibir la respuesta completa, incluyendo
conexion y esperas del servidor. Se exige media <= 400 ms sin relajar el umbral.
La barrera sincroniza el envio cliente; no garantiza ejecucion simultanea en SQL.

Se verificaron 63 IDs esperados en 7 paginas, sin duplicados ni omisiones.
Ocho busquedas con caracteres especiales respondieron 200 y conteos correctos.
La base temporal se elimina al terminar. Estos resultados describen el servidor
local de pruebas, no Render ni Supabase.

Repetir desde `backend`:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements-qa.txt
.\.venv\Scripts\python.exe -m pytest apps/users/test_user_list_performance.py -s -q --junitxml=../docs/hu04-performance-results.xml
```

`requirements-qa.txt` fija Pytest, pytest-django y Locust; `pytest.ini` configura
Django. `locustfile.py` permite carga sostenida adicional con `QA_TOKEN` en el
entorno y `locust --host http://127.0.0.1:8000 -u 50 -r 50 --headless -t 30s`.
Ese escenario Locust es adicional; la rafaga sincronizada certificada la ejecuta Pytest.

Para medir desde el frontend, arrancar `python manage.py runserver 127.0.0.1:8000`
y `npm run dev` desde sus carpetas respectivas. `.env.local` apunta a
`http://127.0.0.1:8000/api/v1/` y configura `users/`.
Abrir `http://127.0.0.1:5173`, iniciar sesion como ADMIN o COMITE y ejecutar
`frontend/qa-user-list-performance.js` en DevTools. Usa el JWT almacenado,
lanza 50 fetch y muestra media/maximo; incluye descarga y JSON, excluye render DOM.
La medicion desde Chrome ya fue ejecutada automaticamente con Playwright,
la aplicacion Vite, Axios y runserver contra PostgreSQL temporal. La base
local configurada no existia: se creo y se aplicaron las migraciones para
permitir levantar el backend. `prepare_local_postgres.py` permite repetir
esa preparacion sin modificar una base existente.

Pendiente externo: validar Supabase cuando Miguel despliegue Render.
