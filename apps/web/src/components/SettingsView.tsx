import { useEffect, useState } from 'react';
import { Sliders, ShieldCheck, HelpCircle, ExternalLink, KeyRound, PlugZap } from 'lucide-react';
import type { SecretProvider, SecretStatus } from '@creator-ai-studio/shared';
import {
  fetchSecrets,
  fetchSettings,
  testSecret,
  updateSecrets,
  updateSettings,
  type AppSettings,
  type SecretsPatch,
} from '../api';

const DEFAULT_SETTINGS: AppSettings = {
  ttsSampleRate: '24000',
  ttsAccent: 'es-ES',
  aiProviderDefault: 'gemini',
  ttsProvider: 'elevenlabs',
  autoArchiveOnPublish: true,
  maxActiveEpisodes: 1,
  diskWarningThresholdGb: 5,
};

const SECRET_FIELDS: Array<{
  provider: SecretProvider;
  label: string;
  fields: Array<{ key: keyof SecretsPatch; label: string; placeholder: string }>;
}> = [
  {
    provider: 'gemini',
    label: 'Google Gemini',
    fields: [{ key: 'geminiApiKey', label: 'API Key', placeholder: 'AIza...' }],
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    fields: [{ key: 'openaiApiKey', label: 'API Key', placeholder: 'sk-...' }],
  },
  {
    provider: 'anthropic',
    label: 'Anthropic Claude',
    fields: [{ key: 'anthropicApiKey', label: 'API Key', placeholder: 'sk-ant-...' }],
  },
  {
    provider: 'elevenlabs',
    label: 'ElevenLabs',
    fields: [
      { key: 'elevenlabsApiKey', label: 'API Key', placeholder: 'xi-...' },
      { key: 'elevenlabsVoiceId', label: 'Voice ID (opcional)', placeholder: '21m00Tcm4TlvDq8ikWAM' },
    ],
  },
  {
    provider: 'youtube',
    label: 'YouTube',
    fields: [
      { key: 'youtubeClientId', label: 'Client ID', placeholder: '...apps.googleusercontent.com' },
      { key: 'youtubeClientSecret', label: 'Client Secret', placeholder: 'GOCSPX-...' },
      { key: 'youtubeAccessToken', label: 'Access Token', placeholder: 'ya29...' },
    ],
  },
  {
    provider: 'webhook',
    label: 'Webhook',
    fields: [{ key: 'webhookUrl', label: 'URL', placeholder: 'https://...' }],
  },
];

