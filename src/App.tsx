import { useState, useEffect, useRef } from 'react';
import {
  UserGoalConfig,
  LearningRoadmap,
  ReflectionEntry,
  StudySessionLog,
  ParticipantGroup,
  ResearchTelemetry,
  RoadmapTask
} from './types';
import GoalPlanner from './components/GoalPlanner';
import SocraticTutor from './components/SocraticTutor';
import SpeakingPartner from './components/SpeakingPartner';
import ReflectionJournal from './components/ReflectionJournal';
import SDLDashboard from './components/SDLDashboard';
import ResearchConsole from './components/ResearchConsole';
import AdminConsole from './components/AdminConsole';
import { AccountModal } from './components/AccountModal';
import {
  Compass,
  HelpCircle,
  MessageSquare,
  BookOpen,
  Activity,
  ShieldCheck,
  TrendingUp,
  Layout,
  Layers,
  Sparkles,
  Award,
  Globe,
  User,
  UserCheck,
  CheckCircle2,
  LogIn,
  UserPlus,
  Crown
} from 'lucide-react';
import { Language, LANGUAGES, translations } from './utils/translations';
import {
  saveStateToServer,
  loadStateFromServer,
  syncTranslations,
  SyncState,
  UserProfile,
  loginAccount
} from './utils/accountSync';

