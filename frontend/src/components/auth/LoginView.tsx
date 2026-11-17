import { useRef, useState, type FormEvent } from "react";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import { useNavigate } from "react-router-dom";
import { login } from "../../services/auth";
import { DASHBOARD_BY_ROLE, useAuth, type Role } from "../../context/SessionContext";
import RoleSelectorModal from "./RoleSelectorModal";

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status;
    if (status === 400) return "Verificación CAPTCHA inválida. Inténtalo de nuevo.";
    if (status === 401) return "Correo o contraseña incorrectos."; // mensaje genérico
    if (status === 429) return "Demasiados intentos. Espera unos minutos.";
    if (!err.response) return "No se pudo conectar con el servidor.";
  }
  return "Ocurrió un error. Inténtalo de nuevo.";
}

export default function LoginView() {
  const navigate = useNavigate();
  const { startSession, selectActiveRole } = useAuth();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<Role[] | null>(null);

  const resetCaptcha = () => {
    recaptchaRef.current?.reset(); // el token de reCAPTCHA es de un solo uso
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return; // protección extra: el botón ya está deshabilitado

    setLoading(true);
    setError(null);
    try {
      const data = await login(email.trim(), password, captchaToken);
      const roles = data.roles as Role[];

      if (roles.length === 0) {
        setError("Tu cuenta no tiene roles asignados. Contacta al administrador.");
        resetCaptcha();
        return;
      }

      const activeRole =
        (data.active_role as Role | null) ?? (roles.length === 1 ? roles[0] : null);

      startSession({
        accessToken: data.access,
        refreshToken: data.refresh,
        roles,
        activeRole,
        fullName: data.full_name,
      });

      if (activeRole) {
        navigate(DASHBOARD_BY_ROLE[activeRole], { replace: true });
      } else {
        setPendingRoles(roles); // varios roles: abre el modal
      }
    } catch (err) {
      setError(getErrorMessage(err));
      resetCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleRoleConfirm = (role: Role) => {
    selectActiveRole(role);
    navigate(DASHBOARD_BY_ROLE[role], { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-xl bg-white p-8 shadow"
      >
        <h1 className="text-2xl font-bold text-gray-900">Iniciar sesión</h1>

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2"
          />
        </div>

        {SITE_KEY ? (
          <ReCAPTCHA
            ref={recaptchaRef}
            sitekey={SITE_KEY}
            onChange={(token) => setCaptchaToken(token)}
            onExpired={() => setCaptchaToken(null)}
            onErrored={() => setCaptchaToken(null)}
          />
        ) : (
          <p className="text-sm text-red-600">
            Falta VITE_RECAPTCHA_SITE_KEY en el archivo .env del front-end.
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={!captchaToken || !email || !password || loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>

      {pendingRoles && (
        <RoleSelectorModal roles={pendingRoles} onConfirm={handleRoleConfirm} />
      )}
    </main>
  );
}