export default function SettingsView() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [secretItems, setSecretItems] = useState<SecretStatus[]>([]);
  const [encryptionAvailable, setEncryptionAvailable] = useState(false);
  const [draftSecrets, setDraftSecrets] = useState<SecretsPatch>({});
  const [saved, setSaved] = useState(false);
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const loadSecrets = () => {
    void fetchSecrets()
      .then(data => {
        setSecretItems(data.items);
        setEncryptionAvailable(data.encryptionAvailable);
      })
      .catch(() => setSecretItems([]));
  };

  useEffect(() => {
    void fetchSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
    loadSecrets();
  }, []);

  const handleSave = async () => {
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      if (Object.keys(draftSecrets).length > 0) {
        const res = await updateSecrets(draftSecrets);
        setSecretItems(res.items);
        setDraftSecrets({});
        loadSecrets();
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setSaved(false);
    }
  };

  const statusFor = (provider: SecretProvider) =>
    secretItems.find(s => s.provider === provider);

  const handleTest = async (provider: SecretProvider) => {
    setTestResults(prev => ({ ...prev, [provider]: 'Probando...' }));
    try {
      const result = await testSecret(provider);
      setTestResults(prev => ({ ...prev, [provider]: result.message }));
    } catch {
      setTestResults(prev => ({ ...prev, [provider]: 'Error al probar conexión' }));
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
          <p className="text-[11px] text-slate-400">Motor de IA, integraciones y parámetros globales</p>
        </div>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="bg-[#15191E] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>Integraciones y API Keys</span>
          </h4>

          {!encryptionAvailable && (
            <p className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900/30 rounded-xl p-3">
              El servidor no tiene <code className="font-mono">CAS_SECRETS_KEY</code> configurada. Las keys
              solo pueden definirse como variables de entorno en Coolify hasta que se active el cifrado.
            </p>
          )}

          <div className="space-y-4">
            {SECRET_FIELDS.map(group => {
              const status = statusFor(group.provider);
              return (
                <div
                  key={group.provider}
                  className="bg-[#0B0F14] border border-white/5 rounded-2xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <h5 className="text-sm font-bold text-white">{group.label}</h5>
                      <p className="text-[10px] text-slate-500 font-mono">
                        {status?.configured
                          ? `${status.source === 'env' ? 'Env' : 'UI'} · ${status.maskedValue ?? '••••'}`
                          : 'Sin configurar'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleTest(group.provider)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[10px] font-bold text-indigo-300"
                    >
                      <PlugZap className="w-3 h-3" />
                      Probar
                    </button>
                  </div>
                  {testResults[group.provider] && (
                    <p className="text-[10px] text-slate-400 font-mono">{testResults[group.provider]}</p>
                  )}
                  {group.fields.map(field => (
                    <div key={field.key} className="space-y-1">
                      <label className="text-slate-400 text-[10px] uppercase block">{field.label}</label>
                      <input
                        type="password"
                        placeholder={field.placeholder}
                        disabled={!encryptionAvailable}
                        value={draftSecrets[field.key] ?? ''}
                        onChange={e =>
                          setDraftSecrets(s => ({
                            ...s,
                            [field.key]: e.target.value,
                          }))
                        }
                        className="w-full bg-[#15191E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white disabled:opacity-50"
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-[#15191E] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
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
                  <option value="24000">24,000 Hz</option>
                  <option value="16000">16,000 Hz</option>
                  <option value="48000">48,000 Hz</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase block">Acento</label>
                <select
                  value={settings.ttsAccent}
                  onChange={e => setSettings(s => ({ ...s, ttsAccent: e.target.value }))}
                  className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2"
                >
                  <option value="es-ES">Español (Castellano)</option>
                  <option value="es-MX">Español (Latinoamérica)</option>
                  <option value="en-US">Inglés (EEUU)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-slate-400 text-[10px] uppercase block">Motor de voz (TTS)</label>
              <select
                value={settings.ttsProvider ?? 'elevenlabs'}
                onChange={e =>
                  setSettings(s => ({
                    ...s,
                    ttsProvider: e.target.value as AppSettings['ttsProvider'],
                  }))
                }
                className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-xs"
              >
                <option value="elevenlabs">ElevenLabs (recomendado — API desde CAS)</option>
                <option value="piper">Piper (gratis, CPU en VPS)</option>
                <option value="gemini">Gemini (experimental)</option>
              </select>
              <p className="text-[10px] text-slate-500">
                Con ElevenLabs solo pegas la API key arriba; la narración se genera desde el workspace sin abrir su web.
              </p>
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

            <div className="pt-4 border-t border-white/5 space-y-3">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                Almacenamiento VPS + Google Drive
              </h4>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={settings.autoArchiveOnPublish ?? true}
                  onChange={e =>
                    setSettings(s => ({ ...s, autoArchiveOnPublish: e.target.checked }))
                  }
                  className="accent-indigo-500"
                />
                Archivar en Drive al confirmar publicación
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase block">Episodios activos en VPS</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={settings.maxActiveEpisodes ?? 1}
                    onChange={e =>
                      setSettings(s => ({
                        ...s,
                        maxActiveEpisodes: Number(e.target.value) || 1,
                      }))
                    }
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-400 text-[10px] uppercase block">Alerta disco (GB)</label>
                  <input
                    type="number"
                    min={1}
                    value={settings.diskWarningThresholdGb ?? 5}
                    onChange={e =>
                      setSettings(s => ({
                        ...s,
                        diskWarningThresholdGb: Number(e.target.value) || 5,
                      }))
                    }
                    className="w-full bg-[#0B0F14] border border-white/10 rounded-xl px-3 py-2 text-xs"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={() => void handleSave()}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors"
            >
              {saved ? '✓ Guardado' : 'Guardar configuración'}
            </button>
          </div>

          <div className="pt-4 border-t border-white/5 space-y-4">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">
              <HelpCircle className="w-4 h-4 text-indigo-400" />
              <span>Soporte Técnico</span>
            </h4>
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
    </div>
  );
}
