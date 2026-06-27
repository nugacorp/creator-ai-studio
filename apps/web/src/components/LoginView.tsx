import { FormEvent, useState } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'signin' | 'signup';

export default function LoginView() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setSubmitting(true);

    const result =
      mode === 'signin'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    if (mode === 'signup') {
      setInfo('Cuenta creada. Revisa tu correo si la confirmación está activada, o inicia sesión.');
      setMode('signin');
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-[#E6EDF2] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="space-y-2 text-center">
          <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-400 font-semibold">
            Creator AI Studio
          </p>
          <h1 className="text-2xl font-bold text-white">Acceso al estudio</h1>
          <p className="text-sm text-[#8B949E]">
            Inicia sesión para gestionar episodios, integraciones y producción.
          </p>
        </div>

        <div className="flex rounded-xl bg-[#0B0F14] p-1 border border-[rgba(255,255,255,0.05)]">
          {(['signin', 'signup'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setMode(tab);
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === tab
                  ? 'bg-indigo-600 text-white'
                  : 'text-[#8B949E] hover:text-white'
              }`}
            >
              {tab === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#8B949E]">Correo</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl px-4 py-3 text-sm text-white placeholder-[#8B949E] focus:outline-none focus:border-indigo-500/40"
              placeholder="tu@correo.com"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-[#8B949E]">Contraseña</span>
            <input
              type="password"
              required
              minLength={8}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-xl px-4 py-3 text-sm text-white placeholder-[#8B949E] focus:outline-none focus:border-indigo-500/40"
              placeholder="Mínimo 8 caracteres"
            />
          </label>

          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">
              {error}
            </p>
          )}
          {info && (
            <p className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
              {info}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-sm font-semibold text-white transition-colors cursor-pointer"
          >
            {submitting
              ? 'Procesando…'
              : mode === 'signin'
                ? 'Entrar'
                : 'Registrarme'}
          </button>
        </form>
      </div>
    </div>
  );
}
