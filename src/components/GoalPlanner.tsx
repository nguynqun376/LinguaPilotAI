import { useState } from 'react';
import { UserGoalConfig, LearningRoadmap, LearningStyle, ProficiencyLevel, RoadmapTask } from '../types';
import {
  Target,
  Clock,
  Compass,
  BookOpen,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Loader2,
  Play,
  ChevronDown,
  ChevronUp,
  Globe,
  Calendar,
  CheckCircle2,
  Circle,
  Layers,
  Sparkle,
  GraduationCap
} from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface GoalPlannerProps {
  lang: Language;
  userGoal: UserGoalConfig | null;
  setUserGoal: (goal: UserGoalConfig) => void;
  roadmap: LearningRoadmap | null;
  setRoadmap: (roadmap: LearningRoadmap) => void;
  onTaskToggle: (taskId: string) => void;
  logSession: (minutes: number, type: 'Goal Reading' | 'Socratic Tutor' | 'Speaking Practice' | 'Reflection') => void;
}

export default function GoalPlanner({
  lang,
  userGoal,
  setUserGoal,
  roadmap,
  setRoadmap,
  onTaskToggle,
  logSession,
}: GoalPlannerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = translations[lang] || translations.en;

  // Multi-language selection state
  // Default selected: English
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['English']);
  // Per-language proficiency level mapping (e.g. English: Intermediate, Chinese: Beginner)
  const [languageLevels, setLanguageLevels] = useState<Record<string, ProficiencyLevel>>({
    English: 'Intermediate',
    Chinese: 'Beginner',
  });
  const [goal, setGoal] = useState('IELTS 6.5 Prep & HSK Speaking Fluency');
  const [time, setTime] = useState(30);
  const [style, setStyle] = useState<LearningStyle>('Conversational');

  // Interactive View states for Roadmap
  // When multiple languages are selected, activeLanguageView tracks which tab is currently viewed
  const [activeLanguageView, setActiveLanguageView] = useState<string>('English');
  // Collapsible week states: array of open week numbers (1, 2, 3, 4) - default week 1 is expanded
  const [expandedWeeks, setExpandedWeeks] = useState<number[]>([1]);

  const toggleWeek = (weekNum: number) => {
    if (expandedWeeks.includes(weekNum)) {
      setExpandedWeeks(expandedWeeks.filter((w) => w !== weekNum));
    } else {
      setExpandedWeeks([...expandedWeeks, weekNum]);
    }
  };

  const expandAllWeeks = () => {
    setExpandedWeeks([1, 2, 3, 4]);
  };

  const collapseAllWeeks = () => {
    setExpandedWeeks([]);
  };

  const handleLanguageToggle = (langOption: string) => {
    if (selectedLanguages.includes(langOption)) {
      // Don't allow deselecting if it's the only one left
      if (selectedLanguages.length > 1) {
        const updated = selectedLanguages.filter((l) => l !== langOption);
        setSelectedLanguages(updated);
      }
    } else {
      // Add language (limit to max 2 languages as per specification)
      if (selectedLanguages.length < 2) {
        setSelectedLanguages([...selectedLanguages, langOption]);
      } else {
        // If already 2 selected, replace with new selection
        setSelectedLanguages([selectedLanguages[1], langOption]);
      }
    }
  };

  const updateLanguageLevel = (targetLang: string, newLevel: ProficiencyLevel) => {
    setLanguageLevels((prev) => ({
      ...prev,
      [targetLang]: newLevel,
    }));
  };

  async function generatePlan(customGoal?: string, customLangs?: string[], customLevels?: Record<string, ProficiencyLevel>) {
    setLoading(true);
    setError(null);
    try {
      const langsToUse = customLangs || selectedLanguages;
      const levelsToUse = customLevels || languageLevels;
      const primaryLevel = langsToUse.length === 1 ? (levelsToUse[langsToUse[0]] || 'Intermediate') : 'Intermediate';
      const g = customGoal || goal;

      const res = await fetch('/api/generate-roadmap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetLanguage: langsToUse.join(', '),
          targetLanguages: langsToUse,
          proficiencyLevel: primaryLevel,
          languageLevels: levelsToUse,
          primaryGoal: g,
          availableMinutesPerDay: time,
          preferredStyle: style,
          uiLanguage: lang,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate roadmap from AI server');
      }

      const data = await res.json();
      
      // Save settings
      const finalGoal: UserGoalConfig = {
        targetLanguage: langsToUse.join(', '),
        targetLanguages: langsToUse,
        proficiencyLevel: primaryLevel,
        languageLevels: levelsToUse,
        primaryGoal: g,
        availableMinutesPerDay: time,
        preferredStyle: style,
        isCompleted: false,
      };
      
      setUserGoal(finalGoal);

      // Structure data correctly (add status field to tasks if missing from API)
      const tasksWithStatus = (data.tasks || []).map((task: any) => ({
        ...task,
        status: task.status || 'Pending',
      }));

      // Update roadmap state
      setRoadmap({
        goalTitle: data.goalTitle || `Mastering ${langsToUse.join(' & ')}`,
        weeksDuration: data.weeksDuration || 4,
        tasks: tasksWithStatus,
        languagePlans: data.languagePlans,
        selectedLanguages: data.selectedLanguages || langsToUse,
      });

      // Default active view to the first selected language
      setActiveLanguageView(langsToUse[0]);
      // Default to expanding Week 1
      setExpandedWeeks([1]);

      // Log setup session as automatic SDL metric
      logSession(5, 'Goal Reading');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // Pre-configured paths for quick user onboarding based on active language
  const presetGoals = {
    en: [
      { label: "IELTS 6.5 & Academic English (4 Weeks)", desc: "Reading & intensive oral strategies (5 days/week)", langs: ["English"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "IELTS 6.5 Academic Proficiency & Fluency" },
      { label: "HSK 4 & Chinese Daily Fluency (4 Weeks)", desc: "Essential Chinese characters & conversation (5 days/week)", langs: ["Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Intermediate" as ProficiencyLevel }, val: "HSK 4 Intensive Vocabulary & Expressive Speech" },
      { label: "Dual English (Intermediate) + Chinese (Beginner)", desc: "Balanced bilingual track (3 days/week each)", langs: ["English", "Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Global Bilingual Professional (IELTS 6.5 & HSK 2-3)" }
    ],
    vi: [
      { label: "Học viện IELTS 6.5 Chuyên sâu (4 Tuần)", desc: "Kỹ năng đọc & chiến lược nói phản xạ (5 ngày/tuần)", langs: ["English"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Học viện IELTS 6.5 năng lực học thuật và giao tiếp" },
      { label: "Tiếng Trung HSK 4 Giao tiếp (4 Tuần)", desc: "Luyện từ vựng, ngữ pháp & chữ Hán trọng tâm (5 ngày/tuần)", langs: ["Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Intermediate" as ProficiencyLevel }, val: "Tiếng Trung HSK 4 chuyên sâu và phản xạ đời sống" },
      { label: "Song ngữ: Anh (Trung cấp) + Trung (Sơ cấp)", desc: "Kế hoạch song song 3 ngày/tuần cho mỗi ngôn ngữ", langs: ["English", "Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Phát triển song ngữ Anh (Intermediate) & Trung (Beginner) chuẩn quốc tế" }
    ],
    zh: [
      { label: "雅思 6.5 备考精进 (4周)", desc: "深度口语输出与学术文本解构 (每周5天)", langs: ["English"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "雅思 6.5 学术能力与口语进阶" },
      { label: "HSK 4级 中文日常强化 (4周)", desc: "核心字词与听说流利度 (每周5天)", langs: ["Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Intermediate" as ProficiencyLevel }, val: "HSK 4级词汇突破与高阶交际表达" },
      { label: "英中双语方案 (英语中级 + 中文初级)", desc: "双语并行，每门语言每周3天高效轮换", langs: ["English", "Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "英中双语国际化专业沟通与学术素养" }
    ],
    pt: [
      { label: "Academia IELTS 6.5 (4 Semanas)", desc: "Estratégias de leitura e fala intensiva (5 dias/sem)", langs: ["English"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Proficiência Acadêmica IELTS 6.5" },
      { label: "Chinês HSK 4 e Fluência (4 Semanas)", desc: "Caracteres essenciais e conversação (5 dias/sem)", langs: ["Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Intermediate" as ProficiencyLevel }, val: "Vocabulário Intensivo HSK 4 e Fala Expressiva" },
      { label: "Bilinguismo: Inglês (Interm.) + Chinês (Inic.)", desc: "Trilha balanceada de 3 dias/sem por idioma", langs: ["English", "Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Domínio Global Bilíngue Inglês e Chinês" }
    ],
    es: [
      { label: "Academia IELTS 6.5 (4 Semanas)", desc: "Lectura y estrategias intensivas de habla (5 días/sem)", langs: ["English"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Competencia Académica IELTS 6.5" },
      { label: "Chino HSK 4 y Fluidez Diaria (4 Semanas)", desc: "Caracteres esenciales y conversación (5 días/sem)", langs: ["Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Intermediate" as ProficiencyLevel }, val: "Vocabulario Intensivo HSK 4 y Expresión Oral" },
      { label: "Dominio Bilingüe: Inglés (Interm.) + Chino (Princ.)", desc: "Plan dual balanceado de 3 días/sem por idioma", langs: ["English", "Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Desarrollo Profesional Bilingüe Inglés y Chino" }
    ],
    fr: [
      { label: "Académie IELTS 6.5 (4 Semaines)", desc: "Lecture et expression orale intensive (5 jours/sem)", langs: ["English"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Compétence Académique IELTS 6.5" },
      { label: "Chinois HSK 4 & Fluidité (4 Semaines)", desc: "Caractères essentiels et dialogue (5 jours/sem)", langs: ["Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Intermediate" as ProficiencyLevel }, val: "Vocabulaire Intensif HSK 4 et Expression Spontanée" },
      { label: "Parcours Bilingue : Anglais (Interm.) + Chinois (Début.)", desc: "Plan équilibré 3 jours/sem par langue", langs: ["English", "Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Excellence Bilingue Globale Anglais et Chinois" }
    ]
  }[lang] || [
    { label: "IELTS 6.5 & Academic English (4 Weeks)", desc: "Reading & intensive oral strategies (5 days/week)", langs: ["English"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "IELTS 6.5 Academic Proficiency & Fluency" },
    { label: "HSK 4 & Chinese Daily Fluency (4 Weeks)", desc: "Essential Chinese characters & conversation (5 days/week)", langs: ["Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Intermediate" as ProficiencyLevel }, val: "HSK 4 Intensive Vocabulary & Expressive Speech" },
    { label: "Dual English (Intermediate) + Chinese (Beginner)", desc: "Balanced bilingual track (3 days/week each)", langs: ["English", "Chinese"], levels: { English: "Intermediate" as ProficiencyLevel, Chinese: "Beginner" as ProficiencyLevel }, val: "Global Bilingual Professional (IELTS 6.5 & HSK 4)" }
  ];

  // Determine current active language filter in Roadmap view
  const isDualTrack = (roadmap?.selectedLanguages && roadmap.selectedLanguages.length > 1) || 
                      (userGoal?.targetLanguages && userGoal.targetLanguages.length > 1);

  // Available languages in the current roadmap
  const roadmapLangs: string[] = roadmap?.selectedLanguages || 
    (userGoal?.targetLanguages && userGoal.targetLanguages.length > 0 ? userGoal.targetLanguages : ['English']);

  // Filter tasks based on active language view if dual track
  const currentViewTasks = roadmap?.tasks.filter((t) => {
    if (!isDualTrack) return true;
    if (!t.language) return true;
    return t.language.toLowerCase() === activeLanguageView.toLowerCase();
  }) || [];

  const completedCount = currentViewTasks.filter((t) => t.status === 'Completed').length;
  const totalCount = currentViewTasks.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div id="goal-planner-container" className="space-y-8 max-w-5xl mx-auto">
      {/* Introduction Card */}
      <div className="bg-[#121212] border border-[#D4AF37]/20 rounded-3xl p-8 flex flex-col md:flex-row gap-6 items-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 translate-x-12 -translate-y-12 bg-[#D4AF37]/5 rounded-full blur-2xl" />
        <div className="rounded-2xl bg-[#D4AF37]/10 p-4 text-[#D4AF37] shrink-0 relative z-10 border border-[#D4AF37]/20">
          <Target className="h-10 w-10" />
        </div>
        <div className="relative z-10 space-y-1 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-serif font-bold tracking-tight text-white mb-1">
              {t.plannerTitle}
            </h2>
            <span className="text-xs font-mono tracking-widest text-[#D4AF37] font-semibold uppercase px-2.5 py-0.5 bg-[#D4AF37]/10 rounded-full border border-[#D4AF37]/20">
              {t.milestone}
            </span>
          </div>
          <p className="text-zinc-300 mt-2 max-w-3xl leading-relaxed text-sm">
            {t.plannerDesc}
          </p>
        </div>
      </div>

      {!roadmap ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Assessment Form */}
          <div className="lg:col-span-2 bg-[#121212] rounded-3xl border border-white/10 p-8 shadow-sm space-y-6">
            <h3 className="text-lg font-serif font-medium text-white flex items-center gap-2 border-b border-white/5 pb-4">
              <Compass className="h-5 w-5 text-[#D4AF37]" /> {t.profileSetup}
            </h3>

            {error && (
              <div className="p-4 bg-rose-950/40 text-rose-350 rounded-xl text-sm font-medium border border-rose-900/50">
                {error}
              </div>
            )}

            {/* Target Language Selection with Chinese Support & Multi-selection */}
            <div className="space-y-3 bg-[#171717] p-4.5 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-mono text-[#D4AF37] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" /> {t.targetLanguage}
                </label>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-zinc-400 border border-white/10">
                  {selectedLanguages.length === 1 ? t.oneLangBadge : t.twoLangBadge}
                </span>
              </div>

              {/* Language Selection Buttons */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* English Option */}
                <button
                  type="button"
                  onClick={() => handleLanguageToggle('English')}
                  className={`p-4 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedLanguages.includes('English')
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-sm shadow-[#D4AF37]/10'
                      : 'bg-[#1e1e1e] border-white/10 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇬🇧</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm block text-white">{t.englishOptionLabel}</span>
                        {selectedLanguages.includes('English') && (
                          <span className="text-[10px] font-mono bg-[#D4AF37]/20 text-[#D4AF37] px-1.5 py-0.2 rounded border border-[#D4AF37]/30">
                            {languageLevels['English'] || 'Intermediate'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400">{t.englishOptionDesc}</span>
                    </div>
                  </div>
                  {selectedLanguages.includes('English') ? (
                    <CheckCircle2 className="h-5 w-5 text-[#D4AF37] shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-zinc-600 shrink-0" />
                  )}
                </button>

                {/* Chinese Option */}
                <button
                  type="button"
                  onClick={() => handleLanguageToggle('Chinese')}
                  className={`p-4 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                    selectedLanguages.includes('Chinese')
                      ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white shadow-sm shadow-[#D4AF37]/10'
                      : 'bg-[#1e1e1e] border-white/10 text-zinc-400 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🇨🇳</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm block text-white">{t.chineseOptionLabel}</span>
                        {selectedLanguages.includes('Chinese') && (
                          <span className="text-[10px] font-mono bg-[#D4AF37]/20 text-[#D4AF37] px-1.5 py-0.2 rounded border border-[#D4AF37]/30">
                            {languageLevels['Chinese'] || 'Beginner'}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-zinc-400">{t.chineseOptionDesc}</span>
                    </div>
                  </div>
                  {selectedLanguages.includes('Chinese') ? (
                    <CheckCircle2 className="h-5 w-5 text-[#D4AF37] shrink-0" />
                  ) : (
                    <Circle className="h-5 w-5 text-zinc-600 shrink-0" />
                  )}
                </button>
              </div>

              {/* Notice & Rule helper */}
              <p className="text-xs text-zinc-400 leading-relaxed pt-1 bg-black/20 p-2.5 rounded-lg border border-white/5 font-mono text-[11px]">
                {t.targetLanguageHint}
              </p>
            </div>

            {/* Proficiency Level Selection Section: Distinct Selector per Selected Language */}
            {selectedLanguages.length > 1 && (
              <div className="bg-[#171717] p-4.5 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-mono text-[#D4AF37] uppercase tracking-widest font-semibold flex items-center gap-1.5">
                    <GraduationCap className="h-3.5 w-3.5" /> {t.configureLevelsTitle}
                  </label>
                  <span className="text-[10px] font-mono text-zinc-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                    2 Levels Active
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* English Level Selector */}
                  <div className="bg-[#1e1e1e] p-3.5 rounded-xl border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>🇬🇧</span> {t.englishLevelLabel}
                      </span>
                      <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20">
                        {languageLevels['English'] === 'Beginner' ? t.levelBeginner : languageLevels['English'] === 'Advanced' ? t.levelAdvanced : t.levelIntermediate}
                      </span>
                    </div>
                    <select
                      value={languageLevels['English'] || 'Intermediate'}
                      onChange={(e) => updateLanguageLevel('English', e.target.value as ProficiencyLevel)}
                      className="w-full rounded-lg border border-white/10 p-2.5 text-xs focus:outline-none focus:border-[#D4AF37] bg-[#141414] text-zinc-200 cursor-pointer"
                    >
                      <option value="Beginner">{t.levelBeginner}</option>
                      <option value="Intermediate">{t.levelIntermediate}</option>
                      <option value="Advanced">{t.levelAdvanced}</option>
                    </select>
                  </div>

                  {/* Chinese Level Selector */}
                  <div className="bg-[#1e1e1e] p-3.5 rounded-xl border border-white/10 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <span>🇨🇳</span> {t.chineseLevelLabel}
                      </span>
                      <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20">
                        {languageLevels['Chinese'] === 'Intermediate' ? t.levelIntermediate : languageLevels['Chinese'] === 'Advanced' ? t.levelAdvanced : t.levelBeginner}
                      </span>
                    </div>
                    <select
                      value={languageLevels['Chinese'] || 'Beginner'}
                      onChange={(e) => updateLanguageLevel('Chinese', e.target.value as ProficiencyLevel)}
                      className="w-full rounded-lg border border-white/10 p-2.5 text-xs focus:outline-none focus:border-[#D4AF37] bg-[#141414] text-zinc-200 cursor-pointer"
                    >
                      <option value="Beginner">{t.levelBeginner}</option>
                      <option value="Intermediate">{t.levelIntermediate}</option>
                      <option value="Advanced">{t.levelAdvanced}</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Study Parameters (Time, Learning Style, & Single-lang Level if 1 lang selected) */}
            <div className={`grid grid-cols-1 ${selectedLanguages.length === 1 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-5`}>
              {selectedLanguages.length === 1 && (
                <div>
                  <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                    <GraduationCap className="h-3 w-3 text-[#D4AF37]" />
                    {selectedLanguages[0] === 'English' ? t.englishLevelLabel : t.chineseLevelLabel}
                  </label>
                  <select
                    value={languageLevels[selectedLanguages[0]] || 'Intermediate'}
                    onChange={(e) => updateLanguageLevel(selectedLanguages[0], e.target.value as ProficiencyLevel)}
                    className="w-full rounded-xl border border-white/10 p-3 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-zinc-200 cursor-pointer"
                  >
                    <option value="Beginner">{t.levelBeginner}</option>
                    <option value="Intermediate">{t.levelIntermediate}</option>
                    <option value="Advanced">{t.levelAdvanced}</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-[#D4AF37]" /> {t.minutesPerDay}
                </label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={time}
                  onChange={(e) => setTime(Number(e.target.value))}
                  className="w-full rounded-xl border border-white/10 p-3 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                  <BookOpen className="h-3 w-3 text-[#D4AF37]" /> {t.preferredStyle}
                </label>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value as LearningStyle)}
                  className="w-full rounded-xl border border-white/10 p-3 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-zinc-200 cursor-pointer"
                >
                  <option value="Conversational">{t.styleConversational}</option>
                  <option value="Visual">{t.styleVisual}</option>
                  <option value="Auditory">{t.styleAuditory}</option>
                  <option value="Reading/Writing">{t.styleReadingWriting}</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-widest mb-2">{t.primaryGoal}</label>
              <input
                type="text"
                placeholder={t.goalPlaceholder || "e.g. IELTS 6.5 Prep, HSK 4 Fluency, Business Tech Speaking..."}
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                className="w-full rounded-xl border border-white/10 p-3.5 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-white"
              />
            </div>

            <button
              onClick={() => generatePlan()}
              disabled={loading || selectedLanguages.length === 0}
              className="w-full py-4 bg-[#D4AF37] text-[#080808] hover:bg-[#bda13e] rounded-xl font-bold transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shadow-md shadow-[#D4AF37]/10 uppercase tracking-widest text-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  {t.generating}
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" /> {t.generateButton} (4 {t.weekLabel})
                </>
              )}
            </button>
          </div>

          {/* Preset Prompts / Quick Start */}
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 lg:p-8 space-y-6 shadow-sm">
            <div>
              <h4 className="text-xs font-semibold text-zinc-400 tracking-wider uppercase font-mono">{t.presetTitle}</h4>
            </div>

            <div className="space-y-4">
              {presetGoals.map((track, i) => (
                <button
                  key={i}
                  disabled={loading}
                  onClick={() => {
                    if (track.langs) {
                      setSelectedLanguages(track.langs);
                    }
                    if (track.levels) {
                      setLanguageLevels(track.levels);
                    }
                    setGoal(track.val);
                    generatePlan(track.val, track.langs, track.levels);
                  }}
                  className="w-full text-left bg-[#1a1a1a] border border-white/5 p-4 rounded-2xl hover:border-[#D4AF37] transition group ease-in-out cursor-pointer text-white"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-serif font-semibold text-zinc-200 group-hover:text-[#D4AF37] transition">{track.label}</span>
                    <Play className="h-3.5 w-3.5 text-zinc-500 group-hover:text-[#D4AF37] transition shrink-0" />
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">{track.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Actionable 4-Week Collapsible Roadmap Browser */
        <div className="space-y-6">
          {/* Header Overview Card */}
          <div className="bg-[#121212] rounded-3xl border border-white/10 p-6 md:p-8 shadow-sm space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-[#D4AF37] uppercase tracking-widest font-semibold">
                    {t.yourAcademicRoadmap}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 bg-[#D4AF37]/10 text-[#D4AF37] rounded-full border border-[#D4AF37]/20 font-bold">
                    4 {t.weekLabel} (4 WEEKS)
                  </span>
                </div>
                <h3 className="text-2xl font-serif font-bold text-white mt-1.5">{roadmap.goalTitle}</h3>
                <p className="text-xs text-zinc-400 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {isDualTrack ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        <span>🇬🇧</span> <span className="text-zinc-400">{t.englishOptionLabel}:</span> <span className="font-semibold text-[#D4AF37]">{userGoal?.languageLevels?.['English'] || 'Intermediate'}</span>
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1.5">
                        <span>🇨🇳</span> <span className="text-zinc-400">{t.chineseOptionLabel}:</span> <span className="font-semibold text-[#D4AF37]">{userGoal?.languageLevels?.['Chinese'] || 'Beginner'}</span>
                      </span>
                    </>
                  ) : (
                    <span>{t.languageLevel}: <span className="font-semibold text-zinc-200">{userGoal?.languageLevels?.[roadmapLangs[0]] || userGoal?.proficiencyLevel || 'Intermediate'}</span></span>
                  )}
                  <span>|</span>
                  <span>{t.preferredStyle}: <span className="font-semibold text-zinc-200">{userGoal?.preferredStyle}</span></span>
                  <span>|</span>
                  <span>{t.minutesPerDay}: <span className="font-semibold text-zinc-200">{userGoal?.availableMinutesPerDay}m</span></span>
                </p>
              </div>
              
              <button
                onClick={() => {
                  setUserGoal(null as any);
                  setRoadmap(null as any);
                }}
                className="py-2.5 px-4 text-xs font-medium text-zinc-300 border border-white/10 hover:text-rose-400 hover:border-rose-455 rounded-xl bg-white/5 flex items-center gap-1.5 transition cursor-pointer self-start"
              >
                <RefreshCw className="h-3.5 w-3.5" /> {t.rebuildButton}
              </button>
            </div>

            {/* Language Switcher Bar (Appears when 2 languages or multi-language plan is active) */}
            {isDualTrack && (
              <div className="bg-[#181818] p-4 rounded-2xl border border-[#D4AF37]/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="text-xs font-mono text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-[#D4AF37]" /> {t.switchLanguageView}
                  </span>
                  <span className="text-[11px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-0.5 rounded-full border border-[#D4AF37]/20">
                    {t.dualLangModeBadge}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {roadmapLangs.map((l) => {
                    const isEnglish = l.toLowerCase().includes('english');
                    const isChinese = l.toLowerCase().includes('chinese');
                    const isActive = activeLanguageView.toLowerCase() === l.toLowerCase();

                    // Calculate stats for this specific language
                    const langTasks = roadmap.tasks.filter((tk) => (tk.language || '').toLowerCase() === l.toLowerCase());
                    const langCompleted = langTasks.filter((tk) => tk.status === 'Completed').length;
                    const langTotal = langTasks.length;

                    return (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setActiveLanguageView(l)}
                        className={`p-3.5 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                          isActive
                            ? 'bg-[#D4AF37] text-black border-[#D4AF37] font-bold shadow-md shadow-[#D4AF37]/20'
                            : 'bg-[#222222] border-white/10 text-zinc-300 hover:border-white/25'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{isEnglish ? '🇬🇧' : isChinese ? '🇨🇳' : '🌐'}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold block">
                                {isEnglish ? t.englishOptionLabel : isChinese ? t.chineseOptionLabel : l}
                              </span>
                              <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                                isActive 
                                  ? 'bg-black/20 text-black border-black/30' 
                                  : 'bg-[#D4AF37]/20 text-[#D4AF37] border-[#D4AF37]/30'
                              }`}>
                                {userGoal?.languageLevels?.[isEnglish ? 'English' : isChinese ? 'Chinese' : l] || 'Intermediate'}
                              </span>
                            </div>
                            <span className={`text-[11px] font-mono ${isActive ? 'text-black/80' : 'text-zinc-400'}`}>
                              {(t.taskTrackSubtext || '{completed}/{total} tasks • 3 days/week')
                                .replace('{completed}', String(langCompleted))
                                .replace('{total}', String(langTotal))}
                            </span>
                          </div>
                        </div>
                        {isActive && (
                          <CheckCircle2 className="h-5 w-5 text-black shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Single Language Mode Indicator if 1 language */}
            {!isDualTrack && (
              <div className="flex items-center justify-between bg-[#181818] px-4 py-2.5 rounded-xl border border-white/5 text-xs">
                <div className="flex items-center gap-2 text-zinc-300">
                  <span className="text-lg">
                    {roadmapLangs[0]?.toLowerCase().includes('chinese') ? '🇨🇳' : '🇬🇧'}
                  </span>
                  <span className="font-semibold text-white">
                    {roadmapLangs[0]?.toLowerCase().includes('chinese') ? t.chineseOptionLabel : t.englishOptionLabel}
                  </span>
                  <span className="text-[10px] font-mono bg-[#D4AF37]/20 text-[#D4AF37] px-1.5 py-0.2 rounded border border-[#D4AF37]/30">
                    {userGoal?.languageLevels?.[roadmapLangs[0]] || userGoal?.proficiencyLevel || 'Intermediate'}
                  </span>
                  <span className="text-zinc-500">•</span>
                  <span className="text-zinc-400 font-mono">{t.singleLangModeBadge}</span>
                </div>
                <div className="text-zinc-400 font-mono text-[11px]">
                  {completedCount}/{totalCount} {t.completeTask.toLowerCase()} ({completionPercentage}%)
                </div>
              </div>
            )}

            {/* Expand / Collapse Controls */}
            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[#D4AF37]" />
                <span className="text-sm font-serif font-semibold text-white">
                  {(t.detailed4WeeksPlan || 'Detailed 4-Week Plan ({days} days/week)').replace('{days}', isDualTrack ? '3' : '5')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={expandAllWeeks}
                  className="px-2.5 py-1 text-[11px] font-mono text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition border border-white/5"
                >
                  {t.expandAll4Weeks}
                </button>
                <button
                  type="button"
                  onClick={collapseAllWeeks}
                  className="px-2.5 py-1 text-[11px] font-mono text-zinc-400 hover:text-zinc-200 bg-white/5 hover:bg-white/10 rounded-lg transition border border-white/5"
                >
                  {t.collapseAllWeeks}
                </button>
              </div>
            </div>
          </div>

          {/* 4 Collapsible Weeks Accordion List */}
          <div className="space-y-4">
            {[1, 2, 3, 4].map((weekNum) => {
              const weekTasks = currentViewTasks.filter((t) => t.week === weekNum);
              const isExpanded = expandedWeeks.includes(weekNum);
              const weekCompleted = weekTasks.filter((t) => t.status === 'Completed').length;
              const weekTotal = weekTasks.length;
              const isWeekFullyDone = weekTotal > 0 && weekCompleted === weekTotal;

              return (
                <div
                  key={weekNum}
                  className={`bg-[#121212] border rounded-3xl transition overflow-hidden shadow-sm ${
                    isExpanded ? 'border-[#D4AF37]/40 ring-1 ring-[#D4AF37]/15' : 'border-white/10 hover:border-white/20'
                  }`}
                >
                  {/* Clickable Week Header */}
                  <button
                    type="button"
                    onClick={() => toggleWeek(weekNum)}
                    className="w-full p-5 md:p-6 text-left flex items-center justify-between cursor-pointer hover:bg-white/[0.02] transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`p-2.5 rounded-xl border flex items-center justify-center shrink-0 ${
                        isWeekFullyDone 
                          ? 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50' 
                          : isExpanded 
                            ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30' 
                            : 'bg-white/5 text-zinc-400 border-white/10'
                      }`}>
                        {isWeekFullyDone ? (
                          <CheckCircle className="h-5 w-5" />
                        ) : (
                          <BookOpen className="h-5 w-5" />
                        )}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-serif font-bold text-base md:text-lg text-white">
                            {t.weekLabel} {weekNum}
                          </h4>
                          {isWeekFullyDone && (
                            <span className="text-[10px] font-mono px-2 py-0.5 bg-emerald-950/60 text-emerald-300 rounded-full border border-emerald-800/40">
                              {t.weekCompletedBadge}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 mt-0.5 flex items-center gap-2">
                          <span>
                            {(t.studyDaysCount || '{days} study days').replace('{days}', String(weekTotal))}
                          </span>
                          <span>•</span>
                          <span className="text-zinc-300 font-mono">
                            {(t.tasksCompletedCount || '{completed}/{total} tasks completed')
                              .replace('{completed}', String(weekCompleted))
                              .replace('{total}', String(weekTotal))}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Week Progress indicator */}
                      <div className="hidden sm:block text-right">
                        <div className="w-24 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              isWeekFullyDone ? 'bg-emerald-400' : 'bg-[#D4AF37]'
                            }`}
                            style={{ width: `${weekTotal > 0 ? (weekCompleted / weekTotal) * 100 : 0}%` }}
                          />
                        </div>
                      </div>

                      <div className="p-1.5 rounded-lg bg-white/5 text-zinc-400">
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-[#D4AF37]" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-zinc-400" />
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Collapsible Content */}
                  {isExpanded && (
                    <div className="px-5 pb-6 md:px-6 md:pb-6 pt-2 border-t border-white/5 space-y-3.5 bg-black/20">
                      {weekTasks.length === 0 ? (
                        <div className="p-6 text-center text-zinc-500 text-sm font-mono">
                          {t.noTasksInWeek}
                        </div>
                      ) : (
                        weekTasks.map((task) => (
                          <RoadmapTaskRow
                            key={task.id}
                            task={task}
                            onToggle={onTaskToggle}
                            lang={lang}
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface RoadmapRowProps {
  key?: string;
  task: RoadmapTask;
  onToggle: (taskId: string) => void;
  lang: Language;
}

function RoadmapTaskRow({ task, onToggle, lang }: RoadmapRowProps) {
  const isCompleted = task.status === 'Completed';
  const t = translations[lang] || translations.en;

  // Category specific styles mapped for dark theme contrast
  const categoryColor = {
    Vocabulary: 'bg-indigo-950/40 text-indigo-300 border border-indigo-900/40',
    Reading: 'bg-blue-950/40 text-blue-300 border border-blue-900/40',
    Speaking: 'bg-emerald-950/40 text-emerald-300 border border-emerald-900/40',
    Grammar: 'bg-purple-950/40 text-purple-300 border border-purple-900/40',
    Reflection: 'bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20',
  }[task.category] || 'bg-zinc-900 text-zinc-300 border border-zinc-800';

  return (
    <div
      className={`p-4 rounded-2xl border transition flex items-start gap-3.5 ${
        isCompleted
          ? 'bg-zinc-900/40 border-zinc-800 text-zinc-500'
          : 'bg-[#181818] border-white/10 hover:border-[#D4AF37]/50 hover:shadow-xs text-white'
      }`}
    >
      <input
        type="checkbox"
        id={task.id}
        checked={isCompleted}
        onChange={() => onToggle(task.id)}
        className="mt-1 h-5 w-5 rounded text-[#D4AF37] focus:ring-[#D4AF37] bg-zinc-900 border-white/20 cursor-pointer accent-[#D4AF37]"
      />
      
      <div className="space-y-1.5 select-none flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono font-bold tracking-wider uppercase text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/20">
            {t.dayLabel} {task.day}
          </span>
          <span className={`text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full uppercase ${categoryColor}`}>
            {task.category}
          </span>
          {task.language && (
            <span className="text-[10px] font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/5 text-zinc-300 border border-white/10">
              {task.language.toLowerCase().includes('chinese') ? t.chineseOptionLabel : t.englishOptionLabel}
            </span>
          )}
          <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono ml-auto">
            <Clock className="h-3 w-3 inline text-[#D4AF37]" /> {task.durationMinutes}m
          </span>
        </div>
        <label htmlFor={task.id} className={`text-sm font-semibold block cursor-pointer leading-tight ${isCompleted ? 'line-through text-zinc-500' : 'text-zinc-100'}`}>
          {task.title}
        </label>
        <p className={`text-xs mt-1 leading-relaxed ${isCompleted ? 'text-zinc-500 line-through' : 'text-zinc-400'}`}>
          {task.description}
        </p>
      </div>
    </div>
  );
}
