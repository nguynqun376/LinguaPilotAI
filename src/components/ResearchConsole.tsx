import { useState } from 'react';
import { ParticipantGroup, ResearchTelemetry } from '../types';
import { ShieldCheck, Database, Download, ToggleLeft, ToggleRight, CheckCircle2, TrendingUp } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Language, translations } from '../utils/translations';

interface ResearchConsoleProps {
  lang: Language;
  researchGroup: ParticipantGroup;
  setResearchGroup: (group: ParticipantGroup) => void;
  telemetryLogs: ResearchTelemetry[];
  addTelemetryLog: (log: ResearchTelemetry) => void;
  socraticHints: number;
  directAnswers: number;
  reflectionsCount: number;
}

export default function ResearchConsole({
  lang,
  researchGroup,
  setResearchGroup,
  telemetryLogs,
  addTelemetryLog,
  socraticHints,
  directAnswers,
  reflectionsCount,
}: ResearchConsoleProps) {
  const t = translations[lang] || translations.en;

  const [motivation, setMotivation] = useState(4);
  const [learningGain, setLearningGain] = useState(85);
  const [sessionMinutes, setSessionMinutes] = useState(30);
  const [isSaved, setIsSaved] = useState(false);

  // Submit actual active session log to the telemetry bank
  function saveCurrentSessionLog() {
    const newLog: ResearchTelemetry = {
      sessionId: `session-${Date.now()}`,
      group: researchGroup,
      durationMinutes: sessionMinutes,
      hintsUsed: socraticHints,
      directAnswersUsed: directAnswers,
      reflectionsCompleted: reflectionsCount,
      motivationRating: motivation,
      learningGainScore: learningGain,
      timestamp: new Date().toISOString(),
    };

    addTelemetryLog(newLog);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  }

  // Deep-seed group labels for charts based on active language
  const experimentalLabel = {
    en: 'Experimental (Socratic)',
    vi: 'Thử nghiệm (Socratic)',
    zh: '实验组 (苏格拉底)',
    pt: 'Experimental (Socrático)',
    es: 'Experimental (Socrático)',
    fr: 'Expérimental (Socratique)'
  }[lang] || 'Experimental (Socratic)';

  const controlLabel = {
    en: 'Control (Direct)',
    vi: 'Đối chứng (Trực tiếp)',
    zh: '对照组 (直接)',
    pt: 'Controle (Direto)',
    es: 'Control (Directo)',
    fr: 'Contrôle (Direct)'
  }[lang] || 'Control (Direct)';

  const cohortAverages = [
    {
      group: experimentalLabel,
      'Autonomy Score': 78,
      'Direct Dependencies': 2.1,
      'Feedback Reflections': 4.8,
      'Motivation Score': 4.5,
    },
    {
      group: controlLabel,
      'Autonomy Score': 41,
      'Direct Dependencies': 15.4,
      'Feedback Reflections': 1.2,
      'Motivation Score': 3.2,
    }
  ];

  const exportData = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(telemetryLogs, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    downloadAnchor.setAttribute('download', `lingua_pilot_sdl_research_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div id="research-console-container" className="space-y-8 max-w-5xl mx-auto">
      {/* Overview Banner */}
      <div className="bg-sky-950 text-white rounded-3xl p-8 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 translate-x-12 -translate-y-12 bg-sky-500/10 rounded-full blur-2xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row gap-6 items-center">
          <div className="rounded-2xl bg-sky-500/20 p-4 text-sky-300 shrink-0">
            <ShieldCheck className="h-10 w-10 text-sky-400" />
          </div>
          <div className="flex-1 space-y-2">
            <span className="text-[10px] font-mono tracking-widest text-sky-400 font-semibold uppercase">{t.groupActiveBadge}</span>
            <h2 className="text-2xl font-bold tracking-tight">{t.scholarTitle}</h2>
            <p className="text-slate-350 text-sm leading-relaxed max-w-3xl">
              {t.scholarHeaderDesc}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Paradigm controls & form */}
        <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-6">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-805 tracking-wider uppercase">{t.paradigmSelectorTitle}</h3>
            <p className="text-xs text-slate-500">{t.expGroupDesc}</p>
          </div>

          {/* Group Toggle */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-150 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-700 block">{t.groupLabel}</span>
              <span className="text-[11px] text-slate-500 mt-0.5 block font-mono">
                {researchGroup === 'EXPERIMENTAL' ? t.experimental : t.control}
              </span>
            </div>

            <button
              onClick={() => setResearchGroup(researchGroup === 'EXPERIMENTAL' ? 'CONTROL' : 'EXPERIMENTAL')}
              className="text-sky-600 transition cursor-pointer"
            >
              {researchGroup === 'EXPERIMENTAL' ? (
                <ToggleRight className="h-12 w-12 text-sky-505" />
              ) : (
                <ToggleLeft className="h-12 w-12 text-slate-4005" />
              )}
            </button>
          </div>

          {/* Telemetry Input Block */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">{t.submitSessionHeader}</h4>
            
            <div className="space-y-3.5">
              <div>
                <label className="block text-[11px] text-slate-504 font-mono mb-1">{t.minutesLabel}</label>
                <input
                  type="number"
                  value={sessionMinutes}
                  onChange={(e) => setSessionMinutes(Number(e.target.value))}
                  className="w-full text-xs rounded-xl border border-slate-200 p-2.5 bg-slate-50 text-slate-800"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-505 font-mono mb-1 font-semibold">
                  <span>{t.motivationScaleLabel}</span>
                  <span className="font-bold text-sky-600">{motivation} / 5</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={motivation}
                  onChange={(e) => setMotivation(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex justify-between text-[11px] text-slate-550 font-mono mb-1 font-semibold">
                  <span>{t.gainScoreLabel}</span>
                  <span className="font-bold text-sky-600">{learningGain}%</span>
                </div>
                <input
                  type="range"
                  min="30"
                  max="100"
                  value={learningGain}
                  onChange={(e) => setLearningGain(Number(e.target.value))}
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <button
                onClick={saveCurrentSessionLog}
                className="w-full py-2.5 text-xs bg-sky-600 hover:bg-sky-700 text-white rounded-xl font-medium transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                {isSaved ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-white" /> {t.footerActiveSession}
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" /> {t.manuallyLogBtn}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Aggregate Charts & comparative logs */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-slate-150 rounded-3xl p-6 shadow-sm space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h3 className="font-bold text-slate-800 text-sm tracking-wide uppercase">{t.telemetryTitle}</h3>
              <span className="text-xs bg-sky-50 text-sky-700 px-2 py-1 rounded font-medium">{t.groupActiveBadge}</span>
            </div>

            <div className="h-60 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cohortAverages}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="group" stroke="#64748b" fontSize={11} />
                  <YAxis stroke="#64748b" fontSize={11} />
                  <Tooltip />
                  <Legend iconSize={10} verticalAlign="top" height={36} />
                  <Bar name={t.learnerAutonomyLegend} dataKey="Autonomy Score" fill="#0ea5e9" barSize={24} />
                  <Bar name={t.motivationScaleLabel} dataKey="Motivation Score" fill="#10b981" barSize={24} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Interactive JSON Terminal Explorer */}
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl text-xs space-y-4 shadow-md font-mono text-slate-350">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-sky-400 font-semibold flex items-center gap-1.5 font-mono">
                <Database className="h-4 w-4" /> s_telemetry_archives.json ({telemetryLogs.length} {t.completed})
              </span>
              
              <button
                onClick={exportData}
                className="py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl flex items-center gap-1 cursor-pointer font-mono"
              >
                <Download className="h-3.5 w-3.5" /> {t.manuallyLogBtn}
              </button>
            </div>

            <div className="max-h-48 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-850 scrollbar-thin text-slate-300">
              <pre>{JSON.stringify(telemetryLogs, null, 2)}</pre>
            </div>
          </div>
        </div>
      </div>

      {/* Conceptual Research Framework */}
      <div className="bg-sky-50 border border-sky-100 p-8 rounded-3xl space-y-4">
        <h4 className="font-bold text-sky-950 tracking-tight flex items-center gap-1.5">
          <TrendingUp className="h-5 w-5 text-sky-600" /> {t.understandingMath}
        </h4>
        <p className="text-xs text-sky-900 max-w-4xl leading-relaxed">
          {t.mathP1}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs text-sky-900 pt-2 border-t border-sky-100/50">
          <div className="space-y-1.5">
            <p className="font-bold text-sky-950 uppercase tracking-wide">{t.tabPlanner}</p>
            <p><strong>{t.tabTutor}:</strong> {t.mathP2}</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-bold text-sky-950 uppercase tracking-wide">{t.tabJournal}</p>
            <p><strong>{t.streakTitle}:</strong> {t.growthTitle}</p>
            <p className="mt-1"><strong>{t.autonomyGauge}:</strong> {t.consistencyLocked}</p>
          </div>
          <div className="space-y-1.5">
            <p className="font-bold text-sky-950 uppercase tracking-wide">{t.tabDashboard}</p>
            <p><strong>{t.autonomyGauge}:</strong> {t.mathP3}</p>
            <p className="mt-1"><strong>{t.milestone}:</strong> {t.mathP4}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
