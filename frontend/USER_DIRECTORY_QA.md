# GCDC-128 y HU-04 Directorio de usuarios

`App.jsx` renderiza `UserListView` con `loadConfiguredUsers`; reemplaza la tabla
fija anterior y utiliza `GET /api/v1/users/` con JWT. El adaptador recorre todas
las páginas DRF; la vista aplica búsqueda y filtros locales y pagina de 10 en 10.

Copiar `.env.example` a `.env.local` y reiniciar Vite. La configuración local es:

```env
VITE_API_URL=http://127.0.0.1:8000/api/v1/
VITE_USERS_LIST_PATH=users/
```

Verificación ejecutada: 10 pruebas de `npm run test:users`, `npm run build` y
Chrome automatizado con Playwright sobre Vite y Django runserver reales.
La QA de navegador comprueba filtros, 63 coincidencias y 7 páginas sin usuarios
duplicados ni omitidos. Captura: [hu04-browser.png](../docs/hu04-browser.png).

El SLA mide GET filtrados desde Axios; los filtros visibles de la vista se
aplican al listado descargado. Son dos comprobaciones diferentes.
La medición desde navegador incluye red local, JWT y lectura JSON; la duración
de aplicar filtros hasta pintar también se registra por separado.

Procedimiento completo, resultados y líneas modificadas:
[HU04_VALIDACION_LOCAL.md](../docs/HU04_VALIDACION_LOCAL.md).

La edición y el cambio de estado de usuarios pertenecen a las historias siguientes.
