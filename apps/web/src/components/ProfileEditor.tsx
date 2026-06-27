import { FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function ProfileEditor() {
  const { authEnabled, user, profile, profileLoading, updateProfile } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? user?.email?.split('@')[0] ?? '');
    setAvatarUrl(profile?.avatar_url ?? '');
  }, [profile, user]);

  if (!authEnabled || !user) {
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);

    const result = await updateProfile({
      display_name: displayName.trim(),
      avatar_url: avatarUrl.trim(),
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <div className="bg-[#15191E] border border-white/10 rounded-3xl p-6 space-y-5 shadow-xl">
      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">
        <UserRound className="w-4 h-4 text-indigo-400" />
        <span>Mi perfil</span>
      </h4>

      {profileLoading ? (
        <div className="flex items-center gap-2 text-xs text-[#8B949E]">
          <Loader2 className="w-4 h-4 animate-spin" />
          Cargando perfil…
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-[#8B949E]">Correo</span>
            <input
              type="email"
              value={user.email ?? ''}
              disabled
              className="w-full bg-[#0B0F14] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-[#8B949E] cursor-not-allowed"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-[#8B949E]">Nombre para mostrar</span>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              maxLength={80}
              placeholder="Tu nombre en el estudio"
              className="w-full bg-[#0B0F14] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#8B949E] focus:outline-none focus:border-indigo-500/40"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-[11px] font-medium text-[#8B949E]">URL del avatar (opcional)</span>
            <input
              type="url"
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://..."
              className="w-full bg-[#0B0F14] border border-white/5 rounded-xl px-4 py-2.5 text-sm text-white placeholder-[#8B949E] focus:outline-none focus:border-indigo-500/40"
            />
          </label>

          {avatarUrl.trim() && (
            <div className="flex items-center gap-3">
              <img
                src={avatarUrl.trim()}
                alt=""
                className="w-12 h-12 rounded-full object-cover border border-white/10"
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              <span className="text-[10px] text-[#8B949E]">Vista previa</span>
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-300 bg-rose-950/30 border border-rose-900/30 rounded-xl p-3">
              {error}
            </p>
          )}

          {saved && (
            <p className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Perfil actualizado
            </p>
          )}

          <button
            type="submit"
            disabled={saving || !displayName.trim()}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs font-semibold text-white transition-colors cursor-pointer"
          >
            {saving ? 'Guardando…' : 'Guardar perfil'}
          </button>
        </form>
      )}
    </div>
  );
}
