import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import {
  adminCreateUser,
  registerUser,
  type UserResponse,
  type UserRole,
} from '../../services/api';

const userSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(3, 'El nombre completo debe tener al menos 3 caracteres'),
    email: z
      .string()
      .trim()
      .email('Ingresa un correo institucional válido')
      .toLowerCase()
      .refine(
        (val) =>
          val.endsWith('.edu.co') ||
          val.endsWith('.edu') ||
          val.includes('univalle') ||
          val.endsWith('.ac.uk'),
        {
          message:
            'Debe ser un correo institucional válido (ej. @correounivalle.edu.co, .edu)',
        }
      ),
    affiliation: z
      .string()
      .trim()
      .min(2, 'La afiliación universitaria es obligatoria'),
    role: z.enum(['ADMIN', 'COMITE', 'AUTOR'] as const),
    password: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[0-9]/, 'Debe incluir al menos un número')
      .regex(/[^a-zA-Z0-9]/, 'Debe incluir al menos un símbolo o carácter especial'),
    confirm_password: z.string().min(1, 'Confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Las contraseñas no coinciden',
    path: ['confirm_password'],
  });

export type UserFormData = z.infer<typeof userSchema>;

interface UserCreationFormProps {
  mode: 'public' | 'admin';
  authToken?: string;
  onSuccess?: (user: UserResponse) => void;
  onCancel?: () => void;
  isModal?: boolean;
}

