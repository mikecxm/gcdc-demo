import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Mail, ShieldCheck, LockKeyhole } from 'lucide-react';

const emailSchema = z.object({
    email: z.string().trim().email('Ingresa un correo válido'),
});

const recoverySchema = z.object({
    pin: z.string().length(6, 'El PIN debe tener 6 dígitos')
    .regex(/^\d{6}$/, 'El PIN solo debe contener números'),
    password: z.string().min(8, 'Mínimo 8 caracteres')
    .regex(/[0-9]/, 'Debe incluir al menos un número')
    .regex(/[^a-zA-Z0-9]/, 'Debe incluir un símbolo'),
    confirmPassword: z.string().min(1, 'Confirma tu contraseña'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
});

type EmailData = z.infer<typeof emailSchema>;
type RecoveryData = z.infer<typeof recoverySchema>;

interface PasswordRecoveryWizardProps {
    onRequestPin: (email: string) => Promise<void>;
    onResetPassword: (data: {
    email: string;
    pin: string;
    new_password: string;
    }) => Promise<void>;
    onBack?: () => void;
}

const inputClass =
    'w-full h-11 px-3.5 text-sm bg-white border border-slate-200 rounded-lg text-slate-900 outline-none transition-all focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/15';

export const PasswordRecoveryWizard: React.FC<PasswordRecoveryWizardProps> = ({
    onRequestPin,
    onResetPassword,
    onBack,
}) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [email, setEmail] = useState('');
    const [secondsLeft, setSecondsLeft] = useState(600);
    const [globalError, setGlobalError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);

    const emailForm = useForm<EmailData>({
    resolver: zodResolver(emailSchema),
    mode: 'onChange',
    defaultValues: { email: '' },
    });

    const recoveryForm = useForm<RecoveryData>({
    resolver: zodResolver(recoverySchema),
    mode: 'onChange',
    defaultValues: {
        pin: '',
        password: '',
        confirmPassword: '',
    },
});

useEffect(() => {
    if (step !== 2 || secondsLeft <= 0 || success) return;

    const timer = window.setTimeout(() => {
    setSecondsLeft((previous) => previous - 1);
    }, 1000);

    return () => window.clearTimeout(timer);
}, [step, secondsLeft, success]);

const formattedTime = `${Math.floor(secondsLeft / 60)
    .toString().padStart(2, '0')}:${(secondsLeft % 60)
    .toString().padStart(2, '0')}`;

const requestPin = async (data: EmailData) => {
    setLoading(true);
    setGlobalError('');

    try {
        await onRequestPin(data.email);
        setEmail(data.email);
        setSecondsLeft(600);
        setStep(2);
    } catch {
        setGlobalError('No fue posible enviar el PIN. Inténtalo nuevamente.');
    } finally {
        setLoading(false);
    }
};

const resetPassword = async (data: RecoveryData) => {
    if (secondsLeft <= 0) return;

    setLoading(true);
    setGlobalError('');

    try {
        await onResetPassword({
        email,
        pin: data.pin,
        new_password: data.password,
    });
    setSuccess(true);
    } catch {
        setGlobalError('No fue posible restablecer la contraseña. Verifica el PIN e inténtalo nuevamente.');
    } finally {
        setLoading(false);
    }
};

const resendPin = async () => {
    setLoading(true);
    setGlobalError('');

    try {
        await onRequestPin(email);
        setSecondsLeft(600);
        recoveryForm.reset();
    } catch {
        setGlobalError('No fue posible reenviar el PIN.');
    } finally {
        setLoading(false);
    }
};

return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl shadow-xl border border-slate-100 p-6 sm:p-8">
        <div className="flex items-center gap-3 mb-6">
        <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            {step === 1 ? <Mail size={22} /> : <ShieldCheck size={22} />}
        </div>
        <div>
            <h2 className="text-xl font-bold text-slate-900">
            Recuperar contraseña
            </h2>
            <p className="text-xs text-slate-500">
            {step === 1 ? 'Verifica tu correo institucional' : 'Confirma tu identidad'}
            </p>
        </div>
        </div>
        
        <div className="mb-6">
        <div className="flex justify-between text-xs font-semibold text-slate-400 mb-2">
        <span>PASO {step} DE 2</span>
          <span className="text-indigo-600">{step * 50}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div
            className={`h-full bg-indigo-600 rounded-full transition-all ${
                step === 1 ? 'w-1/2' : 'w-full'
            }`}
        />
        </div>
    </div>

    {globalError && (
        <div role="alert" className="mb-5 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        {globalError}
        </div>
    )}

    {success ? (
        <div className="text-center py-5">
        <div className="mx-auto mb-4 w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ShieldCheck size={28} />
        </div>
        <h3 className="text-lg font-bold text-slate-900">
            ¡Contraseña actualizada!
        </h3>
        <p className="text-sm text-slate-500 mt-2">
            Ya puedes iniciar sesión con tu nueva contraseña.
        </p>
        {onBack && (
            <button onClick={onBack} className="mt-6 w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-medium">
            Volver al inicio de sesión
            </button>
        )}
        </div>
) : step === 1 ? (
        <form onSubmit={emailForm.handleSubmit(requestPin)} className="space-y-4" noValidate>
        <p className="text-sm text-slate-500">
            Ingresa el correo asociado a tu cuenta. Te enviaremos un PIN de verificación.
        </p>

        <div>
            <label htmlFor="recovery-email" className="block text-xs font-medium text-slate-700 mb-1.5">
            Correo electrónico
            </label>
            <input
            id="recovery-email"
            type="email"
            autoComplete="email"
            placeholder="ejemplo@correounivalle.edu.co"
            {...emailForm.register('email')}
            className={inputClass}
            />
            {emailForm.formState.errors.email && (
            <p className="text-red-600 text-xs mt-1">
                {emailForm.formState.errors.email.message}
            </p>
            )}
        </div>

        <button
            type="submit"
            disabled={loading || !emailForm.formState.isValid}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-xl transition-colors"
        >
            {loading ? 'Enviando...' : 'Enviar PIN'}
        </button>
        </form>
    ) : (
        <form onSubmit={recoveryForm.handleSubmit(resetPassword)} className="space-y-4" noValidate>
        <p className="text-sm text-slate-500">
            Introduce el PIN enviado a <strong>{email}</strong> y establece tu nueva contraseña.
        </p>

        <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Tiempo restante</span>
            <span className={`font-bold tabular-nums ${secondsLeft <= 60 ? 'text-red-600' : 'text-indigo-600'}`}>
            {formattedTime}
            </span>
        </div>

        {secondsLeft <= 0 && (
            <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            El PIN ha expirado. Solicita uno nuevo para continuar.
            </div>
        )}

        <div>
            <label htmlFor="recovery-pin" className="block text-xs font-medium text-slate-700 mb-1.5">
            PIN de 6 dígitos
            </label>
            <input
            id="recovery-pin"
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="000000"
            {...recoveryForm.register('pin')}
            className={inputClass}
            />
            {recoveryForm.formState.errors.pin && (
            <p className="text-red-600 text-xs mt-1">{recoveryForm.formState.errors.pin.message}</p>
            )}
        </div>

        <div>
            <label htmlFor="recovery-password" className="block text-xs font-medium text-slate-700 mb-1.5">
            Nueva contraseña
            </label>
            <input
            id="recovery-password"
            type="password"
            autoComplete="new-password"
            placeholder="Mínimo 8 caracteres"
            {...recoveryForm.register('password')}
            className={inputClass}
            />
            {recoveryForm.formState.errors.password && (
            <p className="text-red-600 text-xs mt-1">{recoveryForm.formState.errors.password.message}</p>
            )}
        </div>

        <div>
            <label htmlFor="recovery-confirm" className="block text-xs font-medium text-slate-700 mb-1.5">
            Confirmar contraseña
            </label>
            <input
            id="recovery-confirm"
            type="password"
            autoComplete="new-password"
            placeholder="Repite la contraseña"
            {...recoveryForm.register('confirmPassword')}
            className={inputClass}
            />
            {recoveryForm.formState.errors.confirmPassword && (
            <p className="text-red-600 text-xs mt-1">{recoveryForm.formState.errors.confirmPassword.message}</p>
            )}
        </div>

        <button
            type="submit"
            disabled={loading || secondsLeft <= 0 || !recoveryForm.formState.isValid}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
        >
            <LockKeyhole size={16} />
            {loading ? 'Procesando...' : 'Restablecer contraseña'}
        </button>

        <button
            type="button"
            onClick={resendPin}
            disabled={loading}
            className="w-full text-xs text-indigo-600 hover:text-indigo-800 font-medium disabled:text-slate-400"
        >
            Reenviar PIN
        </button>
        </form>
    )}

    {!success && (
        <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
        <button
            type="button"
            onClick={step === 2 ? () => {
            setStep(1);
            setGlobalError('');
            } : onBack}
            className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
        >
            <ArrowLeft size={14} />
            {step === 2 ? 'Cambiar correo' : 'Volver al inicio'}
        </button>
        {step === 2 && (
            <span className="text-xs text-slate-400">PIN válido por 10 minutos</span>
        )}
        </div>
    )}
    </div>
    );
};
