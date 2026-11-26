import { useRef, useState, type FormEvent } from "react";
import axios from "axios";
import ReCAPTCHA from "react-google-recaptcha";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  login,
  requestPasswordResetPin,
  confirmPasswordReset,
} from "../../services/auth";
import { useAuth, type Role } from "../../context/SessionContext";
import RoleSelectorModal from "./RoleSelectorModal";
import { PasswordRecoveryWizard } from "../users/PasswordRecoveryWizard";
import { SymposiaLogo } from "../brand/SymposiaLogo";
import { AuthBrandPanel } from "./AuthBrandPanel";

const SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined;

function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;

    if (typeof data === "object" && data !== null) {
      const payload = data as Record<string, unknown>;
      const detail = payload.detail ?? payload.non_field_errors;

      if (typeof detail === "string") return detail;

      if (Array.isArray(detail)) {
        const messages = detail.filter(
          (item): item is string => typeof item === "string"
        );
        if (messages.length) return messages.join(", ");
      }
    }

    const status = err.response?.status;
    if (status === 400) return "Verificación CAPTCHA inválida. Inténtalo de nuevo.";
    if (status === 401) return "Correo o contraseña incorrectos.";
    if (status === 429) return "Demasiados intentos. Espera unos minutos.";
    if (!err.response) return "No se pudo conectar con el servidor.";
  }

  return "Ocurrió un error. Inténtalo de nuevo.";
}

const isRole = (role: unknown): role is Role =>
  role === "ADMIN" || role === "COMITE" || role === "AUTOR";

export default function LoginView() {
  const navigate = useNavigate();
  const { session, isAuthenticated, startSession, selectActiveRole } = useAuth();
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingRoles, setPendingRoles] = useState<Role[] | null>(null);
  const [showRecovery, setShowRecovery] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

