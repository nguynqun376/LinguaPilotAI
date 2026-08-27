import React, { useState, useRef, useEffect } from 'react';
import { Message, ParticipantGroup } from '../types';
import { HelpCircle, Send, Sparkles, BookOpen, User, Bot, AlertCircle, Info, Lightbulb, CheckCircle2 } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface SocraticTutorProps {
  lang: Language;
  researchGroup: ParticipantGroup;
  logSession: (minutes: number, type: 'Goal Reading' | 'Socratic Tutor' | 'Speaking Practice' | 'Reflection') => void;
  incrementHints: () => void;
  incrementDirect: () => void;
}

export default function SocraticTutor({
  lang,
  researchGroup,
  logSession,
  incrementHints,
  incrementDirect,
}: SocraticTutorProps) {
  const [topic, setTopic] = useState('Business English vocabulary');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const t = translations[lang] || translations.en;

  // Sync initial message with chosen language
  useEffect(() => {
    const greeting = {
      en: "Hello! Welcome to your Socratic language space. What word, grammar detail, or concept shall we examine together today? Ask me anything (e.g. 'What does draw mean?' or 'What does sustainable mean?'), and let's explore it.",
      vi: "Xin chào! Chào mừng tới phòng học Socratic của bạn. Hôm nay chúng ta sẽ cùng nghiên cứu từ vựng, ngữ pháp hay khái niệm nào? Hãy hỏi bất cứ điều gì (ví dụ: 'Từ draw có nghĩa là gì?' hoặc 'sustainable là gì?'), và hãy cùng khám phá.",
      zh: "你好！欢迎来到苏格拉底式的语言探索空间。今天你想和我探讨什么单词、语法细节或概念？问我任何问题（例如：“draw 是什么意思？”或“sustainable 是什么意思？”）我们一起来追根溯源。",
      pt: "Olá! Bem-vindo ao seu espaço de linguagem Socrática. Qual palavra, detalhe gramatical ou conceito examinaremos juntos hoje? Pergunte-me qualquer coisa (ex: 'O que draw significa?' ou 'O que sustentável significa?'), e vamos explorar.",
      es: "¡Hola! Bienvenido a tu espacio de diálogo Socrático. ¿Qué palabra, gramática o concepto examinaremos hoy? Pregúntame lo que quieras (ej: '¿Qué significa draw?' o '¿Qué significa sostenible?'), và vamos a explorar.",
      fr: "Bonjour ! Bienvenue dans votre boîte socratique. Quel mot, point de grammaire ou concept souhaiteriez-vous analyser aujourd'hui ? Demandez-moi (ex : 'Que signifie draw ?' ou 'Que signifie durable ?') pour l'analyser."
    }[lang] || "Welcome to your Socratic language space.";

    setMessages([
      {
        id: 'init-1',
        role: 'model',
        content: greeting,
        timestamp: new Date().toLocaleTimeString(),
      }
    ]);
  }, [lang]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Log session time periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setSessionMinutes((prev) => {
        const next = prev + 1;
        // Log 1 minute of Socratic Tutor study time
        logSession(1, 'Socratic Tutor');
        return next;
      });
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = {
      id: `m-user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date().toLocaleTimeString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    const userText = input;
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/socratic-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          history: messages.map(m => ({ role: m.role, content: m.content })),
          message: userText,
          topic: topic,
          group: researchGroup,
          uiLanguage: lang,
        }),
      });

      if (!res.ok) {
        throw new Error('Socratic AI responded with an error');
      }

      const data = await res.json();

      // Record telemetry indicators based on group
      if (data.isHint) {
        incrementHints();
      }
      if (data.isDirectAnswer) {
        incrementDirect();
      }

      const botMsg: Message = {
        id: `m-bot-${Date.now()}`,
        role: 'model',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString(),
        isHint: data.isHint,
        isDirectAnswer: data.isDirectAnswer,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      console.error(err);
      const fallbackErrorMessage = {
        zh: "抱歉，无法连接到导师服务器，请检查网络或 API 密钥配置。",
        vi: "Xin lỗi, không thể kết nối tới máy chủ gia sư. Vui lòng kiểm tra cấu hình GEMINI_API_KEY hoặc đường truyền mạng.",
        en: "I apologize, but I couldn't reach the tutoring server. Please verify your GEMINI_API_KEY settings or connection speed.",
        pt: "Desculpe, não foi possível conectar ao servidor de tutoria. Verifique as configurações de GEMINI_API_KEY.",
        es: "Lo siento, no pude conectarme con el servidor de tutoría. Verifique la configuración de GEMINI_API_KEY.",
        fr: "Désolé, impossible de joindre le serveur de tutorat. Veuillez vérifier les paramètres GEMINI_API_KEY."
      }[lang] || "I apologize, but I couldn't reach the tutoring server.";

      setMessages((prev) => [
        ...prev,
        {
          id: `m-err-${Date.now()}`,
          role: 'model',
          content: fallbackErrorMessage,
          timestamp: new Date().toLocaleTimeString(),
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="socratic-tutor-container" className="space-y-8 max-w-5xl mx-auto">
      {/* Overview header */}
      <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row gap-6 items-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 translate-x-12 -translate-y-12 bg-[#D4AF37]/5 rounded-full blur-2xl" />
        <div className="rounded-2xl bg-[#D4AF37]/10 p-4 text-[#D4AF37] shrink-0 border border-[#D4AF37]/20 relative z-10">
          <HelpCircle className="h-10 w-10" />
        </div>
        <div className="flex-1 relative z-10">
          <h2 className="text-2xl font-serif font-bold tracking-tight text-white">{t.tutorTitle}</h2>
          <p className="text-zinc-300 mt-2 max-w-3xl leading-relaxed text-sm">
            {t.tutorDesc}
          </p>
          
          <div className="mt-4 flex flex-wrap gap-3">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37]">
              <Sparkles className="h-3 w-3" /> {t.currentParadigm} {researchGroup === 'EXPERIMENTAL' ? t.experimentalGroup : t.control}
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-mono text-zinc-300 bg-[#1a1a1a] border border-white/10 px-3 py-1.5 rounded-full">
              {t.sessionTimeMinutes.replace('{minutes}', String(sessionMinutes))}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left side settings & shortcuts */}
        <div className="space-y-6">
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase font-mono">{t.activeTopic}</h3>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t.topicPlaceholder}
              className="w-full text-sm rounded-xl border border-white/10 p-3 focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-white"
            />
            <p className="text-xs text-zinc-500">{t.topicDesc}</p>
          </div>

          {/* Research indicator box */}
          <div className="bg-[#121212] rounded-3xl border border-white/10 p-6 space-y-3.5 shadow-sm">
            <h4 className="text-xs font-semibold text-zinc-400 font-mono uppercase tracking-wider flex items-center gap-1.5">
              <Info className="h-4.5 w-4.5 text-[#D4AF37]" /> {t.dialecticIndicators}
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center bg-[#1a1a1a] p-2.5 rounded-xl border border-white/5 text-zinc-300">
                <span>{t.guidingHits}</span>
                <span className="font-mono font-bold text-[#D4AF37]">{t.socraticModeOnly}</span>
              </div>
              <div className="flex justify-between items-center bg-[#1a1a1a] p-2.5 rounded-xl border border-white/5 text-zinc-300">
                <span>{t.spoonfedTitle}</span>
                <span className="font-mono font-bold text-rose-400">{t.controlModeOnly}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat window */}
        <div className="lg:col-span-2 flex flex-col h-[550px] bg-[#121212] border border-white/10 rounded-3xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="bg-[#1a1a1a] border-b border-white/10 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-xs font-semibold text-zinc-300 tracking-wider uppercase font-mono">{t.dialogueTitle}</span>
            </div>
            
            <span className="text-xs font-mono px-2.5 py-1 rounded bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20">
              {researchGroup === 'EXPERIMENTAL' ? t.guidedDiscovery : t.directAnswers}
            </span>
          </div>

          {/* Messages block */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((m) => {
              const isAI = m.role === 'model';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 max-w-[85%] ${
                    isAI ? 'mr-auto' : 'ml-auto flex-row-reverse'
                  }`}
                >
                  <div
                    className={`rounded-2xl p-2.5 shrink-0 h-10 w-10 flex items-center justify-center ${
                      isAI ? 'bg-white/5 text-[#D4AF37]' : 'bg-[#D4AF37]/15 text-[#D4AF37]'
                    }`}
                  >
                    {isAI ? <Bot className="h-4.5 w-4.5" /> : <User className="h-4.5 w-4.5" />}
                  </div>

                  <div className="space-y-1">
                    <div
                      className={`p-4 rounded-3xl text-sm leading-relaxed ${
                        isAI
                          ? 'chat-bubble-ai bg-[#D4AF37]/5 border-l-2 border-[#D4AF37] border-y border-r border-[#D4AF37]/10 text-zinc-150'
                          : 'bg-zinc-800 text-white border border-white/15'
                      }`}
                    >
                      {m.content}
                    </div>

                    <div className="flex items-center gap-2 px-2">
                      <span className="text-[10px] text-zinc-500 font-mono">{m.timestamp}</span>
                      {m.isHint && (
                        <span className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 mt-0.5">
                          <Lightbulb className="h-2.5 w-2.5 text-[#D4AF37]" /> Socratic Guided Cue
                        </span>
                      )}
                      {m.isDirectAnswer && (
                        <span className="bg-rose-950/40 border border-rose-900/50 text-rose-300 text-[9px] font-mono tracking-wider uppercase px-1.5 py-0.5 rounded flex items-center gap-0.5 mt-0.5">
                          <AlertCircle className="h-2.5 w-2.5 text-rose-450" /> Spoonfed Definition
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {loading && (
              <div className="flex gap-3 max-w-[70%] mr-auto">
                <div className="rounded-2xl p-2.5 bg-white/5 text-[#D4AF37] animate-pulse">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div className="bg-[#D4AF37]/5 border-l-2 border-[#D4AF37] border-y border-r border-[#D4AF37]/10 rounded-r-3xl rounded-bl-3xl p-4 text-sm text-zinc-400 italic flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="h-2 w-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-2 w-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-2 w-2 bg-[#D4AF37] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  {t.companionFormatting}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input box */}
          <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-[#1a1a1a] flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t.thinkingPrompt}
              className="flex-1 bg-[#121212] border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#D4AF37] text-white"
              disabled={loading}
              id="socratic-input-field"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-3 bg-[#D4AF37] hover:bg-[#bda13e] disabled:opacity-40 text-black rounded-xl transition cursor-pointer font-bold"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
