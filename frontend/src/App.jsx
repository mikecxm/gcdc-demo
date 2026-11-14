import { useState } from 'react';
import { UserCreationForm } from './components/users/UserCreationForm';

const LIBRARY_BG_URL =
  'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=1600&auto=format&fit=crop';

function App() {
  const [viewMode, setViewMode] = useState('public');
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(true);
  const [lastCreatedUser, setLastCreatedUser] = useState(null);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative selection:bg-indigo-100 selection:text-indigo-900">
      {/* Switcher flotante superior para testing de ambos entornos */}
      <div className="fixed bottom-4 right-4 z-[9999] bg-white/95 backdrop-blur shadow-2xl border border-slate-200 rounded-2xl p-2 flex items-center gap-1.5 text-xs font-medium">
        <span className="text-slate-400 px-2 font-mono">Modo:</span>
        <button
          type="button"
          onClick={() => setViewMode('public')}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            viewMode === 'public'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Registro Público
        </button>
        <button
          type="button"
          onClick={() => {
            setViewMode('admin');
            setIsAdminModalOpen(true);
          }}
          className={`px-3 py-1.5 rounded-xl transition-all ${
            viewMode === 'admin'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Admin Dashboard (Modal)
        </button>
      </div>

      {/* ========================================================
          1. VISTA PÚBLICA (SPLIT SCREEN: ARQUITECTURA + PORTAL)
         ======================================================== */}
      {viewMode === 'public' && (
        <div className="min-h-screen flex w-full">
          {/* Lado izquierdo: Fotografía arquitectónica con branding Symposia (visible en lg: >=1024px) */}
          <div className="hidden lg:relative lg:flex lg:w-1/2 xl:w-5/12 bg-slate-900 overflow-hidden">
            <img
              src={LIBRARY_BG_URL}
              alt="Symposia Biblioteca Conferencia"
              className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-luminosity scale-105"
            />
            {/* Gradiente oscuro superior e inferior */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-950/80" />

            {/* Logo e identidad Symposia */}
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
            <header className="flex items-center justify-between w-full max-w-lg mx-auto pb-6">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2" />
                  </svg>
                </div>
                <span className="font-bold text-slate-900 text-sm">symposia</span>
              </div>
              <span className="hidden lg:block text-xs font-medium text-slate-500">
                Portal de Conferencias Académicas
              </span>
              <a
                href="#help"
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                ¿Necesitas ayuda?
              </a>
            </header>

            {/* Contenedor central con UserCreationForm en modo público */}
            <main className="my-auto py-4">
              <UserCreationForm
                mode="public"
                onSuccess={(user) => setLastCreatedUser(user)}
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
          2. VISTA ADMIN (DASHBOARD SYMPOSIA + MODAL FLOTANTE)
         ======================================================== */}
      {viewMode === 'admin' && (
        <div className="min-h-screen flex bg-slate-50">
          {/* Sidebar Symposia */}
          <aside className="hidden md:flex flex-col w-64 border-r border-slate-200 bg-white p-5 justify-between">
            <div className="space-y-6">
              {/* Brand */}
              <div className="flex items-center gap-3 px-1">
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
                    <span className="text-[10px] text-slate-400 block">Panel de Admin</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                </svg>
              </div>

              {/* Menú de navegación */}
              <nav className="space-y-1 text-xs">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 block mb-2">
                  Espacio de Trabajo
                </span>
                <a
                  href="#resumen"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span>Resumen</span>
                </a>

                {/* Ítem Activo: Usuarios */}
                <a
                  href="#usuarios"
                  className="flex items-center justify-between px-3 py-2 rounded-xl bg-indigo-50 text-indigo-700 font-semibold shadow-xs transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Usuarios</span>
                  </div>
                  <span className="text-[11px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-md font-bold">
                    128
                  </span>
                </a>

                <a
                  href="#articulos"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>Artículos y Postulaciones</span>
                </a>

                <a
                  href="#agenda"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>Agenda</span>
                </a>

                <a
                  href="#config"
                  className="flex items-center gap-3 px-3 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>Configuración</span>
                </a>
              </nav>
            </div>

            {/* Perfil Sarah Chen */}
            <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                  SC
                </div>
                <div className="text-left">
                  <span className="text-xs font-semibold text-slate-800 block leading-tight">Sarah Chen</span>
                  <span className="text-[10px] text-slate-400 block">Administrador</span>
                </div>
              </div>
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
          </aside>

          {/* Área principal del Dashboard */}
          <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
            {/* Topbar del Dashboard */}
            <header className="h-14 border-b border-slate-200 bg-white px-6 sm:px-8 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span>Espacio de Trabajo</span>
                <span>/</span>
                <span className="text-slate-800 font-medium">Directorio de Usuarios</span>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  aria-label="Notificaciones"
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </button>
                <span className="text-xs text-slate-500 font-medium">Symposia 2026</span>
              </div>
            </header>

            {/* Contenido del Dashboard */}
            <main className="p-6 sm:p-8 space-y-6 max-w-7xl">
              {/* Título de la página y botón primario de acción */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-indigo-600 tracking-wider uppercase block">
                    PERSONAS Y PERMISOS
                  </span>
                  <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
                    Directorio de Usuarios
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Gestiona los usuarios y roles asignados a la conferencia.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsAdminModalOpen(true)}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs sm:text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 self-start sm:self-auto"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>+ Añadir Usuario</span>
                </button>
              </div>

              {/* Tarjetas KPI de métricas */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-left">
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs text-slate-500 block">Total de Usuarios</span>
                  <span className="text-2xl font-bold text-indigo-600 mt-1 block">128</span>
                </div>
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs text-slate-500 block">Administradores</span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">8</span>
                </div>
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs text-slate-500 block">Comité Científico</span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">24</span>
                </div>
                <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs">
                  <span className="text-xs text-slate-500 block">Autores</span>
                  <span className="text-2xl font-bold text-slate-900 mt-1 block">96</span>
                </div>
              </div>

              {/* Tabla simulada del directorio de usuarios */}
              <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden text-left">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
                  <div className="relative flex-1 max-w-sm">
                    <input
                      type="text"
                      placeholder="Búsqueda por nombre o correo..."
                      className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-600"
                    />
                    <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <span className="text-xs text-slate-500">Todos los roles</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-400 font-semibold border-b border-slate-100">
                      <tr>
                        <th className="py-3 px-4">Nombre Completo</th>
                        <th className="py-3 px-4">Correo electrónico</th>
                        <th className="py-3 px-4">Rol</th>
                        <th className="py-3 px-4">Fecha de registro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-900">Sarah Chen</td>
                        <td className="py-3 px-4 text-slate-500">sarah.chen@univalle.edu.co</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700">
                            Administrador
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Oct 12, 2026</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-900">James Wilson</td>
                        <td className="py-3 px-4 text-slate-500">j.wilson@univalle.edu.co</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700">
                            Comité Científico
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Oct 12, 2026</td>
                      </tr>
                      <tr>
                        <td className="py-3 px-4 font-medium text-slate-900">Amina Hassan</td>
                        <td className="py-3 px-4 text-slate-500">amina.hassan@univalle.edu.co</td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                            Autor
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-400">Oct 13, 2026</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </main>

            {/* Modal Flotante con Fondo Desenfocado (Desktop >= 1024px: backdrop-blur-sm bg-black/40) */}
            {isAdminModalOpen && (
              <UserCreationForm
                mode="admin"
                isModal={true}
                onCancel={() => setIsAdminModalOpen(false)}
                onSuccess={(user) => {
                  setLastCreatedUser(user);
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
