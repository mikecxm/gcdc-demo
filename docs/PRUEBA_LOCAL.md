# Prueba local de postulaciones

Requisitos: Python compatible con `backend/requirements.txt`, Node.js compatible con Vite 8
y PostgreSQL local. Cada integrante conserva su base de datos y sus credenciales.

Desde la raíz del repositorio:

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-qa.txt
backend/.venv/Scripts/python.exe setup_local_env.py
```

En macOS/Linux, usa `backend/.venv/bin/python` en lugar de `backend/.venv/Scripts/python.exe`.
Si ya tienes un entorno virtual, reutilízalo. El script crea los archivos ausentes y añade
variables faltantes; nunca reemplaza valores existentes. Solo se versionan las plantillas
`.env.example`, no los `.env` personales, archivos PDF ni bases de datos.

Revisa `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST` y `DB_PORT` en `backend/.env`.
Para PDF locales configura `ARTICLE_PDF_STORAGE_BACKEND=local`; si ya tienes `supabase`,
el script conserva esa elección. Las plantillas incluyen las claves **públicas de prueba**
de [Google reCAPTCHA v2](https://developers.google.com/recaptcha/docs/faq),
exclusivas para desarrollo. Si tienes claves propias, conserva el par correspondiente:
`RECAPTCHA_SECRET_KEY` en backend y `VITE_RECAPTCHA_SITE_KEY` en frontend. No combines
una clave de prueba con una clave propia. El backend necesita acceso HTTPS a Google.

Prepara el esquema y una conferencia vigente sin cuentas ni artículos de ejemplo:

```powershell
cd backend
.venv/Scripts/python.exe prepare_local_postgres.py
.venv/Scripts/python.exe manage.py migrate
.venv/Scripts/python.exe manage.py seed_local_demo --conference-only
.venv/Scripts/python.exe manage.py runserver 127.0.0.1:8000
```

`prepare_local_postgres.py` crea la base configurada solo si no existe. El comando de conferencia
actúa solo sobre una base local y configura la edición de pruebas con 30 días para postular.
Si tienes una edición posterior, el comando se detiene sin cambiarla: revisa esa edición.
No ejecutes `seed_local_demo` sin la opción si deseas mantener el catálogo vacío.

En otra terminal, desde `frontend`:

```powershell
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1
```

En macOS/Linux usa `npm`. Abre <http://127.0.0.1:5173/>, regístrate desde el login y entra
como autor. En **Artículos y Postulaciones → Postular artículo**, adjunta un PDF real
(máximo 10 MB). Al confirmar, **Subir otro artículo** limpia el formulario y **Volver a
Artículos** recarga el catálogo. En el detalle, el visor y las descargas obtienen el PDF
desde la API con autenticación. Todos los usuarios autenticados pueden consultar el directorio;
crear usuarios desde allí sigue reservado a administradores y comité.

Vite lee `frontend/.env.local` antes que `frontend/.env`. Reinicia los servicios al cambiar
variables. `VITE_API_URL` debe apuntar al backend, por defecto `http://127.0.0.1:8000/api/v1/`;
`VITE_USERS_LIST_PATH=users/` es la ruta del directorio. Los PDF locales se guardan en
`backend/media/article-pdfs/` y no se sincronizan entre integrantes.

## Validación

```powershell
# Desde backend (PostgreSQL local configurado; usa una base de pruebas aislada)
.venv/Scripts/python.exe manage.py check
.venv/Scripts/python.exe manage.py makemigrations --check --dry-run
.venv/Scripts/python.exe -m pytest -q

# Desde frontend
npm.cmd run build
npm.cmd run lint
npm.cmd run test:users
npm.cmd run test:articles
```
