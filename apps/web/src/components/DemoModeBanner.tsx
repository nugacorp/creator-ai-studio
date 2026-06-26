import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { fetchSystemMode } from '../api';

export default function DemoModeBanner() {
  const [demoMode, setDemoMode] = useState(false);
  const [provider, setProvider] = useState('demo');

  useEffect(() => {
    void fetchSystemMode()
      .then(mode => {
        setDemoMode(mode.demoMode);
        setProvider(mode.aiProvider);
      })
      .catch(() => setDemoMode(true));
  }, []);

  if (!demoMode) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-950/40 border border-amber-800/30 text-amber-200 text-xs">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <span>
        Modo demo activo ({provider}). Configura API keys en{' '}
        <strong className="text-amber-100">Configuración → Integraciones</strong> para respuestas reales.
      </span>
    </div>
  );
}
