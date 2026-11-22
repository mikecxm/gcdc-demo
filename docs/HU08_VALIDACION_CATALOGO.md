# HU08 Validación del catálogo y privacidad de artículos

**Resultado local: aprobado.** La suite de privacidad, filtros y rendimiento pasó
**6 pruebas** sobre PostgreSQL. El filtro combinado promedió **41,042 ms** y su
máximo fue **45,394 ms**, por debajo del SLA de 400 ms.

## En palabras sencillas

La QA comprueba que cada usuario vea únicamente lo que le corresponde:

- Un autor ve sus artículos, no los de otros autores.
- Comité y administración ven los artículos activos.
- Los artículos deshabilitados no aparecen en el catálogo ni en el detalle.
- Al combinar línea temática y estado, la API devuelve exactamente los artículos
  que cumplen ambos filtros.
- La consulta combinada responde dentro de 400 ms con 1.000 artículos activos.

No se modificaron modelos ni migraciones.

## Cómo se hizo

1. Se usó el PostgreSQL local configurado en `backend/.env`. Pytest-django creó
   `test_gcdc` para la ejecución y la eliminó al terminar. La base de trabajo
   `gcdc` no se usó para insertar los fixtures.
2. El fixture de `backend/apps/articles/test_article_filtering_and_privacy.py`
   crea cuatro usuarios temporales: `COMITE`, `ADMIN` y dos `AUTOR`.
3. Genera 1.000 artículos activos repartidos entre las cinco líneas temáticas y
   los estados `POSTULADO`, `EN_REVISION`, `ACEPTADO` y `RECHAZADO`. El autor 1
   tiene 25 artículos; el autor 2, 975.
4. También crea dos artículos deshabilitados. Uno conserva el estado `POSTULADO`
   para comprobar que la exclusión depende de `is_enabled`, no solo del estado.
5. Las solicitudes se hacen al endpoint Django real con `APIClient` y usuarios
   autenticados. No se simulan las respuestas de la API.
6. La prueba de rendimiento calienta el endpoint una vez y mide cinco solicitudes
   filtradas. La preparación de la base y ese calentamiento no se incluyen en las
   cinco mediciones.

## Casos y resultados

| Caso | Qué comprueba | Resultado |
| --- | --- | --- |
| Exclusión de deshabilitados | Los cuatro roles reciben HTTP 200 en el listado, sin artículos `is_enabled=False`; el detalle de uno deshabilitado responde 404. | **PASS** |
| Privacidad entre autores | El autor 1 ve exactamente sus 25 artículos; su propio detalle responde 200 y el de otro autor, 403. | **PASS** |
| Visibilidad editorial | Comité y administración reciben HTTP 200 y ven los 1.000 artículos activos. | **PASS** |
| Filtros combinados | `thematic_line` + `status` retorna HTTP 200 y sus IDs coinciden exactamente con la consulta esperada en la base. | **PASS** |
| Rendimiento | Cinco respuestas HTTP 200 para el filtro combinado; promedio **41,042 ms**, máximo **45,394 ms**. | **PASS** |

El máximo de las cinco mediciones es **menor que 400 ms**, por lo que cumple el
criterio de aceptación. Los tiempos observados en el equipo local fueron:
**45,394 / 41,828 / 39,312 / 40,401 / 38,277 ms**.

La medición usa `APIClient`: incluye el procesamiento de Django, permisos,
consultas PostgreSQL y serialización, pero no una conexión TCP, el navegador ni
la latencia de red. Es una medición del servidor para el endpoint filtrado, no
una prueba de carga concurrente.

## Integración frontend

`frontend/src/services/articlesApi.ts` consulta `GET /articles/` y envía
`thematic_line` y `status` como parámetros. `ArticleCatalogView.tsx` construye
esos filtros desde los controles del catálogo. Para el detalle,
`ArticleDetailModal.tsx` usa `GET /articles/{id}/`. La base configurada por
`VITE_API_URL` agrega el prefijo `/api/v1`.

Validaciones frontend:

- `npm run build`: compilación correcta. Vite mostró una advertencia de tamaño
  de chunk mayor a 500 kB, pero terminó exitosamente.
- `npm run test:articles`: **3 pruebas aprobadas**, 0 fallidas.

## Regresión backend

`python manage.py test apps.articles --verbosity 1` terminó con **59 pruebas
aprobadas y 1 omitida**. La suite nueva se ejecuta con Pytest por separado.

## Cómo repetir la suite

Con PostgreSQL iniciado, dependencias de `backend/requirements-qa.txt`
instaladas y las variables de `backend/.env` configuradas, desde `backend`:

```powershell
..\venv\Scripts\python.exe -m pytest -q -s apps\articles\test_article_filtering_and_privacy.py
```

`-s` permite ver en consola los cinco tiempos del benchmark. Pytest-django usa
una base temporal; los usuarios y artículos QA no quedan en `gcdc`.

Para repetir la regresión del módulo:

```powershell
..\venv\Scripts\python.exe manage.py test apps.articles --verbosity 1
```

Y desde `frontend`:

```powershell
npm run build
npm run test:articles
```

## Guion breve para exponer

> “Probé el catálogo con 1.000 artículos ficticios en PostgreSQL y dos usuarios
> autores. Verifiqué que no haya filtraciones entre autores, que Comité y
> Administración puedan consultar los artículos activos y que los deshabilitados
> queden ocultos. También comparé los resultados de dos filtros combinados con
> los datos esperados en la base. Las cinco consultas promediaron 41 ms y la más
> lenta tardó 45 ms, por debajo del límite de 400 ms. Todo se ejecutó en una base
> temporal, sin alterar los datos de trabajo.”

**Alcance:** los resultados corresponden a PostgreSQL local. No certifican
latencia concurrente ni el comportamiento de Supabase/Render.
