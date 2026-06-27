import { useEffect, useState } from 'react';
import { Sliders, ShieldCheck, HelpCircle, ExternalLink, KeyRound, PlugZap, CheckCircle2, Loader2, LogIn } from 'lucide-react';
import type { SecretAuthMethod, SecretProvider, SecretStatus } from '@creator-ai-studio/shared';
import ProfileEditor from './ProfileEditor';
import {
  fetchSecrets,
  fetchSettings,
  startGoogleOAuth,
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

const GOOGLE_OAUTH_SETUP: Array<{ key: keyof SecretsPatch; label: string; placeholder: string }> = [
  {
    key: 'googleOAuthClientId',
    label: 'Google OAuth Client ID',
    placeholder: '123456789.apps.googleusercontent.com',
  },
  {
    key: 'googleOAuthClientSecret',
    label: 'Google OAuth Client Secret',
    placeholder: 'GOCSPX-...',
  },
];

const API_KEY_FIELDS: Array<{
  provider: SecretProvider;
  label: string;
  oauthPurpose?: 'gemini' | 'youtube';
  openAiGuided?: boolean;
  fields: Array<{ key: keyof SecretsPatch; label: string; placeholder: string; optional?: boolean }>;
}> = [
  {
    provider: 'gemini',
    label: 'Google Gemini',
    oauthPurpose: 'gemini',
    fields: [{ key: 'geminiApiKey', label: 'API Key manual (alternativa)', placeholder: 'AIza...', optional: true }],
  },
  {
    provider: 'openai',
    label: 'OpenAI',
    openAiGuided: true,
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
      { key: 'elevenlabsVoiceId', label: 'Voice ID (opcional)', placeholder: '21m00Tcm4TlvDq8ikWAM', optional: true },
    ],
  },
  {
    provider: 'youtube',
    label: 'YouTube',
    oauthPurpose: 'youtube',
    fields: [],
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
  const [googleOAuthClientConfigured, setGoogleOAuthClientConfigured] = useState(false);
  const [draftSecrets, setDraftSecrets] = useState<SecretsPatch>({});
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [secretsSaved, setSecretsSaved] = useState(false);
  const [secretsSaving, setSecretsSaving] = useState(false);
  const [secretsSaveMessage, setSecretsSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [oauthConnecting, setOauthConnecting] = useState<string | null>(null);
  const [showManualGeminiKey, setShowManualGeminiKey] = useState(false);

  const loadSecrets = () => {
    void fetchSecrets()
      .then(data => {
        setSecretItems(data.items);
        setEncryptionAvailable(data.encryptionAvailable);
        setGoogleOAuthClientConfigured(Boolean(data.googleOAuthClientConfigured));
      })
      .catch(() => setSecretItems([]));
  };

  useEffect(() => {
    void fetchSettings()
      .then(setSettings)
      .catch(() => setSettings(DEFAULT_SETTINGS));
    loadSecrets();

    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth_status');
    const oauthProvider = params.get('oauth');
    const oauthMessage = params.get('oauth_message');
    if (oauthStatus === 'success' && oauthProvider) {
      setSecretsSaveMessage(`Cuenta de ${oauthProvider === 'youtube' ? 'YouTube' : 'Google Gemini'} conectada por OAuth.`);
      loadSecrets();
      window.history.replaceState({}, '', `${window.location.pathname}?view=settings`);
    } else if (oauthStatus === 'error') {
      setSaveError(`OAuth falló: ${oauthMessage ?? 'error desconocido'}`);
      window.history.replaceState({}, '', `${window.location.pathname}?view=settings`);
    }
  }, []);

  const handleSave = async () => {
    setSaveError(null);
    try {
      const updated = await updateSettings(settings);
      setSettings(updated);
      if (Object.keys(draftSecrets).length > 0) {
        if (!encryptionAvailable) {
          setSaveError(
            'El servidor aún no tiene CAS_SECRETS_KEY. Puedes escribir las keys aquí, pero contacta al administrador para activar el guardado desde la UI, o usa variables de entorno en Coolify.',
          );
          return;
        }
        const res = await updateSecrets(draftSecrets);
        setSecretItems(res.items);
        setDraftSecrets({});
        loadSecrets();
      }
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch {
      setSettingsSaved(false);
      setSaveError('No se pudo guardar. Verifica que CAS_SECRETS_KEY esté configurada en el servidor.');
    }
  };

  const savedFieldLabels = (patch: SecretsPatch): string[] => {
    const labels: string[] = [];
    for (const group of API_KEY_FIELDS) {
      if (group.fields.some(f => patch[f.key]?.trim())) {
        labels.push(group.label);
      }
    }
    if (GOOGLE_OAUTH_SETUP.some(f => patch[f.key]?.trim())) {
      labels.push('Google OAuth');
    }
    return labels;
  };

  const handleSaveSecretsOnly = async () => {
    setSaveError(null);
    setSecretsSaveMessage(null);
    const patch = Object.fromEntries(
      Object.entries(draftSecrets)
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value] as const)
        .filter(([, value]) => typeof value === 'string' && value.length > 0),
    ) as SecretsPatch;
    if (Object.keys(patch).length === 0) {
      setSaveError('Escribe al menos una API key antes de guardar.');
      return;
    }
    if (!encryptionAvailable) {
      setSaveError(
        'Falta CAS_SECRETS_KEY en el servidor. Recarga esta página e intenta de nuevo.',
      );
      return;
    }
    setSecretsSaving(true);
    const savedLabels = savedFieldLabels(patch);
    try {
      const res = await updateSecrets(patch);
      setSecretItems(res.items);
      setDraftSecrets({});
      loadSecrets();
      setSecretsSaved(true);
      const list = savedLabels.length > 0 ? savedLabels.join(', ') : 'integraciones';
      setSecretsSaveMessage(`API keys guardadas correctamente (${list}). Ya puedes usar Probar para verificar la conexión.`);
      setTimeout(() => {
        setSecretsSaved(false);
        setSecretsSaveMessage(null);
      }, 6000);
    } catch {
      setSecretsSaved(false);
      setSaveError('Error al guardar las API keys. Intenta de nuevo.');
    } finally {
      setSecretsSaving(false);
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

  const handleGoogleOAuth = async (purpose: 'gemini' | 'youtube', forceConsent = false) => {
    setSaveError(null);
    setOauthConnecting(purpose);
    try {
      const clientId = draftSecrets.googleOAuthClientId?.trim() ?? '';
      const clientSecret = draftSecrets.googleOAuthClientSecret?.trim() ?? '';
      const hasDraftClient = Boolean(clientId || clientSecret);

      if (hasDraftClient) {
        if (!clientId || !clientSecret) {
          setSaveError('Completa Client ID y Client Secret de Google Cloud antes de conectar.');
          setOauthConnecting(null);
          return;
        }
        if (!encryptionAvailable) {
          setSaveError('Falta CAS_SECRETS_KEY en el servidor. Recarga esta página e intenta de nuevo.');
          setOauthConnecting(null);
          return;
        }
        await updateSecrets({ googleOAuthClientId: clientId, googleOAuthClientSecret: clientSecret });
        setDraftSecrets(s => {
          const next = { ...s };
          delete next.googleOAuthClientId;
          delete next.googleOAuthClientSecret;
          return next;
        });
        setGoogleOAuthClientConfigured(true);
        loadSecrets();
      } else if (!googleOAuthClientConfigured) {
        setSaveError(
          'Pega tu Client ID y Client Secret reales de Google Cloud arriba (no uses los ejemplos grises) y pulsa Conectar de nuevo.',
        );
        setOauthConnecting(null);
        return;
      }

      const { authorizeUrl } = await startGoogleOAuth(purpose, forceConsent);
      window.location.href = authorizeUrl;
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : 'No se pudo iniciar OAuth. Guarda el Client ID y Client Secret, y añade la URL de callback en Google Cloud.',
      );
      setOauthConnecting(null);
    }
  };

  const authLabel = (authMethod?: SecretAuthMethod) => {
    if (authMethod === 'oauth') return 'OAuth';
    if (authMethod === 'api_key') return 'API Key';
    return 'Sin configurar';
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
        <ProfileEditor />

        <div className="bg-[#15191E] border border-white/10 rounded-3xl p-6 space-y-6 shadow-xl">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-1">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            <span>Integraciones y API Keys</span>
          </h4>

          {!encryptionAvailable && (
            <p className="text-xs text-amber-300/90 bg-amber-950/30 border border-amber-900/30 rounded-xl p-3">
              El cifrado de keys en el servidor se está activando. Ya puedes escribir tus API keys abajo;
              cuando <code className="font-mono">CAS_SECRETS_KEY</code> esté lista, pulsa{' '}
              <strong>Guardar API Keys</strong>.
            </p>
          )}

          {saveError && (
            <p role="alert" className="text-xs text-rose-300 bg-rose-950/30 border border-rose-900/30 rounded-xl p-3">
              {saveError}
            </p>
          )}

          {secretsSaveMessage && (
            <p
              role="status"
              className="text-xs text-emerald-300 bg-emerald-950/40 border border-emerald-800/40 rounded-xl p-3 flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{secretsSaveMessage}</span>
            </p>
          )}

          <div className="bg-[#0B0F14] border border-white/5 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h5 className="text-sm font-bold text-white">Google Cloud OAuth (Gemini + YouTube)</h5>
              <span className="text-[10px] font-mono text-slate-500">
                {googleOAuthClientConfigured ? 'App OAuth guardada' : 'Pendiente de credenciales'}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">
              Crea credenciales OAuth 2.0 en{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                Google Cloud Console
              </a>
              . Añade como redirect URI:{' '}
              <code className="font-mono text-slate-400">
                {`${window.location.origin}/api/oauth/google/callback`}
              </code>
            </p>
            <p className="text-[10px] text-slate-500">
              Para tokens de larga duración (sin reconectar cada 7 días), publica la app OAuth en{' '}
              <strong className="text-slate-400">In production</strong> en Google Cloud.{' '}
              <a
                href="https://console.cloud.google.com/apis/credentials/consent"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 hover:text-indigo-300"
              >
                OAuth consent screen
              </a>
              . Guía: <code className="font-mono text-slate-500">docs/02-operations/GOOGLE_OAUTH_PRODUCTION.md</code>
            </p>
            <p className="text-[10px] text-amber-300/80">
              Los textos grises en los campos son solo ejemplos. Pega tus credenciales reales; se guardan
              automáticamente al pulsar Conectar con Google.
            </p>
            {GOOGLE_OAUTH_SETUP.map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-slate-400 text-[10px] uppercase block">{field.label}</label>
                <input
                  type="password"
                  placeholder={field.placeholder}
                  autoComplete="off"
                  value={draftSecrets[field.key] ?? ''}
                  onChange={e =>
                    setDraftSecrets(s => ({
                      ...s,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="w-full bg-[#15191E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                />
              </div>
            ))}
          </div>

          <div className="space-y-4">
            {API_KEY_FIELDS.map(group => {
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
                          ? `${status.source === 'env' ? 'Env' : 'UI'} · ${authLabel(status.authMethod)} · ${status.maskedValue ?? '••••'}`
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

                  {group.oauthPurpose && (
                    status?.authMethod === 'oauth' && status?.configured ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 px-3 py-2">
                        <div className="flex items-center gap-2 text-xs text-emerald-300">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Conectado · sesión guardada en el servidor</span>
                        </div>
                        <button
                          type="button"
                          disabled={oauthConnecting === group.oauthPurpose}
                          onClick={() => void handleGoogleOAuth(group.oauthPurpose!, true)}
                          className="text-[10px] font-bold text-indigo-300 hover:text-indigo-200 disabled:opacity-60"
                        >
                          {oauthConnecting === group.oauthPurpose ? 'Redirigiendo…' : 'Reconectar'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={oauthConnecting === group.oauthPurpose}
                        onClick={() => void handleGoogleOAuth(group.oauthPurpose!)}
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white text-[#0B0F14] hover:bg-slate-100 disabled:opacity-60 text-xs font-bold transition-colors"
                      >
                        {oauthConnecting === group.oauthPurpose ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Redirigiendo a Google…
                          </>
                        ) : (
                          <>
                            <LogIn className="w-4 h-4" />
                            Conectar con Google (OAuth)
                          </>
                        )}
                      </button>
                    )
                  )}

                  {group.openAiGuided && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500">
                        OpenAI no ofrece OAuth público para apps de terceros. Crea tu API key en la plataforma
                        y pégala abajo (se guarda cifrada en el servidor).
                      </p>
                      <a
                        href="https://platform.openai.com/api-keys"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[10px] font-bold text-indigo-400 hover:text-indigo-300"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Obtener API key en OpenAI
                      </a>
                    </div>
                  )}

                  {testResults[group.provider] && (
                    <p className="text-[10px] text-slate-400 font-mono">{testResults[group.provider]}</p>
                  )}

                  {group.provider === 'gemini' && !showManualGeminiKey && (
                    <button
                      type="button"
                      onClick={() => setShowManualGeminiKey(true)}
                      className="text-[10px] text-slate-500 hover:text-slate-300 underline"
                    >
                      Usar API key manual en lugar de OAuth
                    </button>
                  )}

                  {group.fields.map(field => {
                    if (group.provider === 'gemini' && !showManualGeminiKey) {
                      return null;
                    }
                    return (
                      <div key={field.key} className="space-y-1">
                        <label className="text-slate-400 text-[10px] uppercase block">{field.label}</label>
                        <input
                          type="password"
                          placeholder={field.placeholder}
                          autoComplete="off"
                          value={draftSecrets[field.key] ?? ''}
                          onChange={e =>
                            setDraftSecrets(s => ({
                              ...s,
                              [field.key]: e.target.value,
                            }))
                          }
                          className="w-full bg-[#15191E] border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500/50"
                        />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            disabled={secretsSaving}
            onClick={() => void handleSaveSecretsOnly()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition-colors"
          >
            {secretsSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Guardando…
              </>
            ) : secretsSaved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                ✓ Keys guardadas
              </>
            ) : (
              'Guardar API Keys'
            )}
          </button>
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
              {settingsSaved ? '✓ Configuración guardada' : 'Guardar configuración'}
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