export default function App() {
  const [activeTab, setActiveTab] = useState<'planner' | 'tutor' | 'partner' | 'journal' | 'dashboard' | 'research' | 'admin'>('planner');
  const [language, setLanguage] = useState<Language>('vi'); // Defaults to Vietnamese
  
  // 1. Goal & Planner state
  const [userGoal, setUserGoal] = useState<UserGoalConfig | null>(null);
  const [roadmap, setRoadmap] = useState<LearningRoadmap | null>(null);

  // 2. Metacognitive Reflections list
  const [reflections, setReflections] = useState<ReflectionEntry[]>([]);

  // 3. Historical study logs for tracking consistency
  const [studyLogs, setStudyLogs] = useState<StudySessionLog[]>([
    {
      id: 'log-1',
      date: '05/29/2026',
      durationMinutes: 30,
      sessionType: 'Goal Reading',
      hintsUsed: 0,
      directAnswersUsed: 0,
      reflectionsDone: 0,
      selfAssessmentsDone: 0,
    }
  ]);

  // 4. Research paradigm state
  const [researchGroup, setResearchGroup] = useState<ParticipantGroup>('EXPERIMENTAL');
  const [telemetryLogs, setTelemetryLogs] = useState<ResearchTelemetry[]>([
    {
      sessionId: 'ses-init-1',
      group: 'EXPERIMENTAL',
      durationMinutes: 25,
      hintsUsed: 4,
      directAnswersUsed: 0,
      reflectionsCompleted: 1,
      motivationRating: 5,
      learningGainScore: 88,
      timestamp: new Date().toISOString(),
    },
    {
      sessionId: 'ses-init-2',
      group: 'CONTROL',
      durationMinutes: 15,
      hintsUsed: 0,
      directAnswersUsed: 6,
      reflectionsCompleted: 0,
      motivationRating: 3,
      learningGainScore: 72,
      timestamp: new Date(Date.now() - 3600000).toISOString(),
    }
  ]);

  // 5. Autonomy Telemetry Counts
  const [socraticHints, setSocraticHints] = useState<number>(3);
  const [directAnswers, setDirectAnswers] = useState<number>(0);
  const [speakingEvaluationsCount, setSpeakingEvaluationsCount] = useState<number>(0);

  // 6. User Account & Cloud Sync State - Restored safely from local session
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('linguapilot_user_session');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading session from storage:', e);
    }
    return null;
  });
  const [isAccountModalOpen, setIsAccountModalOpen] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string }>({ type: null, message: '' });

  // Sync user session to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('linguapilot_user_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('linguapilot_user_session');
    }
  }, [currentUser]);

  // Auto-sync debouncer ref to prevent spamming
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function notify(type: 'success' | 'error' | 'loading', message: string) {
    setSyncStatus({ type, message });
    if (type !== 'loading') {
      setTimeout(() => {
        setSyncStatus((prev) => (prev.message === message ? { type: null, message: '' } : prev));
      }, 5000);
    }
  }

  // Restore complete state from cloud
  function handleRestoreState(d: SyncState) {
    if (d.userGoal !== undefined) setUserGoal(d.userGoal);
    if (d.roadmap !== undefined) setRoadmap(d.roadmap);
    if (d.reflections !== undefined) setReflections(d.reflections);
    if (d.studyLogs !== undefined) setStudyLogs(d.studyLogs);
    if (d.researchGroup !== undefined) setResearchGroup(d.researchGroup as any);
    if (d.telemetryLogs !== undefined) setTelemetryLogs(d.telemetryLogs);
    if (d.socraticHints !== undefined) setSocraticHints(d.socraticHints);
    if (d.directAnswers !== undefined) setDirectAnswers(d.directAnswers);
    if (d.speakingEvaluationsCount !== undefined) setSpeakingEvaluationsCount(d.speakingEvaluationsCount);
  }

  // Initial load when user mounts or changes
  useEffect(() => {
    if (currentUser?.email) {
      const loadInitData = async () => {
        const res = await loadStateFromServer(currentUser.email);
        if (res.success && res.data) {
          handleRestoreState(res.data);
          console.log("Loaded persistent cloud data for account:", currentUser.email);
        }
      };
      loadInitData();
    }
  }, [currentUser?.email]);

  // Background Auto-sync when learning artifacts change
  useEffect(() => {
    if (!currentUser?.email) return;

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    syncTimeoutRef.current = setTimeout(async () => {
      const stateToSave: SyncState = {
        userGoal,
        roadmap,
        reflections,
        studyLogs,
        researchGroup,
        telemetryLogs,
        socraticHints,
        directAnswers,
        speakingEvaluationsCount,
        updatedAt: new Date().toISOString()
      };
      await saveStateToServer(currentUser.email, stateToSave);
    }, 2500);

    return () => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [userGoal, roadmap, reflections, studyLogs, telemetryLogs, socraticHints, directAnswers, speakingEvaluationsCount, currentUser?.email]);

  // Load defaults to populate visual metrics initially if state is empty
  useEffect(() => {
    if (!userGoal) {
      const defaultGoal: UserGoalConfig = {
        targetLanguage: currentUser?.targetLanguage || 'Spanish',
        proficiencyLevel: (currentUser?.level as any) || 'Intermediate',
        primaryGoal: 'IELTS 6.5 Prep & Autonomous Communication',
        availableMinutesPerDay: 30,
        preferredStyle: 'Conversational',
        isCompleted: false,
      };
      setUserGoal(defaultGoal);
    }

    if (!roadmap) {
      const defaultTasks: RoadmapTask[] = [
        {
          id: 'mock-t1',
          day: 1,
          week: 1,
          title: 'Active Root Analysis',
          category: 'Vocabulary',
          description: 'Deduce roots of 5 environmental vocabulary terms without checking translation tools.',
          status: 'Completed',
          durationMinutes: 25,
        },
        {
          id: 'mock-t2',
          day: 2,
          week: 1,
          title: 'Diagnostic Conversation Check',
          category: 'Speaking',
          description: 'Initiate your speaking simulator and evaluate your syntax and pacing.',
          status: 'Completed',
          durationMinutes: 20,
        },
        {
          id: 'mock-t3',
          day: 3,
          week: 1,
          title: 'Metacognitive Journaling',
          category: 'Reflection',
          description: 'Record one learning obstacle encountered today and design a compensatory heuristic.',
          status: 'Pending',
          durationMinutes: 15,
        }
      ];

      setRoadmap({
        goal: 'IELTS 6.5 Prep & Autonomous Communication',
        proficiencyLevel: 'Intermediate',
        durationWeeks: 4,
        methodology: 'Self-Directed Socratic Active Recall',
        weeks: [
          {
            weekNumber: 1,
            theme: 'Metacognitive Foundations & Root Word Induction',
            focus: 'Inferencing without real-time bilingual dictionary assistance',
            tasks: defaultTasks,
          },
          {
            weekNumber: 2,
            theme: 'Discourse Markers & Spoken Fluidity',
            focus: 'Autonomous repair strategies during speech disfluencies',
            tasks: [
              {
                id: 'mock-t4',
                day: 1,
                week: 2,
                title: 'Discourse Marker Drill',
                category: 'Grammar',
                description: 'Integrate 4 transitional connectives into a 2-minute spoken response.',
                status: 'Pending',
                durationMinutes: 20,
              }
            ],
          }
        ],
        tasks: defaultTasks,
      });
    }

    if (reflections.length === 0) {
      setReflections([
        {
          id: 'ref-demo-1',
          date: '05/29/2026',
          topic: 'Differentiating inference vs lookup',
          challengeFaced: 'Initial anxiety when meeting unfamiliar medical adjectives.',
          strategyUsed: 'Deconstructed Latin suffixes before resorting to external definitions.',
          confidenceRating: 4,
          effectivenessScore: 85,
          notes: 'Great improvement in autonomy when relying on contextual scaffolding.',
          aiCoachInsight: 'Terrific focus on reflection. Developing this metacognitive muscle is the key to mastering any skill independently!'
        }
      ]);
    }
  }, []);

  // Helper callbacks
  function handleTaskToggle(taskId: string) {
    if (!roadmap) return;
    const updatedTasks = roadmap.tasks.map((task) => {
      if (task.id === taskId) {
        const nextStatus = task.status === 'Completed' ? 'Pending' : 'Completed';
        return { ...task, status: nextStatus };
      }
      return task;
    });
    setRoadmap({ ...roadmap, tasks: updatedTasks });
  }

  function addReflection(entry: ReflectionEntry) {
    setReflections((prev) => [entry, ...prev]);
  }

  function addTelemetryLog(log: ResearchTelemetry) {
    setTelemetryLogs((prev) => [log, ...prev]);
  }

  function logStudySession(
    minutes: number,
    type: 'Goal Reading' | 'Socratic Tutor' | 'Speaking Practice' | 'Reflection'
  ) {
    const newLog: StudySessionLog = {
      id: `log-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      durationMinutes: minutes,
      sessionType: type,
      hintsUsed: type === 'Socratic Tutor' ? 1 : 0,
      directAnswersUsed: 0,
      reflectionsDone: type === 'Reflection' ? 1 : 0,
      selfAssessmentsDone: type === 'Speaking Practice' ? 1 : 0,
    };
    setStudyLogs((prev) => [newLog, ...prev]);
  }

  const t = translations[language];

  return (
    <div className="min-h-screen bg-[#080808] text-zinc-150 flex flex-col font-sans antialiased animate-fade-in relative">
      
      {/* Floating Sync Notification Banner */}
      {syncStatus.type && (
        <div className="fixed top-20 right-4 z-[9999] pointer-events-none transition-all duration-300 transform translate-y-0">
          <div className={`shadow-2xl border rounded-2xl py-3 px-5 flex items-center gap-3 max-w-sm backdrop-blur-xl ${
            syncStatus.type === 'loading'
              ? 'bg-[#121212]/95 border-[#D4AF37]/50 text-[#D4AF37]'
              : syncStatus.type === 'success'
              ? 'bg-[#121212]/95 border-emerald-500/50 text-emerald-400'
              : 'bg-[#121212]/95 border-rose-500/50 text-rose-400'
          }`}>
            <span className="flex h-2 w-2 relative">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                syncStatus.type === 'loading' ? 'bg-[#D4AF37]' : syncStatus.type === 'success' ? 'bg-emerald-400' : 'bg-rose-400'
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                syncStatus.type === 'loading' ? 'bg-[#D4AF37]' : syncStatus.type === 'success' ? 'bg-emerald-500' : 'bg-rose-500'
              }`}></span>
            </span>
            <span className="text-xs font-semibold tracking-wide">{syncStatus.message}</span>
          </div>
        </div>
      )}

      {/* Universal header */}
      <header className="bg-[#121212]/90 border-b border-white/10 sticky top-0 z-50 shadow-xs backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-10 h-10 border-2 border-[#D4AF37] rounded-full flex items-center justify-center">
              <span className="font-serif italic font-bold text-xl text-[#D4AF37]">L</span>
            </div>
            <div>
              <h1 className="text-base font-serif font-semibold tracking-tight text-white leading-tight">{t.logoTitle}</h1>
              <p className="text-[10px] font-mono text-[#D4AF37] uppercase tracking-widest font-semibold">{t.subTitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Admin Console Direct Switcher Button (Visible for Admin) */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={() => setActiveTab(activeTab === 'admin' ? 'planner' : 'admin')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === 'admin'
                    ? 'bg-[#D4AF37] text-black shadow-lg ring-2 ring-[#D4AF37]/50'
                    : 'bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40'
                }`}
                title={t.tabAdmin}
                id="btn-header-admin-console"
              >
                <Crown className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{t.adminButton || 'Admin'}</span>
                <span className="md:hidden">Admin</span>
              </button>
            )}

            {/* Research Paradigm quick badge */}
            <div className="hidden lg:flex items-center gap-3">
              <span className="text-xs text-zinc-300 flex items-center gap-1.5 bg-[#1a1a1a] border border-white/10 px-3 py-1.5 rounded-full font-medium">
                <span className={`h-2 w-2 rounded-full ${researchGroup === 'EXPERIMENTAL' ? 'bg-[#D4AF37]' : 'bg-rose-500'}`} />
                {t.groupLabel} {researchGroup === 'EXPERIMENTAL' ? t.experimental : t.control}
              </span>
              <span className="text-xs bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/20 px-3 py-1.5 rounded-full font-semibold flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {t.efficacyActive}
              </span>
            </div>

            {/* User Account & Cloud Sync Pill */}
            <div className="flex items-center gap-2">
              {currentUser ? (
                <button
                  onClick={() => setIsAccountModalOpen(true)}
                  className={`flex items-center gap-2.5 bg-[#1a1a1a] hover:bg-[#222222] active:scale-95 border rounded-xl px-3 py-1.5 transition cursor-pointer shadow-sm group ${
                    currentUser.role === 'admin' ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/30' : 'border-[#D4AF37]/35 hover:border-[#D4AF37]/70'
                  }`}
                  id="user-account-btn"
                  title={t.btnAccountTitle}
                >
                  <div className="h-6 w-6 rounded-lg bg-[#D4AF37] text-black font-bold text-xs flex items-center justify-center uppercase shrink-0 shadow-xs">
                    {currentUser.name ? currentUser.name.charAt(0) : currentUser.email.charAt(0)}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-bold text-white group-hover:text-[#D4AF37] transition leading-none truncate max-w-[130px] flex items-center gap-1">
                      <span>{currentUser.name || currentUser.email.split('@')[0]}</span>
                      {currentUser.role === 'admin' && (
                        <span className="text-[9px] bg-[#D4AF37] text-black px-1 py-0.2 rounded font-mono font-bold">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono leading-tight mt-0.5 truncate max-w-[130px]">
                      {currentUser.email}
                    </div>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-emerald-400 shrink-0 animate-pulse" title={t.btnAccountTitle} />
                </button>
              ) : (
                <button
                  onClick={() => setIsAccountModalOpen(true)}
                  className="flex items-center gap-1.5 bg-[#D4AF37] hover:bg-[#c4a030] active:scale-95 text-black font-bold text-xs px-3 py-2 rounded-xl transition cursor-pointer shadow-md"
                  id="btn-open-login"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.loginRegister}</span>
                  <span className="sm:hidden">{t.loginRegister?.split('/')[0] || 'User'}</span>
                </button>
              )}
            </div>

            {/* Language Selector Dropdown (Sleek dark themed with Globe Icon) */}
            <div className="relative flex items-center gap-2 bg-[#1a1a1a] border border-white/15 hover:border-[#D4AF37]/55 rounded-xl px-3 py-1.5 transition">
              <Globe className="h-4 w-4 text-[#D4AF37] shrink-0" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as Language)}
                className="bg-transparent text-xs font-semibold text-white focus:outline-none cursor-pointer pr-1"
                title="Select Interface Language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code} className="bg-[#121212] text-white">
                    {l.flag} {l.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </div>
      </header>

      {/* Navigation tabs with visual scroll fades for supreme mobile UX */}
      <div className="relative bg-[#121212] border-b border-white/10 z-30">
        {/* Left fade indicator */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#121212] via-[#121212]/70 to-transparent pointer-events-none z-10 sm:hidden" />
        {/* Right fade indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#121212] via-[#121212]/80 to-transparent pointer-events-none z-10 sm:hidden" />

        <nav className="scrollbar-none smooth-scroll-x overflow-x-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 flex gap-2 md:gap-4 h-14">
            {[
              { id: 'planner', label: t.tabPlanner, icon: Compass },
              { id: 'tutor', label: t.tabTutor, icon: HelpCircle },
              { id: 'partner', label: t.tabPartner, icon: MessageSquare },
              { id: 'journal', label: t.tabJournal, icon: BookOpen },
              { id: 'dashboard', label: t.tabDashboard, icon: Activity },
              { id: 'research', label: t.tabResearch, icon: ShieldCheck },
              ...(currentUser?.role === 'admin'
                ? [{ id: 'admin', label: `🛡️ ${t.tabAdmin}`, icon: Crown, isAdminTab: true }]
                : [])
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-1.5 md:gap-2 h-full px-3 md:px-4 text-xs font-semibold border-b-2 transition whitespace-nowrap cursor-pointer ${
                    isActive
                      ? tab.isAdminTab
                        ? 'border-[#D4AF37] text-[#D4AF37] font-bold bg-[#D4AF37]/15 ring-1 ring-[#D4AF37]/30'
                        : 'border-[#D4AF37] text-[#D4AF37] font-bold bg-[#D4AF37]/5'
                      : tab.isAdminTab
                      ? 'border-transparent text-[#D4AF37]/80 hover:text-[#D4AF37] hover:bg-[#D4AF37]/5'
                      : 'border-transparent text-zinc-400 hover:text-white hover:border-zinc-700'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 md:h-4 md:w-4 shrink-0" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </nav>
      </div>

      {/* Main active module container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8">
        {activeTab === 'planner' && (
          <GoalPlanner
            lang={language}
            userGoal={userGoal}
            setUserGoal={setUserGoal}
            roadmap={roadmap}
            setRoadmap={setRoadmap}
            onTaskToggle={handleTaskToggle}
            logSession={logStudySession}
          />
        )}

        {activeTab === 'tutor' && (
          <SocraticTutor
            lang={language}
            researchGroup={researchGroup}
            logSession={logStudySession}
            incrementHints={() => setSocraticHints((prev) => prev + 1)}
            incrementDirect={() => setDirectAnswers((prev) => prev + 1)}
          />
        )}

        {activeTab === 'partner' && (
          <SpeakingPartner
            lang={language}
            logSession={logStudySession}
            onAssessmentCompleted={() => setSpeakingEvaluationsCount((prev) => prev + 1)}
          />
        )}

        {activeTab === 'journal' && (
          <ReflectionJournal
            lang={language}
            reflections={reflections}
            addReflection={addReflection}
            logSession={logStudySession}
          />
        )}

        {activeTab === 'dashboard' && (
          <SDLDashboard
            lang={language}
            tasks={roadmap?.tasks || []}
            reflections={reflections}
            studyLogs={studyLogs}
            socraticHints={socraticHints}
            directAnswers={directAnswers}
            speakingEvaluationsCount={speakingEvaluationsCount}
          />
        )}

        {activeTab === 'research' && (
          <ResearchConsole
            lang={language}
            researchGroup={researchGroup}
            setResearchGroup={setResearchGroup}
            telemetryLogs={telemetryLogs}
            addTelemetryLog={addTelemetryLog}
            socraticHints={socraticHints}
            directAnswers={directAnswers}
            reflectionsCount={reflections.length}
          />
        )}

        {activeTab === 'admin' && (
          <AdminConsole
            currentUser={currentUser}
            onExitAdmin={() => setActiveTab('planner')}
            lang={language}
          />
        )}
      </main>

      {/* Universal Footer */}
      <footer className="bg-[#121212] border-t border-white/10 mt-12 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-zinc-500 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>{t.footerCopyright}</p>
          <p className="font-mono text-[#D4AF37]/60">{t.footerActiveSession}</p>
        </div>
      </footer>

      {/* Account & Synchronization Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        currentUser={currentUser}
        onUserChange={(newUser) => {
          setCurrentUser(newUser);
        }}
        language={language}
        currentState={{
          userGoal,
          roadmap,
          reflections,
          studyLogs,
          researchGroup,
          telemetryLogs,
          socraticHints,
          directAnswers,
          speakingEvaluationsCount,
        }}
        onStateRestore={handleRestoreState}
        onNotify={notify}
        onOpenAdminConsole={() => setActiveTab('admin')}
      />

    </div>
  );
}