if (showRecovery) {
  return (
    <div className="flex min-h-screen w-full bg-slate-50 font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 lg:h-screen lg:overflow-hidden">
      <AuthBrandPanel />
      <div className="flex min-h-screen w-full flex-col justify-between overflow-y-auto bg-slate-50 p-4 sm:p-8 lg:h-screen lg:min-h-0 lg:w-1/2 lg:p-12 xl:w-7/12">
        <header className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 pb-6">
          <SymposiaLogo size="sm" />
          <button
            type="button"
            onClick={() => setShowRecovery(false)}
            className="text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
          >
            Volver a iniciar sesión
          </button>
        </header>

        <main className="my-auto py-4">
          <PasswordRecoveryWizard
            onRequestPin={requestPasswordResetPin}
            onResetPassword={confirmPasswordReset}
            onBack={() => setShowRecovery(false)}
          />
        </main>

        <footer className="mx-auto w-full max-w-lg pt-6 text-center text-xs text-slate-400">
          <p>© 2026 Universidad del Valle · Sistema de Gestión de Conferencias Symposia</p>
        </footer>
      </div>
    </div>
  );
}

  const resetCaptcha = () => {
    recaptchaRef.current?.reset();
    setCaptchaToken(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!captchaToken) return;

    setLoading(true);
    setError(null);

    try {
      const data = await login(email.trim(), password, captchaToken);
      const responseRoles = Array.isArray(data.roles) ? data.roles : [];
      const roles = responseRoles.filter(isRole);

      if (roles.length === 0 || roles.length !== responseRoles.length) {
        setError("Tu cuenta no tiene roles asignados. Contacta al administrador.");
        resetCaptcha();
        return;
      }

      const activeRole =
        data.active_role && roles.includes(data.active_role)
          ? data.active_role
          : roles.length === 1
            ? roles[0]
            : null;

      startSession({
        accessToken: data.access,
        refreshToken: data.refresh,
        roles,
        activeRole,
        fullName: data.full_name,
      });

      if (activeRole) {
        navigate("/", { replace: true });
      } else {
        setPendingRoles(roles);
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
    navigate("/", { replace: true });
  };

  const rolesToSelect =
    pendingRoles ?? (session && !session.activeRole ? session.roles : null);

  return (
    <div className="min-h-screen flex w-full bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900 lg:h-screen lg:overflow-hidden">
      <AuthBrandPanel />

      {/* Lado derecho: Portal y Formulario flotante de Login */}
      <div className="w-full lg:w-1/2 xl:w-7/12 flex flex-col justify-between min-h-screen p-4 sm:p-8 lg:h-screen lg:min-h-0 lg:p-12 bg-slate-50 overflow-y-auto">
        {/* Header superior del portal */}
        <header className="flex items-center justify-between w-full max-w-lg mx-auto pb-6 gap-2">
          <SymposiaLogo size="sm" />

          <div className="flex items-center gap-3">
            <Link
              to="/#registro"
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              Crear cuenta de autor →
            </Link>
          </div>
        </header>

        {/* Tarjeta principal de Login (alineada con UserCreationForm) */}
        <main className="my-auto py-4">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8 w-full max-w-lg mx-auto text-left relative">
            {/* Header del formulario */}
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                    />
                  </svg>
                </div>
                <div>
                  <p className="symposia-page-eyebrow">CONFERENCIA SYMPOSIA 2026 · ACCESO</p>
                  <h1 className="symposia-page-title">
                    Iniciar sesión
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                    Ingresa tus credenciales para acceder al sistema Symposia.
                  </p>
                </div>
              </div>
            </div>

            {/* Sub-indicador de seguridad institucional */}
            <div className="mb-6">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 tracking-wider uppercase mb-2">
                <span>AUTENTICACIÓN INSTITUCIONAL</span>
                <span className="text-indigo-600 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  SEGURO
                </span>
              </div>
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="h-full bg-indigo-600 rounded-full w-full"></div>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Correo Electrónico Institucional */}
              <div>
                <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
                  Correo electrónico institucional
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correounivalle.edu.co"
                  className="w-full h-10 px-3.5 text-sm bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15 rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none"
                />
              </div>

              {/* Contraseña */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-slate-700">
                    Contraseña
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowRecovery(true)}
                    className="text-xs text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                  >
                    ¿Olvidaste tu contraseña?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 px-3.5 text-sm bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15 rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none"
                />
              </div>

              {/* Verificación reCAPTCHA */}
              <div className="pt-1">
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Verificación de seguridad
                </label>
                <div className="flex min-h-[82px] items-center justify-center overflow-hidden">
                  {SITE_KEY ? (
                    <div className="recaptcha-widget flex justify-center">
                      <ReCAPTCHA
                        ref={recaptchaRef}
                        sitekey={SITE_KEY}
                        onChange={(token) => setCaptchaToken(token)}
                        onExpired={() => setCaptchaToken(null)}
                        onErrored={() => setCaptchaToken(null)}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200 text-center w-full">
                      Falta configurar <code className="font-mono font-semibold">VITE_RECAPTCHA_SITE_KEY</code> en el archivo .env
                    </div>
                  )}
                </div>
              </div>

              {/* Botón de envío */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={!captchaToken || !email || !password || loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4 text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      <span>Iniciando sesión...</span>
                    </>
                  ) : (
                    "Ingresar al sistema"
                  )}
                </button>
              </div>

              {/* Enlace a Registro */}
              <div className="pt-2 text-center">
                <p className="text-xs text-slate-500">
                  ¿Aún no tienes cuenta?{" "}
                  <Link
                    to="/#registro"
                    className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors"
                  >
                    Regístrate como autor
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </main>

        {/* Footer institucional discreto */}
        <footer className="w-full max-w-lg mx-auto pt-6 text-center text-xs text-slate-400">
          <p>© 2026 Universidad del Valle · Sistema de Gestión de Conferencias Symposia</p>
        </footer>
      </div>

      {/* Modal de selección de rol si el usuario posee múltiples roles */}
      {rolesToSelect && (
        <RoleSelectorModal roles={rolesToSelect} onConfirm={handleRoleConfirm} />
      )}
    </div>
  );
}
