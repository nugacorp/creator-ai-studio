import { AlertTriangle, Trash2, X } from 'lucide-react';

interface DeleteEpisodeModalProps {
  title: string;
  open: boolean;
  deleting?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function DeleteEpisodeModal({
  title,
  open,
  deleting = false,
  onConfirm,
  onCancel,
}: DeleteEpisodeModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[#0B0F14]/90 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div
        role="alertdialog"
        aria-labelledby="delete-episode-title"
        aria-describedby="delete-episode-desc"
        className="w-full max-w-md bg-[#15191E] border border-rose-500/30 rounded-3xl p-6 shadow-2xl relative"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={deleting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
          aria-label="Cerrar"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-start gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 id="delete-episode-title" className="font-display font-bold text-lg text-white">
              Eliminar episodio
            </h3>
            <p id="delete-episode-desc" className="text-sm text-slate-400 mt-1 leading-relaxed">
              Vas a eliminar permanentemente{' '}
              <strong className="text-white">&quot;{title}&quot;</strong>.
            </p>
          </div>
        </div>

        <ul className="text-xs text-slate-400 space-y-1.5 mb-6 list-disc list-inside bg-[#0B0F14] border border-white/5 rounded-xl p-4">
          <li>Se borrará el workspace en el servidor (guion, audio, miniatura, renders).</li>
          <li>Esta acción no se puede deshacer.</li>
          <li>No elimina videos ya publicados en YouTube.</li>
        </ul>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={deleting}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-300 hover:text-white border border-white/10 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer disabled:opacity-60"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {deleting ? 'Eliminando…' : 'Eliminar permanentemente'}
          </button>
        </div>
      </div>
    </div>
  );
}
