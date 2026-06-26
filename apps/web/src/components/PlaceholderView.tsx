import type { ReactElement } from 'react';
import { Construction } from 'lucide-react';

interface PlaceholderViewProps {
  title: string;
  description: string;
}

export function PlaceholderView({
  title,
  description,
}: PlaceholderViewProps): ReactElement {
  return (
    <section className="rounded-3xl border border-white/5 bg-[#15191E] p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400">
          <Construction className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-display text-base font-bold text-white">{title}</h2>
          <p className="text-[11px] text-slate-400">{description}</p>
        </div>
      </div>
      <p className="mt-4 max-w-prose text-xs leading-relaxed text-slate-400">
        This screen is a visual placeholder adopted from the Google AI Studio
        UI/UX reference. It is intentionally not wired to any external service.
        The functional flow lives in the Episodes view.
      </p>
    </section>
  );
}
