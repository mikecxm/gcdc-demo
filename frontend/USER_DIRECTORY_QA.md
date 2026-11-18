# GCDC-128 / HU-04 — Directorio de usuarios

## Alcance entregado

- `src/components/users/UserListView.tsx`: vista, filtros combinados por rol/estado y búsqueda por nombre, correo o afiliación, paginación cliente de 10 registros, skeleton, error con reintento y cancelación al desmontar.
- `UserDirectoryView.tsx` conserva el export anterior como alias compatible.
- Tabla con desplazamiento interno en ambos ejes, cabeceras fijas y controles fuera del área desplazable.
- `services/usersApi.ts`: adaptador Axios con JWT y renovación del cliente existente. No se implementaron ni modificaron endpoints Django.
- La edición de perfiles y los cambios reales de estado conservan sus callbacks para las historias siguientes. No se envían mutaciones desde esta subtarea.

## Integración pendiente con el responsable del backend

En este checkout solo existen las rutas de creación `users/register/` y `users/create/`; no hay listado de usuarios. No se asume que `GET users/` exista.

Una vez confirmada la ruta, configurar `VITE_USERS_LIST_PATH` relativa a `VITE_API_URL`. Por ejemplo, **solo si el backend confirma esa ruta**:

```env
VITE_API_URL=http://localhost:8000/api/v1
VITE_USERS_LIST_PATH=users/
```

El adaptador acepta un arreglo completo o `{ "results": [...], "next": null | "URL" }`, recorre las páginas DRF antes de la paginación local y valida los campos del serializer: `id`, `full_name`, `email`, `affiliation`, `roles`, `is_active`, `created_at`. Los roles son `ADMIN`, `COMITE`, `AUTOR`. `bio` y `updated_at` son opcionales para la vista de perfil.

El responsable del backend debe confirmar ruta, permisos y formato. Si difieren, se adapta este servicio; no hace falta rediseñar la vista. No se sustituyen errores del servicio por datos ficticios.

`App.jsx` usa el cargador simulado únicamente en desarrollo y cuando `VITE_USERS_LIST_PATH` está vacío. Al configurar esa variable y reiniciar Vite, consume automáticamente el servicio real y exige sesión, también en desarrollo. En producción siempre usa `loadConfiguredUsers` y exige sesión. No incluir tokens en el código.

También se puede integrar la vista desde otro contenedor pasando `loadUsers(signal)`; debe devolver todos los usuarios como `Promise<UserResponse[]>`. `initialUsers` permite suministrar datos ya obtenidos y se sincroniza cuando cambian. Mantener estable la referencia del cargador evita solicitudes innecesarias.

## Verificación automatizada

```sh
npm run test:users
npm run build
```

Las pruebas no instalan dependencias nuevas: usan Node, Vite, React SSR y un adaptador Axios simulado. Cubren coincidencias conjuntas, varias páginas, búsqueda sin tildes, límites de paginación, skeleton inicial, render con datos, formatos de respuesta, cancelación y rechazo de enlaces de paginación inválidos. La prueba de rendimiento mide filtrado y paginación locales de 10.000 registros; **no mide actualización del DOM ni latencia real de API**.

## QA de navegador

El usuario confirmó que realizó la QA de la vista y sus interacciones y que todo funciona. No hay todavía una medición registrada contra el listado real de usuarios porque ese endpoint no existe en este checkout.

Esta sesión no dispone de un navegador automatizado. La compilación y React SSR no sustituyen estas comprobaciones:

1. Abrir `/#usuarios` con el servidor de desarrollo: aparecen los skeletons durante la carga simulada de 300 ms y luego 26 usuarios.
2. Seleccionar Comité científico y buscar `Universidad del Valle`: solo deben aparecer personas que cumplan ambas condiciones. Los datos de prueba producen más de una página.
3. Ir a la página siguiente: el rol y la búsqueda se mantienen, las filas cambian y el scroll interno vuelve al inicio. Modificar un filtro vuelve a la página 1.
4. Probar anchos de 1440, 1024, 768 y 375 px: el scroll horizontal pertenece a la tabla, no al documento. Filtros, cabeceras y paginación siguen accesibles; comprobar también zoom y orientación horizontal.
5. Con un cargador HTTP confirmado, comprobar carga, error y reintento, y navegar fuera durante una solicitud: no deben mostrarse resultados de una solicitud cancelada.
6. Medir con Performance de DevTools el tiempo entre recepción del listado completo y presentación de las filas filtradas. Debe ser inferior a 400 ms en el equipo de QA. Si DRF envía varias páginas, distinguir la descarga de todas ellas del tiempo de renderizado cliente.

La QA visual y de interacción fue confirmada por el usuario. La integración y medición con API real siguen pendientes del endpoint, no de las otras historias de edición o deshabilitación.
