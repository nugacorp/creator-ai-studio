import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from 'lucide-react';
import {
  copilotChat,
  copilotConfirmAction,
  fetchCopilotMessages,
  type CopilotMessage,
  type CopilotPendingAction,
} from '../api';

interface CopilotViewProps {
  episodeTitle?: string;
  activeEpisodeId?: string | null;
  channelId?: string | null;
  onOpenWorkspace?: (episodeId: string) => void;
}

function mapApiMessage(msg: CopilotMessage): ChatMessage {
  return {
    id: msg.id,
    sender: msg.role === 'user' ? 'user' : 'assistant',
    text: msg.content,
    outOfScope: msg.outOfScope,
    toolResults: msg.toolResults,
    pendingActions: msg.pendingActions,
  };
}

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  outOfScope?: boolean;
  toolResults?: CopilotMessage['toolResults'];
  pendingActions?: CopilotPendingAction[];
}

export default function CopilotView({
  episodeTitle,
  activeEpisodeId,
  channelId,
  onOpenWorkspace,
}: CopilotViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [welcome, setWelcome] = useState('');
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [confirmingActionId, setConfirmingActionId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSending]);

  useEffect(() => {
    let cancelled = false;
    setHistoryLoaded(false);
    void fetchCopilotMessages(channelId)
      .then(data => {
        if (cancelled) return;
        setWelcome(data.welcome);
        if (data.messages.length > 0) {
          setMessages(data.messages.map(mapApiMessage));
        } else {
          setMessages([
            {
              id: 'welcome',
              sender: 'assistant',
              text: data.welcome,
            },
          ]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        const fallback =
          '¡Hola! Soy tu copiloto de Creator AI Studio. Puedo crear ideas, episodios, editar guiones, ejecutar agentes y ayudarte con producción.';
        setWelcome(fallback);
        setMessages([{ id: 'welcome', sender: 'assistant', text: fallback }]);
      })
      .finally(() => {
        if (!cancelled) setHistoryLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [channelId]);

  const appendAssistantFromResponse = useCallback(
    (data: { reply: string; out_of_scope?: boolean; toolResults?: ChatMessage['toolResults']; pendingActions?: CopilotPendingAction[] }) => {
      setMessages(prev => [
        ...prev,
        {
          id: `asst_${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          outOfScope: data.out_of_scope,
          toolResults: data.toolResults,
          pendingActions: data.pendingActions,
        },
      ]);
    },
    [],
  );

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending || !historyLoaded) return;

    const userMsgText = inputText;
    setInputText('');
    setMessages(prev => [...prev, { id: `usr_${Date.now()}`, sender: 'user', text: userMsgText }]);
    setIsSending(true);

    try {
      const data = await copilotChat({
        message: userMsgText,
        channelId,
        activeEpisodeId,
        episodeTitle,
      });
      appendAssistantFromResponse(data);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: 'Error de red al conectar con el servidor de IA.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleConfirmAction = async (action: CopilotPendingAction) => {
    if (confirmingActionId) return;
    setConfirmingActionId(action.id);
    try {
      const data = await copilotConfirmAction({
        action: action.type,
        episodeId: action.episodeId,
        channelId,
      });
      appendAssistantFromResponse(data);
      setMessages(prev =>
        prev.map(msg => ({
          ...msg,
          pendingActions: msg.pendingActions?.filter(a => a.id !== action.id),
        })),
      );
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'assistant',
          text: 'No se pudo confirmar la acción. Intenta de nuevo.',
        },
      ]);
    } finally {
      setConfirmingActionId(null);
    }
  };

  const handleQuickAction = (promptText: string) => {
    setInputText(promptText);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Copiloto Inteligente de Creator OS</h2>
            <p className="text-[11px] text-[#8B949E]">
              Centro de comando: crea, edita y publica por chat. Las vistas manuales siguen disponibles en Contenido y Proyectos.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
        <div className="lg:col-span-3 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl flex flex-col h-full overflow-hidden relative">
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {!historyLoaded && (
              <div className="flex gap-3.5 mr-auto">
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center border bg-indigo-950/20 border-indigo-800/35 text-indigo-400 shrink-0">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-4 bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl text-xs text-[#8B949E]">
                  Cargando historial…
                </div>
              </div>
            )}

            {messages.map(msg => {
              const isAss = msg.sender === 'assistant';
              const isRefusal = isAss && msg.outOfScope;
              return (
                <div key={msg.id} className="space-y-2">
                  <div
                    className={`flex gap-3.5 max-w-[85%] ${isAss ? 'text-left mr-auto' : 'text-left ml-auto flex-row-reverse'}`}
                  >
                    <div
                      className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 border ${
                        isRefusal
                          ? 'bg-amber-950/20 border-amber-800/35 text-amber-400'
                          : isAss
                            ? 'bg-indigo-950/20 border-indigo-800/35 text-indigo-400'
                            : 'bg-zinc-800 border-zinc-700 text-white'
                      }`}
                    >
                      {isRefusal ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : isAss ? (
                        <Bot className="w-4 h-4" />
                      ) : (
                        <User className="w-4 h-4" />
                      )}
                    </div>

                    <div
                      className={`p-4 rounded-2xl text-xs leading-relaxed shadow-md ${
                        isRefusal
                          ? 'bg-amber-950/15 border border-amber-800/30 text-amber-100'
                          : isAss
                            ? 'bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-[#E6EDF2]'
                            : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {isRefusal && (
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-400 mb-1.5">
                          Fuera del alcance del copiloto
                        </p>
                      )}
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>
                  </div>

                  {msg.toolResults && msg.toolResults.length > 0 && (
                    <div className="ml-11 space-y-1.5 max-w-[85%]">
                      {msg.toolResults.map((tr, idx) => (
                        <div
                          key={`${msg.id}-tr-${idx}`}
                          className={`flex items-start gap-2 px-3 py-2 rounded-xl border text-[11px] ${
                            tr.success
                              ? 'bg-emerald-950/20 border-emerald-800/30 text-emerald-100'
                              : 'bg-red-950/15 border-red-800/30 text-red-100'
                          }`}
                        >
                          {tr.success ? (
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-red-400" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p>{tr.summary}</p>
                            {tr.success && tr.data?.episodeId && onOpenWorkspace && (
                              <button
                                type="button"
                                onClick={() => onOpenWorkspace(String(tr.data!.episodeId))}
                                className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-indigo-300 hover:text-indigo-200 cursor-pointer"
                              >
                                <ExternalLink className="w-3 h-3" />
                                Abrir en workspace
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.pendingActions && msg.pendingActions.length > 0 && (
                    <div className="ml-11 flex flex-wrap gap-2">
                      {msg.pendingActions.map(action => (
                        <button
                          key={action.id}
                          type="button"
                          disabled={confirmingActionId === action.id}
                          onClick={() => void handleConfirmAction(action)}
                          className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          {confirmingActionId === action.id ? 'Confirmando…' : action.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isSending && (
              <div className="flex gap-3.5 mr-auto">
                <div className="w-8 h-8 rounded-2xl flex items-center justify-center border bg-indigo-950/20 border-indigo-800/35 text-indigo-400 shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="p-4 bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl text-xs text-[#8B949E] flex items-center gap-2.5 shadow-md">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-500" />
                  <span>Copiloto de IA está pensando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-5 py-2 bg-[#090D12] border-t border-[rgba(255,255,255,0.05)]/70 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {[
              {
                label: 'Crear idea bíblica',
                prompt: 'Crea una idea sobre la fe en tiempos difíciles para el canal activo',
              },
              {
                label: 'Listar episodios',
                prompt: 'Lista los episodios del canal activo con su estado',
              },
              {
                label: 'Gancho de 10s',
                prompt: 'Escribe un gancho de 10 segundos ultra-emocional para un short sobre la ansiedad',
              },
            ].map((chip, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(chip.prompt)}
                className="px-3 py-1.5 rounded-full bg-[#15191E] border border-[rgba(255,255,255,0.05)] hover:border-indigo-500/40 text-[10px] text-[#8B949E] hover:text-white font-medium transition-all shrink-0 cursor-pointer"
              >
                {chip.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSendMessage} className="p-4 bg-[#15191E] border-t border-[rgba(255,255,255,0.05)] flex items-center gap-3">
            <input
              type="text"
              required
              disabled={isSending || !historyLoaded}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Pide crear un episodio, editar guion, ejecutar agente, programar publicación…"
              className="flex-1 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-4 py-3 text-xs text-white placeholder-[#8B949E] focus:outline-none focus:border-indigo-500/40"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim() || !historyLoaded}
              className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-35 disabled:hover:bg-indigo-600 transition-all cursor-pointer shadow-md shadow-indigo-950/20 shrink-0"
            >
              <Send className="w-4 h-4 pl-0.5" />
            </button>
          </form>
        </div>

        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Conciencia de Contexto</h4>
          <div className="space-y-3">
            <div className="bg-[#0B0F14] p-3.5 rounded-2xl border border-[rgba(255,255,255,0.05)] text-[11px] leading-relaxed text-[#8B949E] space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Contexto de Proyecto Activo</span>
              </div>
              <p>
                {episodeTitle
                  ? `Episodio activo: "${episodeTitle}". El copiloto puede editarlo, ejecutar agentes o programar su publicación.`
                  : 'Sin episodio activo. Puedes pedir crear uno o abrir Proyectos para seleccionar manualmente.'}
              </p>
            </div>

            <div className="bg-[#0B0F14] p-3.5 rounded-2xl border border-[rgba(255,255,255,0.05)] text-[11px] leading-relaxed text-[#8B949E] space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Historial persistente</span>
              </div>
              <p>
                Tus mensajes se guardan en el servidor. Puedes cambiar de sección y volver sin perder la conversación.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
