import { Navigate } from "react-router-dom";
import { useAuth, type Role } from "../../context/SessionContext";

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
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-4">
      <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
      <p className="text-gray-700">
        Hola, {session.fullName}. Rol activo: {session.activeRole}
      </p>
      <button
        type="button"
        onClick={logout}
        className="rounded-lg bg-gray-800 px-4 py-2 text-white"
      >
        Cerrar sesión
      </button>
    </main>
  );
}