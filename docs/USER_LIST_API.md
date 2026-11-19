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

Validacion local: 44 pruebas de usuarios aprobadas con SQLite. El criterio de
latencia en PostgreSQL queda pendiente de ejecutar en el entorno objetivo con
las variables `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT`.
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
