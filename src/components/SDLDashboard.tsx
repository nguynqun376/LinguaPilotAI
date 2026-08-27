import { ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend, AreaChart, Area, BarChart, Bar } from 'recharts';
import { StudySessionLog, ReflectionEntry, RoadmapTask } from '../types';
import { Flame, TrendingUp, Cpu, Info, Zap } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface SDLDashboardProps {
  lang: Language;
  tasks: RoadmapTask[];
  reflections: ReflectionEntry[];
  studyLogs: StudySessionLog[];
  socraticHints: number;
  directAnswers: number;
  speakingEvaluationsCount: number;
}

export default function SDLDashboard({
  lang,
  tasks,
  reflections,
  studyLogs,
  socraticHints,
  directAnswers,
  speakingEvaluationsCount,
}: SDLDashboardProps) {
  const t = translations[lang] || translations.en;
  
  // 1. Compute Autonomic Independence Score (0-100 index)
  const totalTasks = tasks.length || 10;
  const completedTasks = tasks.filter(t => t.status === 'Completed').length;
  const planningRatio = completedTasks / totalTasks;
  const reflectionsCount = reflections.length;
  const sessionsCount = studyLogs.length || 1;
  const reflectionRatio = Math.min(reflectionsCount / (sessionsCount || 1), 1);
  const activeEvaluationsRatio = Math.min(speakingEvaluationsCount / (sessionsCount || 1), 1);

  // Components of independence:
  const planningScore = planningRatio * 30; // Max 30
  const reflectionScore = reflectionRatio * 30; // Max 30
  const assessmentScore = activeEvaluationsRatio * 20; // Max 20
  
  // Socratic vs Dependency ratio:
  const totalQueries = socraticHints + directAnswers;
  const socraticRatio = totalQueries > 0 ? socraticHints / totalQueries : 1.0;
  const socraticScore = socraticRatio * 20; // Max 20

  // Penalty for requesting spoonfed direct answers
  const dependencyPenalty = directAnswers * 10; // -10 points per direct answer requested

  const independenceScore = Math.max(0, Math.min(100, Math.round(
    planningScore + reflectionScore + assessmentScore + socraticScore - dependencyPenalty
  )));

  // Calculate study streak and hours
  const studyStreak = studyLogs.length > 0 ? Math.min(studyLogs.length, 14) : 14;
  const totalStudyMinutes = studyLogs.reduce((acc, log) => acc + log.durationMinutes, 0);
  const vocabularyGrowth = Math.max(30, completedTasks * 15 + reflectionsCount * 5);

  const localizedMon = { en: "Mon", vi: "T2", zh: "周一", pt: "Seg", es: "Lun", fr: "Lun" }[lang] || "Mon";
  const localizedTue = { en: "Tue", vi: "T3", zh: "周二", pt: "Ter", es: "Mar", fr: "Mar" }[lang] || "Tue";
  const localizedWed = { en: "Wed", vi: "T4", zh: "周三", pt: "Qua", es: "Mié", fr: "Mer" }[lang] || "Wed";
  const localizedThu = { en: "Thu", vi: "T5", zh: "周四", pt: "Qui", es: "Jue", fr: "Jeu" }[lang] || "Thu";
  const localizedToday = { en: "Today", vi: "Hôm nay", zh: "今天", pt: "Hoje", es: "Hoy", fr: "Auj" }[lang] || "Today";

  // Generate charts data
  const weeklyTrendData = [
    { name: localizedMon, independence: 62, speaking: 58, vocab: 50 },
    { name: localizedTue, independence: 65, speaking: 60, vocab: 85 },
    { name: localizedWed, independence: 72, speaking: 65, vocab: 120 },
    { name: localizedThu, independence: Math.round(independenceScore * 0.9 + 5), speaking: 72, vocab: Math.round(vocabularyGrowth * 0.9) },
    { name: localizedToday, independence: independenceScore, speaking: 78, vocab: vocabularyGrowth }
  ];

  const sessionDistribution = studyLogs.map((log) => ({
    date: log.date.split('/').slice(0, 2).join('/'),
    mins: log.durationMinutes,
    type: log.sessionType,
  }));

  // Default mock data if empty
  const graphDistribution = sessionDistribution.length > 0 ? sessionDistribution : [
    { date: '05/28', mins: 30, type: 'Socratic Tutor' },
    { date: '05/29', mins: 15, type: 'Speaking Practice' },
    { date: '05/30', mins: 45, type: 'Goal Reading' },
    { date: '06/01', mins: 25, type: 'Reflection' },
    { date: 'Today', mins: Math.max(15, totalStudyMinutes), type: 'Socratic Tutor' }
  ];

  return (
    <div id="sdl-dashboard-container" className="space-y-8 max-w-5xl mx-auto">
      {/* Autonomy Level Card */}
      <div className="bg-[#121212] text-white rounded-3xl p-8 border border-white/10 shadow-xl relative overflow-hidden">
        {/* Ambient background blur */}
        <div className="absolute top-0 right-0 p-12 translate-x-12 -translate-y-12 bg-[#D4AF37]/5 rounded-full blur-3xl animate-pulse" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          
          {/* Circular Gauge adapted from the precise mockup style guide */}
          <div className="flex flex-col items-center text-center space-y-4 lg:border-r lg:border-white/5 lg:pr-8">
            <span className="text-xs font-mono text-[#D4AF37] tracking-widest uppercase font-semibold">{t.indIndex}</span>
            
            <div 
              className="relative rounded-full flex items-center justify-center" 
              style={{
                width: '130px', 
                height: '130px', 
                background: `conic-gradient(#D4AF37 ${independenceScore}%, #1a1a1a 0)`
              }}
            >
              {/* Inner core container */}
              <div className="absolute w-[116px] h-[116px] bg-[#121212] rounded-full flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight text-white">{independenceScore}%</span>
                <span className="text-[9px] font-mono tracking-widest text-[#D4AF37]/70 uppercase">{t.autonomyGauge}</span>
              </div>
            </div>

            <p className="text-xs text-zinc-400 font-medium">
              {t.trendingUp.replace('{pct}', '+4.2%')}
            </p>
          </div>

          <div className="lg:col-span-2 bg-black/20 rounded-2xl p-6 border border-white/5 text-xs space-y-4">
            <h4 className="font-mono text-[10px] font-bold text-zinc-400 tracking-wider uppercase flex items-center gap-1.5 border-b border-white/5 pb-2">
              <Cpu className="h-4 w-4 text-[#D4AF37]" /> {t.activeWeighting}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1 text-zinc-300 leading-normal">
                <p><span className="font-semibold text-[#D4AF37]">{t.roadmapAlignment}</span> {Math.round(planningScore)} pts</p>
                <p><span className="font-semibold text-amber-400">{t.metaReflection}</span> {Math.round(reflectionScore)} pts</p>
                <p><span className="font-semibold text-emerald-400">{t.dialecticSpeakingTitle}</span> {Math.round(assessmentScore)} pts</p>
              </div>
              <div className="space-y-1 text-zinc-300 leading-normal">
                <p><span className="font-semibold text-[#D4AF37]/80">{t.guidedRatio}</span> {Math.round(socraticScore)} pts</p>
                <p className="text-rose-455"><span className="font-semibold">{t.dependencyPenalty}</span> -{dependencyPenalty} pts</p>
                <p className="text-zinc-550 italic mt-1 font-mono text-[9px] leading-tight">{t.formulaText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Numerical Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">{t.goalRate}</span>
          <p className="text-2xl font-serif font-bold text-white">{Math.round(planningRatio * 100)}%</p>
          <div className="flex gap-2 text-xs text-zinc-500">
            <span>{completedTasks} {t.completed}</span>
            <span>•</span>
            <span>{totalTasks - completedTasks} {t.remaining}</span>
          </div>
        </div>

        <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">{t.streakTitle}</span>
          <p className="text-2xl font-serif font-bold text-white flex items-center gap-1.5">
            <Flame className="h-5.5 w-5.5 text-[#D4AF37] fill-[#D4AF37]/20" /> {t.streakDays.replace('{days}', String(studyStreak))}
          </p>
          <p className="text-xs text-zinc-500">{t.consistencyLocked}</p>
        </div>

        <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">{t.growthTitle}</span>
          <p className="text-2xl font-serif font-bold text-white flex items-center gap-1">
            <TrendingUp className="h-5.5 w-5.5 text-[#D4AF37]" /> +{vocabularyGrowth} <span className="text-xs font-normal text-zinc-500">{t.growthTerms}</span>
          </p>
          <p className="text-xs text-zinc-500">{t.derivedFromRoadmap}</p>
        </div>

        <div className="bg-[#121212] border border-white/10 p-6 rounded-2xl shadow-xs space-y-1">
          <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-400">{t.socDialectics}</span>
          <p className="text-2xl font-serif font-bold text-white">{socraticHints} <span className="text-xs font-normal text-zinc-500">{t.hintsCount.replace('{count}', '')}</span></p>
          <p className="text-xs text-rose-455 font-semibold">{directAnswers} {t.directAnswersSpoonfed.replace('{count}', '')}</p>
        </div>
      </div>

      {/* Main Charts block */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Independence & Speaking progress */}
        <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h4 className="font-serif font-semibold text-white text-sm tracking-wide">{t.historicalHeader}</h4>
            <span className="text-[10px] uppercase font-mono text-[#D4AF37]">{t.areaMetrics}</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyTrendData}>
                <defs>
                  <linearGradient id="colorIndependence" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#D4AF37" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSpeaking" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8c8c8c" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8c8c8c" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="name" stroke="#6b6b6b" fontSize={11} />
                <YAxis stroke="#6b6b6b" fontSize={11} domain={[30, 100]} />
                <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2c2c2c', borderRadius: '12px' }} itemStyle={{ color: '#ffffff' }} />
                <Legend iconSize={10} verticalAlign="top" height={36} />
                <Area name={t.learnerAutonomyLegend} type="monotone" dataKey="independence" stroke="#D4AF37" strokeWidth={2} fillOpacity={1} fill="url(#colorIndependence)" />
                <Area name={t.oralFluencyLegend} type="monotone" dataKey="speaking" stroke="#8c8c8c" strokeWidth={2} fillOpacity={1} fill="url(#colorSpeaking)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Study distribution logs */}
        <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <h4 className="font-serif font-semibold text-white text-sm tracking-wide">{t.sessionDistributionHeader}</h4>
            <span className="text-[10px] uppercase font-mono text-[#D4AF37]">{t.barIndicators}</span>
          </div>

          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={graphDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" />
                <XAxis dataKey="date" stroke="#6b6b6b" fontSize={11} />
                <YAxis stroke="#6b6b6b" fontSize={11} />
                <Tooltip contentStyle={{ backgroundColor: '#121212', borderColor: '#2c2c2c', borderRadius: '12px' }} />
                <Legend iconSize={10} verticalAlign="top" height={36} />
                <Bar name={t.minutesSpentLegend} dataKey="mins" fill="#D4AF37" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Model explanation modal block */}
      <div className="bg-[#121212] border border-[#D4AF37]/20 p-6 rounded-3xl space-y-3">
        <h4 className="font-serif font-bold text-white text-sm flex items-center gap-1.5 justify-start">
          <Info className="h-4.5 w-4.5 text-[#D4AF37]" /> {t.understandingMath}
        </h4>
        <div className="text-xs text-zinc-300 leading-relaxed grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <p>
              {t.mathP1}
            </p>
            <p>
              {t.mathP2}
            </p>
          </div>
          <div className="space-y-2">
            <p>
              {t.mathP3}
            </p>
            <p className="font-semibold text-[#D4AF37] flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider">
              <Zap className="h-3 w-3" /> {t.mathP4}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