export const UserCreationForm: React.FC<UserCreationFormProps> = ({
  mode,
  authToken,
  onSuccess,
  onCancel,
  isModal = false,
}) => {
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'success' | 'error';
    title: string;
    message: string;
  }>({
    show: false,
    type: 'success',
    title: '',
    message: '',
  });

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isValid },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    mode: 'onChange',
    defaultValues: {
      full_name: '',
      email: '',
      affiliation: '',
      role: 'AUTOR',
      password: '',
      confirm_password: '',
    },
  });

  const selectedRole = watch('role');

  useEffect(() => {
    if (toast.show) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, show: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.show]);

  const onSubmit = async (data: UserFormData) => {
    setGlobalError(null);

    try {
      let createdUser: UserResponse;

      if (mode === 'public') {
        createdUser = await registerUser({
          full_name: data.full_name,
          email: data.email,
          affiliation: data.affiliation,
          password: data.password,
        });
      } else {
        if (authToken) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
        }
        createdUser = await adminCreateUser({
          full_name: data.full_name,
          email: data.email,
          affiliation: data.affiliation,
          password: data.password,
          role: data.role as UserRole,
        });
      }

      setToast({
        show: true,
        type: 'success',
        title: '¡Usuario creado exitosamente!',
        message: `${createdUser.full_name} (${createdUser.email}) fue registrado en el sistema.`,
      });

      reset({
        full_name: '',
        email: '',
        affiliation: '',
        role: 'AUTOR',
        password: '',
        confirm_password: '',
      });

      if (onSuccess) {
        onSuccess(createdUser);
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const responseData = err.response?.data;

        if (err.response?.status === 400 && responseData) {
          if (responseData.email) {
            const emailMsg = Array.isArray(responseData.email)
              ? responseData.email[0]
              : responseData.email;
            setError('email', { type: 'server', message: emailMsg });
          }
          if (responseData.password) {
            const passMsg = Array.isArray(responseData.password)
              ? responseData.password[0]
              : responseData.password;
            setError('password', { type: 'server', message: passMsg });
          }
          if (responseData.detail) {
            setGlobalError(responseData.detail);
          }
        } else if (err.response?.status === 401 || err.response?.status === 403) {
          setGlobalError('No tienes los permisos necesarios para realizar esta acción.');
        } else {
          setGlobalError('Ocurrió un error inesperado al procesar la solicitud.');
        }
      } else {
        setGlobalError('No se pudo establecer conexión con el servidor.');
      }
    }
  };

  const formContent = (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8 w-full max-w-lg mx-auto text-left relative">
      {/* Alerta Toast de Confirmación Flotante */}
      {toast.show && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-5 right-5 z-[9999] max-w-sm w-full bg-white rounded-2xl p-4 shadow-2xl border border-emerald-100 flex items-start gap-3 transition-all animate-in fade-in slide-in-from-top-4"
        >
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-xs font-bold text-slate-900">{toast.title}</h4>
            <p className="text-xs text-slate-500 mt-0.5">{toast.message}</p>
          </div>
          <button
            type="button"
            onClick={() => setToast((prev) => ({ ...prev, show: false }))}
            aria-label="Cerrar notificación"
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Header del formulario */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
            {mode === 'admin' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {mode === 'admin' ? 'Añadir usuario' : 'Crea tu cuenta de autor'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {mode === 'admin'
                ? 'Actualiza los detalles del perfil y los permisos en la conferencia.'
                : 'Únete a Symposia para postular tus artículos de investigación.'}
            </p>
          </div>
        </div>

        {isModal && onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar modal"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {mode === 'public' && (
        <div className="mb-6">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 tracking-wider uppercase mb-2">
            <span>PASO 1 DE 2 · REGISTRO INSTITUCIONAL</span>
            <span className="text-indigo-600">50%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden flex">
            <div className="h-full bg-indigo-600 rounded-full w-1/2"></div>
          </div>
        </div>
      )}

      {globalError && (
        <div
          role="alert"
          className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-start gap-2"
        >
          <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span>{globalError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {/* Nombre Completo */}
        <div>
          <label htmlFor="full_name" className="block text-xs font-medium text-slate-700 mb-1.5">
            Nombre completo
          </label>
          <input
            id="full_name"
            type="text"
            autoComplete="name"
            aria-invalid={errors.full_name ? 'true' : 'false'}
            aria-describedby={errors.full_name ? 'full_name-error' : undefined}
            {...register('full_name')}
            placeholder="Ej. Sarah Chen"
            className={`w-full h-10 px-3.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none ${
              errors.full_name
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15'
            }`}
          />
          {errors.full_name && (
            <p id="full_name-error" className="text-red-600 text-xs mt-1">
              {errors.full_name.message}
            </p>
          )}
        </div>

        {/* Correo Electrónico Institucional */}
        <div>
          <label htmlFor="email" className="block text-xs font-medium text-slate-700 mb-1.5">
            Correo electrónico institucional
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={errors.email ? 'true' : 'false'}
            aria-describedby={errors.email ? 'email-error' : undefined}
            {...register('email')}
            placeholder="ejemplo.ejemplo@correounivalle.edu.co"
            className={`w-full h-10 px-3.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none ${
              errors.email
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15'
            }`}
          />
          {errors.email && (
            <p id="email-error" className="text-red-600 text-xs mt-1">
              {errors.email.message}
            </p>
          )}
        </div>

        {/* Afiliación Universitaria */}
        <div>
          <label htmlFor="affiliation" className="block text-xs font-medium text-slate-700 mb-1.5">
            Afiliación universitaria
          </label>
          <input
            id="affiliation"
            type="text"
            aria-invalid={errors.affiliation ? 'true' : 'false'}
            aria-describedby={errors.affiliation ? 'affiliation-error' : undefined}
            {...register('affiliation')}
            placeholder="Ej. Universidad del Valle - Depto. de Sistemas"
            className={`w-full h-10 px-3.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none ${
              errors.affiliation
                ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15'
            }`}
          />
          {errors.affiliation && (
            <p id="affiliation-error" className="text-red-600 text-xs mt-1">
              {errors.affiliation.message}
            </p>
          )}
        </div>

        {/* Selector de Rol en Modo Admin: 3 Tarjetas Radio Estilo Symposia con WAI-ARIA */}
        {mode === 'admin' && (
          <div className="pt-1">
            <span id="role-group-label" className="block text-xs font-medium text-slate-700 mb-2">
              Rol asignado
            </span>
            <div
              role="radiogroup"
              aria-labelledby="role-group-label"
              className="grid grid-cols-1 sm:grid-cols-3 gap-2.5"
            >
              {/* Tarjeta: Administrador */}
              <button
                type="button"
                role="radio"
                aria-checked={selectedRole === 'ADMIN'}
                onClick={() => setValue('role', 'ADMIN', { shouldValidate: true })}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selectedRole === 'ADMIN'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedRole === 'ADMIN' ? 'border-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {selectedRole === 'ADMIN' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    selectedRole === 'ADMIN' ? 'text-indigo-900' : 'text-slate-800'
                  }`}
                >
                  Administrador
                </span>
              </button>

              {/* Tarjeta: Comité Científico */}
              <button
                type="button"
                role="radio"
                aria-checked={selectedRole === 'COMITE'}
                onClick={() => setValue('role', 'COMITE', { shouldValidate: true })}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selectedRole === 'COMITE'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedRole === 'COMITE' ? 'border-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {selectedRole === 'COMITE' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    selectedRole === 'COMITE' ? 'text-indigo-900' : 'text-slate-800'
                  }`}
                >
                  Comité Científico
                </span>
              </button>

              {/* Tarjeta: Autor */}
              <button
                type="button"
                role="radio"
                aria-checked={selectedRole === 'AUTOR'}
                onClick={() => setValue('role', 'AUTOR', { shouldValidate: true })}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  selectedRole === 'AUTOR'
                    ? 'border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex items-center justify-between w-full mb-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedRole === 'AUTOR' ? 'border-indigo-600' : 'border-slate-300'
                    }`}
                  >
                    {selectedRole === 'AUTOR' && (
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs font-semibold ${
                    selectedRole === 'AUTOR' ? 'text-indigo-900' : 'text-slate-800'
                  }`}
                >
                  Autor
                </span>
              </button>
            </div>

            {/* Texto de ayuda contextual por rol */}
            <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
              {selectedRole === 'ADMIN' &&
                'Los administradores pueden gestionar usuarios, roles y la configuración de la conferencia.'}
              {selectedRole === 'COMITE' &&
                'El comité científico evalúa artículos, coordina revisiones y dictamina postulaciones.'}
              {selectedRole === 'AUTOR' &&
                'Los autores pueden registrar artículos, subir versiones PDF y consultar sus evaluaciones.'}
            </p>
          </div>
        )}

        {/* Contraseña y Confirmación */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-700 mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.password ? 'true' : 'false'}
              aria-describedby={errors.password ? 'password-error' : undefined}
              {...register('password')}
              placeholder="••••••••"
              className={`w-full h-10 px-3.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none ${
                errors.password
                  ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                  : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15'
              }`}
            />
            {errors.password && (
              <p id="password-error" className="text-red-600 text-[11px] mt-1">
                {errors.password.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="confirm_password" className="block text-xs font-medium text-slate-700 mb-1.5">
              Confirmar contraseña
            </label>
            <input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              aria-invalid={errors.confirm_password ? 'true' : 'false'}
              aria-describedby={errors.confirm_password ? 'confirm_password-error' : undefined}
              {...register('confirm_password')}
              placeholder="••••••••"
              className={`w-full h-10 px-3.5 text-sm bg-white border rounded-lg text-slate-900 placeholder:text-slate-400 transition-all outline-none ${
                errors.confirm_password
                  ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                  : 'border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15'
              }`}
            />
            {errors.confirm_password && (
              <p id="confirm_password-error" className="text-red-600 text-[11px] mt-1">
                {errors.confirm_password.message}
              </p>
            )}
          </div>
        </div>

        {/* Botones de Acción (Bloqueo reactivo de submit si hay errores o envío en curso) */}
        <div
          className={`pt-4 ${
            mode === 'admin'
              ? 'flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end sm:gap-3'
              : 'space-y-3'
          }`}
        >
          {mode === 'admin' && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full sm:w-auto px-5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl transition-colors"
            >
              Cancelar
            </button>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isValid}
            aria-disabled={isSubmitting || !isValid}
            className={`w-full ${
              mode === 'admin' ? 'sm:w-auto px-6' : ''
            } py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all shadow-sm hover:shadow flex items-center justify-center gap-2`}
          >
            {isSubmitting ? (
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
                <span>Procesando...</span>
              </>
            ) : mode === 'admin' ? (
              'Guardar cambios'
            ) : (
              'Crear cuenta'
            )}
          </button>
        </div>

        {mode === 'public' && (
          <div className="pt-2 text-center">
            <p className="text-xs text-slate-500">
              ¿Ya tienes cuenta?{' '}
              <a href="#login" className="text-indigo-600 hover:text-indigo-700 font-medium">
                Inicia sesión aquí
              </a>
            </p>
          </div>
        )}
      </form>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 backdrop-blur-sm bg-black/40 overflow-y-auto">
        <div className="w-full max-w-lg my-auto">{formContent}</div>
      </div>
    );
  }

  return formContent;
};
