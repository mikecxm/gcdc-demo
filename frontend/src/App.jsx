import { useState, useEffect } from 'react';
import { UserListView } from './components/users/UserListView';
import { loadConfiguredUsers } from './services/usersApi';
import { UserCreationForm } from './components/users/UserCreationForm';
import { ArticleCatalogView } from './views/ArticleCatalogView';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/SessionContext';

const LIBRARY_BG_URL =
  'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=1600&auto=format&fit=crop';

function App() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const user = session ? { full_name: session.fullName } : null;
  const role = session?.activeRole;

  // Estados de navegación y vistas
  const [currentView, setCurrentView] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (hash === '#registro' || hash === '#public') return 'public';
    if (hash === '#articulos' || path.includes('/articles') || path.includes('/catalogo')) {
      return 'workspace';
    }
    if (hash === '#usuarios' || path.includes('/usuarios') || path.includes('/users')) {
      return 'workspace';
    }
    return 'workspace'; // Por defecto iniciamos en el Workspace para visualizar de inmediato el Catálogo
  });

  const [workspaceTab, setWorkspaceTab] = useState(() => {
    const hash = window.location.hash.toLowerCase();
    const path = window.location.pathname.toLowerCase();
    if (hash === '#usuarios' || path.includes('/usuarios') || path.includes('/users')) {
      return 'usuarios';
    }
    return 'articulos'; // Pestaña de artículos por defecto
  });

  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [lastCreatedUser, setLastCreatedUser] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Sincronización con eventos de historial y hash de navegación
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.toLowerCase();
      if (hash === '#articulos' || hash === '#catalogo') {
        setCurrentView('workspace');
        setWorkspaceTab('articulos');
      } else if (hash === '#usuarios') {
        setCurrentView('workspace');
        setWorkspaceTab('usuarios');
      } else if (hash === '#registro' || hash === '#public') {
        setCurrentView('public');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigateTo = (view, tab) => {
    setCurrentView(view);
    setIsMobileMenuOpen(false);
    if (tab) {
      setWorkspaceTab(tab);
      window.location.hash = `#${tab}`;
    } else if (view === 'public') {
      window.location.hash = '#registro';
    }
  };

  const userInitials = user?.full_name
    ? user.full_name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'SY';

  const roleLabel =
    role === 'ADMIN'
      ? 'Administrador'
      : role === 'COMITE'
      ? 'Comité Científico'
      : role === 'AUTOR'
        ? 'Autor'
        : 'Invitado';

  if (currentView === 'workspace' && !session?.activeRole) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* ========================================================
          1. VISTA PÚBLICA (SPLIT SCREEN: ARQUITECTURA + PORTAL)
         ======================================================== */}
      {currentView === 'public' && (
        <div className="min-h-screen flex w-full">
          {/* Lado izquierdo: Fotografía arquitectónica con branding Symposia (visible en lg: >=1024px) */}
          <div className="hidden lg:relative lg:flex lg:w-1/2 xl:w-5/12 bg-slate-900 overflow-hidden">
            <img
              src={LIBRARY_BG_URL}
              alt="Symposia Biblioteca Conferencia"
              className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-950/80" />

            <div className="relative z-10 p-10 flex flex-col justify-between h-full w-full">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <div>
                  <span className="text-xl font-bold tracking-tight text-white block leading-none">
                    symposia
                  </span>
                  <span className="text-[9px] font-semibold tracking-widest text-slate-300 uppercase block mt-1">
                    GESTOR DE CONFERENCIAS
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-w-sm">
                <h3 className="text-2xl font-bold text-white tracking-tight">
                  Gestión Científica de Conferencias
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Sistema oficial para la postulación, revisión por pares y edición académica de la Universidad del Valle.
                </p>
              </div>

              <div className="text-xs text-slate-400">
                Universidad del Valle · 2026
              </div>
            </div>
          </div>

          {/* Lado derecho: Portal y Formulario flotante */}
          <div className="w-full lg:w-1/2 xl:w-7/12 flex flex-col justify-between min-h-screen p-4 sm:p-8 lg:p-12 bg-slate-50 overflow-y-auto">
            {/* Header del portal */}
            <header className="flex items-center justify-between w-full max-w-lg mx-auto pb-6 gap-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2" />
                  </svg>
                </div>
                <span className="font-bold text-slate-900 text-sm">symposia</span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    session?.activeRole
                      ? navigateTo('workspace', 'articulos')
                      : navigate('/login')
                  }
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  {session?.activeRole ? 'Ver Catálogo →' : 'Iniciar sesión →'}
                </button>
              </div>
            </header>

            {/* Contenedor central con UserCreationForm en modo público */}
            <main className="my-auto py-4">
              <UserCreationForm
                mode="public"
                onSuccess={(newUser) => setLastCreatedUser(newUser)}
              />

              {lastCreatedUser && (
                <div className="max-w-lg mx-auto mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-left text-xs text-emerald-800">
                  <span className="font-semibold block mb-1">
                    Usuario registrado en la base de datos (Respuesta HTTP 201):
                  </span>
                  <pre className="bg-white/80 p-2 rounded text-[11px] overflow-x-auto">
                    {JSON.stringify(lastCreatedUser, null, 2)}
                  </pre>
                </div>
              )}
            </main>

            {/* Footer */}
            <footer className="w-full max-w-lg mx-auto pt-6 text-center text-xs text-slate-400">
              © 2026 Symposia. Todos los derechos reservados.
            </footer>
          </div>
        </div>
      )}

      {/* ========================================================
          2. ESPACIO DE TRABAJO (DASHBOARD SYMPOSIA + SIDEBAR)
         ======================================================== */}
      {currentView === 'workspace' && (
        <div className="min-h-screen flex bg-slate-50 relative">
          {/* Overlay de menú móvil */}
          {isMobileMenuOpen && (
            <div
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm md:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />
          )}

          {/* Sidebar Symposia (Desktop fijo, móvil deslizable) */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 p-5 flex flex-col justify-between transition-transform duration-200 md:static md:translate-x-0 ${
              isMobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
            }`}
          >
            <div className="space-y-6">
              {/* Brand */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <span className="text-lg font-bold tracking-tight text-slate-900">symposia</span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 md:hidden"
                  aria-label="Cerrar menú móvil"
                >
                  ✕
                </button>
              </div>

              {/* Selector de Conferencia */}
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/70 flex items-center justify-between text-left">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 font-bold text-[10px] flex items-center justify-center">
                    S26
                  </span>
                  <div>
                    <span className="text-xs font-semibold text-slate-800 block leading-tight">
                      Symposia 2026
                    </span>
                    <span className="text-[10px] text-slate-400 block">Universidad del Valle</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>

              {/* Menú de navegación */}
              <nav className="space-y-1 text-xs text-left">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-2">
                  Espacio de Trabajo
                </span>

                {/* Ítem: Catálogo de Artículos (HU-08 / GCDC-144) */}
                <button
                  type="button"
                  onClick={() => navigateTo('workspace', 'articulos')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    workspaceTab === 'articulos'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-4 h-4 ${
                        workspaceTab === 'articulos' ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span>Artículos y Postulaciones</span>
                  </div>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${
                      workspaceTab === 'articulos'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    HU-08
                  </span>
                </button>

                {/* Ítem: Directorio de Usuarios */}
                <button
                  type="button"
                  onClick={() => navigateTo('workspace', 'usuarios')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-medium transition-colors ${
                    workspaceTab === 'usuarios'
                      ? 'bg-indigo-50 text-indigo-700 font-semibold shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className={`w-4 h-4 ${
                        workspaceTab === 'usuarios' ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                      />
                    </svg>
                    <span>Directorio de Usuarios</span>
                  </div>
                </button>

                <div className="pt-2">
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-2">
                    Otros Módulos
                  </span>
                  <a
                    href="#agenda"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-100 font-medium transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span>Agenda del Evento</span>
                  </a>

                  <a
                    href="#config"
                    className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-400 hover:bg-slate-100 font-medium transition-colors"
                  >
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>Configuración</span>
                  </a>
                </div>
              </nav>
            </div>

            {/* Perfil del Usuario Autenticado en el pie del Sidebar */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-left truncate">
                <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                  {userInitials}
                </div>
                <div className="truncate">
                  <span className="text-xs font-semibold text-slate-800 block leading-tight truncate">
                    {user?.full_name || 'Usuario'}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate">
                    {roleLabel}
                  </span>
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
          </aside>

          {/* Área principal de contenido del Espacio de Trabajo */}
          <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
            {/* Topbar del Dashboard */}
            <header className="h-14 border-b border-slate-200 bg-white px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30">
              <div className="flex items-center gap-3">
                {/* Botón Hamburger para pantallas móviles */}
                <button
                  type="button"
                  onClick={() => setIsMobileMenuOpen(true)}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 md:hidden"
                  aria-label="Abrir navegación móvil"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>

                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="hidden sm:inline">Espacio de Trabajo</span>
                  <span className="hidden sm:inline">/</span>
                  <span className="text-slate-800 font-medium">
                    {workspaceTab === 'articulos'
                      ? 'Catálogo de Artículos'
                      : 'Directorio de Usuarios'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                  Symposia 2026
                </span>
                <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-md">
                  {roleLabel}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate('/login', { replace: true });
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Cerrar sesión
                </button>
              </div>
            </header>

            {/* Contenido dinámico según la pestaña activa */}
            <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
              {workspaceTab === 'articulos' && <ArticleCatalogView />}

              {workspaceTab === 'usuarios' && (
                <>
                  <button type="button" onClick={() => setIsAdminModalOpen(true)} className="px-4 py-2 rounded-xl bg-indigo-600 text-white">Añadir usuario</button>
                  <UserListView embedded loadUsers={loadConfiguredUsers} />
                </>
              )}
            </main>

            {/* Modal Flotante de Creación de Usuario */}
            {isAdminModalOpen && (
              <UserCreationForm
                mode="admin"
                isModal={true}
                onCancel={() => setIsAdminModalOpen(false)}
                onSuccess={(newUser) => {
                  setLastCreatedUser(newUser);
                  setIsAdminModalOpen(false);
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
