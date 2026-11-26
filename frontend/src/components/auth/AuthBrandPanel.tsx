import { SymposiaLogo } from '../brand/SymposiaLogo';

const LIBRARY_BG_URL =
  'https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?q=80&w=1600&auto=format&fit=crop';

export function AuthBrandPanel() {
  return (
    <aside className="hidden overflow-hidden bg-slate-900 lg:relative lg:flex lg:h-screen lg:w-1/2 lg:shrink-0 xl:w-5/12">
      <img
        src={LIBRARY_BG_URL}
        alt="Symposia Biblioteca Conferencia"
        className="absolute inset-0 h-full w-full scale-105 object-cover opacity-60 mix-blend-luminosity"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-slate-950/80" />

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-10">
        <SymposiaLogo size="lg" tone="light" />

        <div className="max-w-sm space-y-2">
          <h3 className="text-2xl font-bold tracking-tight text-white">
            Gestión Científica de Conferencias
          </h3>
          <p className="text-sm leading-relaxed text-slate-300">
            Sistema oficial para la postulación, revisión por pares y edición académica de la Universidad del Valle.
          </p>
        </div>

        <div className="text-xs text-slate-400">
          Universidad del Valle · 2026
        </div>
      </div>
    </aside>
  );
}
