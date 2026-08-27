import React, { useState, useEffect } from 'react';
import { ReflectionEntry } from '../types';
import { BookOpen, PenTool, Calendar, Loader2, Sparkles } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface ReflectionJournalProps {
  lang: Language;
  reflections: ReflectionEntry[];
  addReflection: (entry: ReflectionEntry) => void;
  logSession: (minutes: number, type: 'Goal Reading' | 'Socratic Tutor' | 'Speaking Practice' | 'Reflection') => void;
}

export default function ReflectionJournal({
  lang,
  reflections,
  addReflection,
  logSession,
}: ReflectionJournalProps) {
  const t = translations[lang] || translations.en;

  const [learned, setLearned] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [strategy, setStrategy] = useState('Retrieval Practice/Ask Counter Questions');
  const [nextStep, setNextStep] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionMinutes, setSessionMinutes] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setSessionMinutes((prev) => {
        const next = prev + 1;
        logSession(1, 'Reflection');
        return next;
      });
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!learned.trim() || !difficulty.trim() || !nextStep.trim() || loading) return;

    setLoading(true);

    try {
      const res = await fetch('/api/reflection-insight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learnedToday: learned,
          difficultiesFaced: difficulty,
          strategyUsed: strategy,
          nextSteps: nextStep,
          uiLanguage: lang,
        }),
      });

      if (!res.ok) throw new Error('Insight API failed');
      const data = await res.json();

      const newEntry: ReflectionEntry = {
        id: `ref-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        learnedToday: learned,
        difficultiesFaced: difficulty,
        strategyUsed: strategy,
        nextSteps: nextStep,
        aiSuggestedInsight: data.insight,
      };

      addReflection(newEntry);
      
      // Reset form
      setLearned('');
      setDifficulty('');
      setNextStep('');
      
      // Log session
      logSession(5, 'Reflection');
    } catch (err) {
      console.error(err);
      const fallbackInsights: Record<Language, string> = {
        zh: `出色的元认知反思！通过深度评估“${strategy}”学习策略，您正在自主构建韧性知识回路。建议明天进行间隔检索以固化该难点。`,
        vi: `Trọng tâm phản tư nhận thức xuất sắc! Bằng việc đánh giá chiến lược "${strategy}", bạn đang củng cố khả năng tự chủ học tập. Hãy duy trì thói quen truy xuất chủ động này vào ngày mai!`,
        en: `Excellent metacognitive focus! By reviewing your strategy of "${strategy}", you are constructing resilient knowledge structures. Plan to test active recall tomorrow!`,
        pt: `Excelente foco metacognitivo! Ao analisar sua estratégia de "${strategy}", você está construindo estruturas de conhecimento sólidas. Pratique a recuperação ativa amanhã!`,
        es: `¡Excelente enfoque metacognitivo! Al evaluar tu estrategia de "${strategy}", estás fortaleciendo tu aprendizaje autónomo. ¡Prueba la recuperación activa mañana!`,
        fr: `Excellent travail métacognitif ! En analysant votre stratégie "${strategy}", vous développez votre autonomie d’apprentissage. Pensez au rappel actif demain !`
      };

      const fallbackEntry: ReflectionEntry = {
        id: `ref-${Date.now()}`,
        date: new Date().toLocaleDateString(),
        learnedToday: learned,
        difficultiesFaced: difficulty,
        strategyUsed: strategy,
        nextSteps: nextStep,
        aiSuggestedInsight: fallbackInsights[lang] || fallbackInsights.en,
      };
      addReflection(fallbackEntry);
      
      setLearned('');
      setDifficulty('');
      setNextStep('');
    } finally {
      setLoading(false);
    }
  }

  const cognitiveStrategies = {
    en: [
      "Retrieval Practice / Ask Counter Questions",
      "Spaced Repetition / Card Testing",
      "Contextual Association (Memory Palace)",
      "Feynman Technique (Teach the imaginary student)",
      "Contrastive Sentence Translation Auditing"
    ],
    vi: [
      "Thực hành Gợi nhớ / Đặt Câu hỏi ngược",
      "Lặp lại Ngắt quãng / Trắc nghiệm thẻ từ",
      "Liên kết Bối cảnh (Cung điện Ký ức)",
      "Kỹ thuật Feynman (Giảng giải cho học sinh tưởng tượng)",
      "Kiểm tra Đối chiếu Bản dịch Câu"
    ],
    zh: [
      "检索式实践与反向提问法",
      "间隔重复法与卡片自测",
      "语境联想法（记忆宫殿）",
      "费曼学习法（向虚拟学生讲解）",
      "对比式句子翻译审计"
    ],
    pt: [
      "Prática de Recuperação / Fazer Contra-Perguntas",
      "Repetição Espaçada / Teste com Flashcards",
      "Associação Contextual (Palácio da Memória)",
      "Técnica Feynman (Ensinar ao estudante imaginário)",
      "Auditoria de Tradução de Sentenças Contrastantes"
    ],
    es: [
      "Práctica de Recuperación / Hacer Contra-Preguntas",
      "Repetición Espaciada / Autoevaluación táctil",
      "Asociación Contextual (Palacio de la Memoria)",
      "Técnica Feynman (Enseñar al estudiante imaginario)",
      "Auditoría de Traducción de Oraciones Contrastivas"
    ],
    fr: [
      "Pratique de Récupération / Poser des contre-questions",
      "Répétition Espacée / Test par cartes-mémoires",
      "Association Contextuelle (Palais de la mémoire)",
      "Technique Feynman (Enseigner à un élève imaginaire)",
      "Audit de Traduction de Phrases Contrastives"
    ]
  }[lang] || [
    "Retrieval Practice / Ask Counter Questions",
    "Spaced Repetition / Card Testing",
    "Contextual Association (Memory Palace)",
    "Feynman Technique (Teach the imaginary student)",
    "Contrastive Sentence Translation Auditing"
  ];

  // Set initial strategy
  useEffect(() => {
    if (cognitiveStrategies && cognitiveStrategies[0]) {
      setStrategy(cognitiveStrategies[0]);
    }
  }, [lang]);

  return (
    <div id="reflection-journal-container" className="space-y-8 max-w-5xl mx-auto">
      {/* Informational Banner */}
      <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row gap-6 items-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 translate-x-12 -translate-y-12 bg-[#D4AF37]/5 rounded-full blur-2xl" />
        <div className="rounded-2xl bg-[#D4AF37]/10 p-4 text-[#D4AF37] shrink-0 border border-[#D4AF37]/20 relative z-10">
          <BookOpen className="h-10 w-10" />
        </div>
        <div className="flex-1 relative z-10">
          <h2 className="text-2xl font-serif font-bold tracking-tight text-white mb-1">{t.reflectionMainTitle}</h2>
          <p className="text-zinc-350 mt-2 max-w-3xl leading-relaxed text-sm">
            {t.reflectionDesc}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/30 font-semibold px-3 py-1.5 rounded-full inline-block">
              {t.queSpent.replace('{minutes}', String(sessionMinutes))}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* Input Journal Form */}
        <div className="lg:col-span-3 bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-sm space-y-6">
          <h3 className="text-lg font-serif font-bold text-white flex items-center gap-2 border-b border-white/5 pb-4">
            <PenTool className="h-5 w-5 text-[#D4AF37]" /> {t.logTodayJournal}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 font-medium">{t.q1}</label>
              <textarea
                value={learned}
                onChange={(e) => setLearned(e.target.value)}
                placeholder={t.q1Placeholder}
                className="w-full h-20 rounded-xl border border-white/10 p-3 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-white resize-none"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 font-medium">{t.q2}</label>
              <textarea
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                placeholder={t.q2Placeholder}
                className="w-full h-20 rounded-xl border border-white/10 p-3 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-white resize-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 font-medium">{t.q3}</label>
                <select
                  value={strategy}
                  onChange={(e) => setStrategy(e.target.value)}
                  className="w-full p-3 rounded-xl border border-white/10 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-zinc-300 cursor-pointer"
                >
                  {cognitiveStrategies.map((strat, i) => (
                    <option key={i} value={strat}>{strat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-1.5 font-medium">{t.q4}</label>
                <input
                  type="text"
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder={t.q4Placeholder}
                  className="w-full p-3 rounded-xl border border-white/10 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-white"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !learned.trim() || !difficulty.trim()}
              className="w-full py-4 bg-[#D4AF37] hover:bg-[#bda13e] text-black font-bold uppercase rounded-xl tracking-wider text-xs transition cursor-pointer disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" /> {t.queryingCoach}
                </>
              ) : (
                <>
                  <Sparkles className="h-4.5 w-4.5" /> {t.saveBtn}
                </>
              )}
            </button>
          </form>
        </div>

        {/* Previous Reflections List */}
        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xs font-semibold text-zinc-400 tracking-wider font-mono uppercase">{t.archiveTitle}</h3>

          {reflections.length === 0 ? (
            <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 text-center space-y-2 text-zinc-400">
              <p className="text-sm font-medium">{t.noReflections}</p>
              <p className="text-xs text-zinc-500">{t.noReflectionsDesc}</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              {reflections.map((ref) => (
                <div key={ref.id} className="bg-[#121212] border border-white/10 rounded-2xl p-5 space-y-4 shadow-xs">
                  <div className="flex justify-between items-center bg-[#1a1a1a] border-b border-white/5 -m-5 mb-0 px-5 py-3 rounded-t-2xl">
                    <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-[#D4AF37]" /> {ref.date}
                    </span>
                    <span className="bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded-full">
                      {t.strategyEvaluated}
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div>
                      <p className="font-semibold text-zinc-500 font-mono uppercase tracking-widest text-[9px]">{t.learnedText}:</p>
                      <p className="text-zinc-200 leading-normal mt-0.5">{ref.learnedToday}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-500 font-mono uppercase tracking-widest text-[9px]">{t.difficultyText}:</p>
                      <p className="text-zinc-200 leading-normal mt-0.5">{ref.difficultiesFaced}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-zinc-500 font-mono uppercase tracking-widest text-[9px]">{t.tacticalText}:</p>
                      <p className="text-[#D4AF37] font-semibold mt-0.5">{ref.strategyUsed}</p>
                    </div>
                  </div>

                  {ref.aiSuggestedInsight && (
                    <div className="p-4 bg-[#D4AF37]/10 rounded-xl border border-[#D4AF37]/20 text-xs text-zinc-200 leading-normal space-y-1">
                      <p className="font-semibold flex items-center gap-1 text-[#D4AF37]">
                        <Sparkles className="h-3 w-3" /> {t.coachInsight}
                      </p>
                      <p className="italic">"{ref.aiSuggestedInsight}"</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
