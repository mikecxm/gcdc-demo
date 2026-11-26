import { Navigate } from "react-router-dom";
import { useAuth, type Role } from "../../context/SessionContext";
import { LayoutDashboard } from "lucide-react";

export default function DashboardPlaceholder({
  title,
  requiredRole,
}: {
  title: string;
  requiredRole: Role;
}) {
  const { session, logout } = useAuth();

  if (!session?.activeRole) return <Navigate to="/login" replace />;
  if (session.activeRole !== requiredRole) return <Navigate to="/" replace />;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-4 text-center">
      <p className="symposia-page-eyebrow">CONFERENCIA SYMPOSIA 2026 · ESPACIO DE TRABAJO</p>
      <h1 className="symposia-page-title justify-center">
        <LayoutDashboard aria-hidden="true" className="h-7 w-7 shrink-0 text-indigo-600" />
        {title}
      </h1>
      <p className="text-sm text-slate-600">
        Hola, {session.fullName}. Rol activo: {session.activeRole}
      </p>
      <button
        type="button"
        onClick={logout}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
      >
        Cerrar sesión
      </button>
    </main>
  );
}