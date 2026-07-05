import { Loader2, Mail, X } from 'lucide-react';
import { useState } from 'react';
import type { CreateTeamInviteInput } from '@creator-ai-studio/shared';

interface InviteTeamMemberModalProps {
  open: boolean;
  saving?: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTeamInviteInput) => void;
}

const ROLE_OPTIONS: Array<{ value: CreateTeamInviteInput['role']; label: string; hint: string }> = [
  { value: 'editor', label: 'Editor', hint: 'Puede crear y editar episodios' },
  { value: 'viewer', label: 'Lector', hint: 'Solo lectura del estudio' },
];

export default function InviteTeamMemberModal({
  open,
  saving = false,
  onClose,
  onSubmit,
}: InviteTeamMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<CreateTeamInviteInput['role']>('editor');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed.includes('@')) {
      setError('Introduce un correo electrónico válido');
      return;
    }
    setError(null);
    onSubmit({ email: trimmed, role });
  };

  const handleClose = () => {
    if (saving) return;
    setEmail('');
    setRole('editor');
    setError(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0F14]/90 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        role="dialog"
        aria-labelledby="invite-team-title"
        className="w-full max-w-md bg-[#15191E] border border-indigo-500/30 rounded-3xl p-6 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={handleClose}
          disabled={saving}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-5">
          <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h3 id="invite-team-title" className="font-display font-bold text-lg text-white">
              Invitar miembro
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Se guardará la invitación en el servidor. El envío por correo requiere SMTP configurado.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-email" className="block text-xs font-semibold text-slate-400 mb-1.5">
              Correo electrónico
            </label>
            <input
              id="invite-email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="colaborador@ejemplo.com"
              disabled={saving}
              className="w-full px-3.5 py-2.5 rounded-xl bg-[#0B0F14] border border-white/10 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
              autoFocus
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-400 mb-2">Rol</span>
            <div className="space-y-2">
              {ROLE_OPTIONS.map(option => (
                <label
                  key={option.value}
                  className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    role === option.value
                      ? 'border-indigo-500/40 bg-indigo-500/10'
                      : 'border-white/5 bg-[#0B0F14] hover:border-white/10'
                  }`}
                >
                  <input
                    type="radio"
                    name="team-role"
                    value={option.value}
                    checked={role === option.value}
                    onChange={() => setRole(option.value)}
                    disabled={saving}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-white">{option.label}</span>
                    <span className="block text-xs text-slate-500">{option.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="text-xs text-rose-400">{error}</p>}

          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={handleClose}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enviar invitación
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
