import { useState } from "react";
import type { Role } from "../../context/SessionContext";

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  COMITE: "Miembro del Comité",
  AUTOR: "Autor",
};

interface Props {
  roles: Role[];
  onConfirm: (role: Role) => void;
}


export default function RoleSelectorModal({ roles, onConfirm }: Props) {
  const [selected, setSelected] = useState<Role | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="role-modal-title"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 id="role-modal-title" className="text-lg font-semibold text-gray-900">
          ¿Con qué rol quieres trabajar?
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Tu cuenta tiene varios roles. Elige el que usarás en esta sesión.
        </p>

        <div className="mt-4 space-y-2">
          {roles.map((role) => (
            <label
              key={role}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 ${
                selected === role ? "border-blue-600 bg-blue-50" : "border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="active-role"
                value={role}
                checked={selected === role}
                onChange={() => setSelected(role)}
              />
              <span className="text-gray-900">{ROLE_LABELS[role] ?? role}</span>
            </label>
          ))}
        </div>

        <button
          type="button"
          disabled={!selected}
          onClick={() => selected && onConfirm(selected)}
          className="mt-5 w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}