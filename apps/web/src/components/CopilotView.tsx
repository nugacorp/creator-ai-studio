import React, { useState, useRef, useEffect } from 'react';
import { Bot, Send, User, Sparkles, RefreshCw, Terminal, AlertCircle } from 'lucide-react';
import { aiChat } from '../api';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
}

interface CopilotViewProps {
  episodeTitle?: string;
}

export default function CopilotView({ episodeTitle }: CopilotViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', sender: 'assistant', text: '¡Hola Ramiro! Soy tu copiloto de Creator AI Studio. Puedo ayudarte a idear guiones bíblicos, proponer ganchos de retención para tus shorts, optimizar títulos CTR o diseñar conceptos artísticos para tus miniaturas. ¿En qué trabajamos hoy?' }
  ]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isSending) return;

    const userMsgText = inputText;
    setInputText('');
    const userMsgId = `usr_${Date.now()}`;
    
    // Add user message to log
    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: userMsgText }]);
    setIsSending(true);

    try {
      const data = await aiChat(
        episodeTitle ? `[Contexto: episodio activo "${episodeTitle}"] ${userMsgText}` : userMsgText,
      );
      
      const assistantMsgId = `asst_${Date.now()}`;
      setMessages(prev => [
        ...prev,
        { id: assistantMsgId, sender: 'assistant', text: data.reply || 'Lo siento, he tenido un inconveniente procesando esa consulta.' }
      ]);
    } catch (err) {
      console.error(err);
      setMessages(prev => [
        ...prev,
        { id: `err_${Date.now()}`, sender: 'assistant', text: 'Error de red al conectar con el servidor Gemini AI.' }
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleQuickAction = (promptText: string) => {
    setInputText(promptText);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      
      {/* Copilot Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#15191E] p-4.5 rounded-2xl border border-[rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-500/10 rounded-2xl text-indigo-400">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display font-bold text-base text-white">Copiloto Inteligente de Creator OS</h2>
            <p className="text-[11px] text-[#8B949E]">Conversación multi-turno con Gemini 3.5 Flash para idear, pulir y estructurar contenido</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-250px)]">
        
        {/* Chat log left/center */}
        <div className="lg:col-span-3 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl flex flex-col h-full overflow-hidden relative">
          
          {/* Scrollable messages area */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {messages.map((msg) => {
              const isAss = msg.sender === 'assistant';
              return (
                <div
                  key={msg.id}
                  className={`flex gap-3.5 max-w-[85%] ${isAss ? 'text-left mr-auto' : 'text-left ml-auto flex-row-reverse'}`}
                >
                  {/* Icon */}
                  <div
                    className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 border ${
                      isAss ? 'bg-indigo-950/20 border-indigo-800/35 text-indigo-400' : 'bg-zinc-800 border-zinc-700 text-white'
                    }`}
                  >
                    {isAss ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>

                  {/* Speech Bubble */}
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed shadow-md ${
                      isAss
                        ? 'bg-[#15191E] border border-[rgba(255,255,255,0.05)] text-[#E6EDF2]'
                        : 'bg-indigo-600 text-white'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
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

          {/* Quick suggestions chips bar */}
          <div className="px-5 py-2 bg-[#090D12] border-t border-[rgba(255,255,255,0.05)]/70 flex items-center gap-2 overflow-x-auto scrollbar-none">
            {[
              { label: 'Escribe un gancho de 10s', prompt: 'Escribe un gancho de 10 segundos ultra-emocional para un short sobre la ansiedad' },
              { label: 'Ideas de títulos con alto CTR', prompt: 'Dame 5 ideas de títulos con alto CTR y misterio para una reflexión sobre Proverbios 3' },
              { label: 'Sugerencia de miniatura', prompt: 'Propón un concepto visual detallado para la miniatura de un video sobre Moisés y el desierto' }
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

          {/* Text entry form */}
          <form onSubmit={handleSendMessage} className="p-4 bg-[#15191E] border-t border-[rgba(255,255,255,0.05)] flex items-center gap-3">
            <input
              type="text"
              required
              disabled={isSending}
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              placeholder="Pregúntale cualquier cosa a tu Copiloto de IA..."
              className="flex-1 bg-[#0B0F14] border border-[rgba(255,255,255,0.05)] rounded-2xl px-4 py-3 text-xs text-white placeholder-[#8B949E] focus:outline-none focus:border-indigo-500/40"
            />
            <button
              type="submit"
              disabled={isSending || !inputText.trim()}
              className="p-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-35 disabled:hover:bg-indigo-600 transition-all cursor-pointer shadow-md shadow-indigo-950/20 shrink-0"
            >
              <Send className="w-4 h-4 pl-0.5" />
            </button>
          </form>

        </div>

        {/* Sidebar reference box info right */}
        <div className="bg-[#15191E] border border-[rgba(255,255,255,0.05)] rounded-2xl p-5 space-y-4">
          <h4 className="text-[11px] font-bold text-[#8B949E] uppercase tracking-wider font-mono">Conciencia de Contexto</h4>
          <div className="space-y-3">
            <div className="bg-[#0B0F14] p-3.5 rounded-2xl border border-[rgba(255,255,255,0.05)] text-[11px] leading-relaxed text-[#8B949E] space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Contexto de Proyecto Activo</span>
              </div>
              <p>
                Tu Copiloto IA tiene lectura directa de tus guiones, canales, métricas y preferencias guardadas en Creator OS de forma automática.
              </p>
            </div>

            <div className="bg-[#0B0F14] p-3.5 rounded-2xl border border-[rgba(255,255,255,0.05)] text-[11px] leading-relaxed text-[#8B949E] space-y-1.5">
              <div className="font-bold text-white flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                <span>Privacidad de tus datos</span>
              </div>
              <p>
                Los datos de tus reflexiones y guiones no se usan para entrenamiento público externo.
              </p>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
