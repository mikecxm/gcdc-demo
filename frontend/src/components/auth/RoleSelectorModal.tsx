import { useState } from "react";
import type { Role } from "../../context/SessionContext";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  COMITE: "Comité Científico",
  AUTOR: "Autor",
};

const ROLE_DESCRIPTIONS: Record<Role, string> = {
  ADMIN: "Gestión global de la plataforma, conferencias y usuarios.",
  COMITE: "Evaluación y dictamen académico de artículos postulados.",
  AUTOR: "Postulación y seguimiento de manuscritos de investigación.",
};

interface Props {
  roles: Role[];
  onConfirm: (role: Role) => void;
}

export default function RoleSelectorModal({ roles, onConfirm }: Props) {
  const [selected, setSelected] = useState<Role | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-slate-900/60 overflow-y-auto animate-in fade-in duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-2xl border border-slate-100 text-left relative"
      >
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
          </div>
          <div>
            <h2 id="role-modal-title" className="text-xl font-bold text-slate-900 tracking-tight">
              Selecciona tu rol de sesión
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              Tu cuenta tiene múltiples roles activos. Elige con cuál deseas interactuar ahora.
            </p>
          </div>
        </div>

        <div className="space-y-2.5">
          {roles.map((role) => {
            const isSelected = selected === role;
            return (
              <label
                key={role}
                onClick={() => setSelected(role)}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all text-left ${
                  isSelected
                    ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600"
                    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                }`}
              >
                <div
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    isSelected ? "border-indigo-600" : "border-slate-300"
                  }`}
                >
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                </div>
                <input
                  type="radio"
                  name="active-role"
                  value={role}
                  checked={isSelected}
                  onChange={() => setSelected(role)}
                  className="sr-only"
                />
                <div className="flex-1">
                  <span
                    className={`text-sm font-semibold block leading-tight ${
                      isSelected ? "text-indigo-900" : "text-slate-900"
                    }`}
                  >
                    {ROLE_LABELS[role] ?? role}
                  </span>
                  <span className="text-xs text-slate-500 mt-0.5 block leading-relaxed">
                    {ROLE_DESCRIPTIONS[role] ?? "Acceso institucional a la plataforma."}
                  </span>
                </div>
              </label>
            );
          })}
        </div>

        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
        >
          <span>Continuar al sistema</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
