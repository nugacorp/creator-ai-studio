import { useEffect, useState } from 'react';
import { Sliders, ShieldCheck, HelpCircle, ExternalLink } from 'lucide-react';
import { fetchSettings, updateSettings, type AppSettings } from '../api';

const DEFAULT_SETTINGS: AppSettings = {
  ttsSampleRate: '24000',
  ttsAccent: 'es-ES',
  aiProviderDefault: 'gemini',
};

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void fetchSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
  }, []);

  const handleSave = async () => {
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaved(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex items-center gap-3 bg-[#15191E] p-4.5 rounded-2xl border border-white/5">
        <div className="p-2.5 bg-indigo-500/10 rounded-xl text-indigo-400">
          <Sliders className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display font-bold text-base text-white">Configuración de Creator OS</h2>
          <p className="text-[11px] text-slate-400">Personaliza el motor de inteligencia artificial y parámetros globales</p>
        </div>
      </div>

      <div className="max-w-2xl bg-[#15191E] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
        <div className="space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>Preferencias de Motor de Voz (TTS)</span>
          </h4>

          <div className="grid grid-cols-2 gap-4 text-xs font-semibold text-white">
            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase block">Tasa de Muestreo</label>
              <select
                value={settings.ttsSampleRate}
                onChange={e => setSettings(s => ({ ...s, ttsSampleRate: e.target.value }))}
                className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2"
              >
                <option value="24000">24,000 Hz (Fidelidad de locución)</option>
                <option value="16000">16,000 Hz (Estándar)</option>
                <option value="48000">48,000 Hz (Ultra-Fina Estudio)</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase block">Acento por defecto</label>
              <select
                value={settings.ttsAccent}
                onChange={e => setSettings(s => ({ ...s, ttsAccent: e.target.value }))}
                className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2"
              >
                <option value="es-ES">Español (Castellano Narrativo)</option>
                <option value="es-MX">Español (Latinoamérica Neutro)</option>
                <option value="en-US">Inglés (EEUU)</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-slate-400 text-[10px] uppercase block">Proveedor de IA por defecto</label>
            <select
              value={settings.aiProviderDefault}
              onChange={e => setSettings(s => ({ ...s, aiProviderDefault: e.target.value }))}
              className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-xs"
            >
              <option value="gemini">Google Gemini</option>
              <option value="openai">OpenAI</option>
              <option value="claude">Anthropic Claude</option>
            </select>
          </div>

          <button
            onClick={() => void handleSave()}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
          >
            {saved ? '✓ Guardado' : 'Guardar preferencias'}
          </button>
        </div>

        <div className="pt-4 border-t border-white/5 space-y-4">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">
            <HelpCircle className="w-4 h-4 text-indigo-400" />
            <span>Soporte Técnico</span>
          </h4>
          <p className="text-xs text-slate-400 leading-relaxed">
            ¿Tienes dudas sobre los límites de tokens o la integración de canales automáticos? Visita nuestra documentación enterprise de Creator OS o contacta directamente a soporte.
          </p>
          <a
            href="https://github.com/nugacorp/creator-ai-studio"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir documentación</span>
          </a>
        </div>
      </div>
    </div>
  );
}
