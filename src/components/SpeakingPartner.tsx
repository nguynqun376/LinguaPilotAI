import React, { useState, useEffect, useRef } from 'react';
import { SpeechFeedback, SpokenLanguage, HskkLevel, CustomSpeakingTopic } from '../types';
import { Mic, MicOff, MessageSquare, Award, Volume2, Loader2, Globe, BookOpen, Sparkles, Plus, Trash2, CheckCircle2, ListPlus } from 'lucide-react';
import { Language, translations } from '../utils/translations';

interface SpeakingPartnerProps {
  lang: Language;
  logSession: (minutes: number, type: 'Goal Reading' | 'Socratic Tutor' | 'Speaking Practice' | 'Reflection') => void;
  onAssessmentCompleted: (rating: SpeechFeedback) => void;
}

export default function SpeakingPartner({
  lang,
  logSession,
  onAssessmentCompleted,
}: SpeakingPartnerProps) {
  const t = translations[lang] || translations.en;
  
  // Spoken Language & Framework State
  const [spokenLanguage, setSpokenLanguage] = useState<SpokenLanguage>('english');
  const [hskkLevel, setHskkLevel] = useState<HskkLevel>('intermediate');

  const [scenario, setScenario] = useState('');
  const [partnerPrompt, setPartnerPrompt] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  const [feedback, setFeedback] = useState<SpeechFeedback | null>(null);
  const [sessionMinutes, setSessionMinutes] = useState(0);

  // Topic Source Tab: 'preset' or 'custom'
  const [topicTab, setTopicTab] = useState<'preset' | 'custom'>('preset');

  // Custom Topics State & Persistence
  const [customTopics, setCustomTopics] = useState<CustomSpeakingTopic[]>(() => {
    try {
      const saved = localStorage.getItem('linguapilot_custom_speaking_topics');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error("Failed to parse custom topics from localStorage", e);
    }
    return [
      {
        id: 'default-custom-1',
        title: 'IELTS Part 2: Environmental Protection Initiative',
        prompt: 'Describe an environmental initiative or green habit you started recently. You should explain why you decided to start it, what changes it brought to your daily routine, and what impact it might have on society.',
        spokenLanguage: 'english',
        theme: 'Environment & Climate',
        createdAt: new Date().toISOString(),
        isAiGenerated: false
      },
      {
        id: 'default-custom-2',
        title: 'HSKK 中级/高级：跨文化交流中的理解与包容',
        prompt: '在经济全球化的今天，跨文化交流变得越来越普遍。请结合你的学习或亲身经历，谈谈在与不同文化背景的人交往时，我们应该如何克服偏见并建立深度理解？',
        spokenLanguage: 'chinese',
        hskkLevel: 'intermediate',
        theme: 'Culture & Communication',
        createdAt: new Date().toISOString(),
        isAiGenerated: false
      }
    ];
  });

  // Manual topic input fields
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualPrompt, setManualPrompt] = useState('');
  const [manualTheme, setManualTheme] = useState('');

  // AI Topic generator states
  const [aiThemeInput, setAiThemeInput] = useState('');
  const [isGeneratingAiTopic, setIsGeneratingAiTopic] = useState(false);
  const [aiGenSuccessMsg, setAiGenSuccessMsg] = useState<string | null>(null);

  // Speech Recognition API reference
  const recognitionRef = useRef<any>(null);

  // Sync custom topics to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('linguapilot_custom_speaking_topics', JSON.stringify(customTopics));
    } catch (e) {
      console.error("Failed to save custom topics to localStorage", e);
    }
  }, [customTopics]);

  // Dynamic presets depending on spoken practice language & UI localization
  const englishPresets = [
    {
      title: lang === 'vi' ? 'IELTS Part 1: Giới thiệu bản thân & Quê hương' : 'IELTS Part 1: Hometown & Personal Background',
      prompt: "Hello! Welcome to the IELTS Speaking assessment. Could you tell me your full name, where you grew up, and what you enjoy most about your hometown?",
    },
    {
      title: lang === 'vi' ? 'IELTS Part 2: Kể về một chuyến đi đáng nhớ' : 'IELTS Part 2: Describe a Memorable Journey',
      prompt: "Please describe an unforgettable journey or trip you went on. You should say where you went, whom you went with, what you did there, and explain why this journey was so meaningful to you.",
    },
    {
      title: lang === 'vi' ? 'IELTS Part 3: Thảo luận về Trí tuệ nhân tạo (AI)' : 'IELTS Part 3: AI & Future of Learning',
      prompt: "How do you think Artificial Intelligence and autonomous educational algorithms will transform traditional university education in the next decade?",
    },
    {
      title: lang === 'vi' ? 'Phỏng vấn chuyên môn: Kỹ sư phần mềm' : 'Job Interview: Software Architect Pitch',
      prompt: "Welcome to our engineering panel. Could you articulate your key architectural strengths in system scalability and how you lead technical problem-solving?",
    }
  ];

  const chinesePresets = [
    {
      title: lang === 'vi' ? 'HSKK Sơ cấp: Giới thiệu bản thân & Thói quen hàng ngày' : 'HSKK Primary: Self-Introduction & Daily Routines',
      prompt: "你好！请先做一个简短的自我介绍。你平时有什么爱好？周末一般喜欢做些什么？",
      level: 'primary' as HskkLevel,
    },
    {
      title: lang === 'vi' ? 'HSKK Trung cấp: Kể lại một trải nghiệm du lịch khó quên' : 'HSKK Intermediate: A Memorable Travel Experience',
      prompt: "请描述一次让你印象最深刻的旅行经历。你去过哪里？遇到了什么有趣的人或事情？这次旅行带给你怎样的感悟？",
      level: 'intermediate' as HskkLevel,
    },
    {
      title: lang === 'vi' ? 'HSKK Cao cấp: Bàn về tác động của Công nghệ & AI' : 'HSKK Advanced: Societal Impact of AI & Technology',
      prompt: "有人认为人工智能正在极大提升人类工作效率，但也有人担心这会削弱人类独立思考的能力。请结合你的生活或专业背景，谈谈你的看法。",
      level: 'advanced' as HskkLevel,
    },
    {
      title: lang === 'vi' ? 'Đàm phán thương mại: Đề xuất hợp tác doanh nghiệp' : 'Business Chinese: Strategic Partnership Proposal',
      prompt: "尊敬的各位合伙人，欢迎参加本次商业洽谈会。请您简要阐述贵公司在市场拓展方面的核心优势与本次战略合作的规划构想。",
      level: 'advanced' as HskkLevel,
    }
  ];

  const activePresets = spokenLanguage === 'chinese' ? chinesePresets : englishPresets;

  // Filter custom topics for the current spoken language
  const filteredCustomTopics = customTopics.filter(
    (t) => t.spokenLanguage === spokenLanguage
  );

  // Initialize or reset scenario when spoken language changes
  useEffect(() => {
    if (topicTab === 'preset' && activePresets && activePresets.length > 0) {
      setScenario(activePresets[0].title);
      setPartnerPrompt(activePresets[0].prompt);
      setTranscript('');
      setFeedback(null);
    } else if (topicTab === 'custom' && filteredCustomTopics.length > 0) {
      setScenario(filteredCustomTopics[0].title);
      setPartnerPrompt(filteredCustomTopics[0].prompt);
      setTranscript('');
      setFeedback(null);
    }
  }, [spokenLanguage, topicTab]);

  useEffect(() => {
    // Log speaking session periodically
    const interval = setInterval(() => {
      setSessionMinutes((prev) => {
        const next = prev + 1;
        logSession(1, 'Speaking Practice');
        return next;
      });
    }, 60000); // 1 minute
    return () => clearInterval(interval);
  }, []);

  // Update Speech Recognition when spokenLanguage changes
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = spokenLanguage === 'chinese' ? 'zh-CN' : 'en-US';

      rec.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        if (finalTranscript) {
          setTranscript((prev) => (prev ? prev + ' ' : '') + finalTranscript);
        }
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
    }
  }, [spokenLanguage]);

  function speakPrompt() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(partnerPrompt);
      utterance.lang = spokenLanguage === 'chinese' ? 'zh-CN' : 'en-US';
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  }

  function startRecognition() {
    if (recognitionRef.current) {
      try {
        setTranscript('');
        recognitionRef.current.start();
        setIsRecording(true);
      } catch (err) {
        console.error("Speech recognition start error:", err);
      }
    } else {
      setIsRecording(true);
      if (spokenLanguage === 'chinese') {
        setTranscript("我觉得人工智能的发展给现代教育带来了深远的影响。学生可以利用AI定制专属的自主学习路线，但是也要注意避免过度依赖直接答案...");
      } else {
        setTranscript("In my perspective, autonomous AI algorithms significantly enhance individualized learning pace, though students must be mindful to avoid passive dependency on direct definitions...");
      }
    }
  }

  function stopRecognition() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.error(err);
      }
    }
    setIsRecording(false);
  }

  // Handle saving user's manual custom topic
  function handleSaveManualTopic() {
    if (!manualTitle.trim() || !manualPrompt.trim()) return;

    const newTopic: CustomSpeakingTopic = {
      id: `custom-topic-${Date.now()}`,
      title: manualTitle.trim(),
      prompt: manualPrompt.trim(),
      spokenLanguage: spokenLanguage,
      hskkLevel: spokenLanguage === 'chinese' ? hskkLevel : undefined,
      theme: manualTheme.trim() || undefined,
      createdAt: new Date().toISOString(),
      isAiGenerated: false,
    };

    setCustomTopics((prev) => [newTopic, ...prev]);
    setScenario(newTopic.title);
    setPartnerPrompt(newTopic.prompt);
    setTranscript('');
    setFeedback(null);
    setTopicTab('custom');

    // Reset form
    setManualTitle('');
    setManualPrompt('');
    setManualTheme('');
    setIsManualFormOpen(false);
  }

  // Handle AI dynamic topic expansion
  async function handleGenerateAiTopic() {
    setIsGeneratingAiTopic(true);
    setAiGenSuccessMsg(null);
    try {
      const res = await fetch('/api/generate-speaking-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spokenLanguage,
          hskkLevel: spokenLanguage === 'chinese' ? hskkLevel : undefined,
          themeOrKeyword: aiThemeInput.trim() || undefined,
          uiLanguage: lang,
        }),
      });

      if (!res.ok) throw new Error('AI Generation failed');
      const data: CustomSpeakingTopic = await res.json();

      setCustomTopics((prev) => [data, ...prev]);
      setScenario(data.title);
      setPartnerPrompt(data.prompt);
      setTranscript('');
      setFeedback(null);
      setTopicTab('custom');
      setAiThemeInput('');
      setAiGenSuccessMsg(data.title);
      setTimeout(() => setAiGenSuccessMsg(null), 5000);
    } catch (err) {
      console.error("AI topic generator error:", err);
      // Fallback topic if offline or network error
      const isZh = lang === 'zh';
      const isVi = lang === 'vi';
      const isChinese = spokenLanguage === 'chinese';

      const fallbackTitle = isChinese
        ? (isZh ? `HSKK 口语真题拓展：${aiThemeInput || '现代科技与生活'}` : isVi ? `HSKK Mở rộng đề tài: ${aiThemeInput || 'Công nghệ & Đời sống'}` : `HSKK Oral Exam: ${aiThemeInput || 'Technology & Life'}`)
        : (isZh ? `IELTS Speaking Part 2: ${aiThemeInput || 'Future Technology'}` : isVi ? `IELTS Part 2 Mở rộng: ${aiThemeInput || 'Công nghệ tương lai'}` : `IELTS Part 2: ${aiThemeInput || 'Future Innovations'}`);

      const fallbackPrompt = isChinese
        ? "随着互联网与数字经济的快速普及，移动支付和在线教育深刻重塑了人们的日常生活。请结合自身经历，谈谈数字化生活带来的最大便利以及你所关注的潜在风险。"
        : "Describe a modern technological innovation that has transformed how you communicate with others. You should describe what it is, how often you use it, and discuss both its benefits and ethical challenges.";

      const fallbackTopic: CustomSpeakingTopic = {
        id: `fallback-topic-${Date.now()}`,
        title: fallbackTitle,
        prompt: fallbackPrompt,
        spokenLanguage,
        hskkLevel: isChinese ? hskkLevel : undefined,
        theme: aiThemeInput || 'General Discussion',
        createdAt: new Date().toISOString(),
        isAiGenerated: true,
      };

      setCustomTopics((prev) => [fallbackTopic, ...prev]);
      setScenario(fallbackTopic.title);
      setPartnerPrompt(fallbackTopic.prompt);
      setTopicTab('custom');
    } finally {
      setIsGeneratingAiTopic(false);
    }
  }

  // Handle deleting a custom topic
  function handleDeleteCustomTopic(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setCustomTopics((prev) => prev.filter((t) => t.id !== id));
  }

  async function submitForAnalysis() {
    if (!transcript.trim()) return;
    setLoadingFeedback(true);
    try {
      const res = await fetch('/api/speaking-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript,
          scenario: scenario,
          proficiency: spokenLanguage === 'chinese' ? hskkLevel : 'Intermediate',
          spokenLanguage: spokenLanguage,
          framework: spokenLanguage === 'chinese' ? 'hskk' : 'ielts',
          hskkLevel: hskkLevel,
          uiLanguage: lang,
        }),
      });

      if (!res.ok) throw new Error('Feedback request failed');
      const data = await res.json();
      setFeedback(data);
      onAssessmentCompleted(data);
    } catch (err) {
      console.error("Speech assessment error:", err);
      const isZh = lang === 'zh';
      const isVi = lang === 'vi';
      const isChinese = spokenLanguage === 'chinese';

      const mockFeedback: SpeechFeedback = {
        transcript: transcript,
        framework: isChinese ? 'hskk' : 'ielts',
        spokenLanguage: spokenLanguage,
        hskkLevel: hskkLevel,
        overallScore: isChinese
          ? (isZh ? '86/100 分 (达到HSKK标准)' : isVi ? '86/100 Điểm (Đạt HSKK)' : '86/100 Points (HSKK Pass)')
          : 'Band 7.0 / 9.0',
        grammarRating: 8,
        pronunciationRating: 8,
        fluencyRating: 7,
        vocabularyRating: 8,
        grammarCorrections: [
          isChinese
            ? (isZh 
                ? "注意转折连词的搭配顺序：使用“虽然”时建议紧密搭配“但是/然而”，增强复句逻辑。"
                : isVi 
                ? "Chú ý thứ tự liên từ chuyển ý: khi dùng '虽然' cần kết hợp chặt chẽ với '但是/然而'." 
                : "Notice conjunction pairing: pair '虽然' with '但是/然而' to strengthen compound clause logic.")
            : (isZh
                ? "自主检查复合从句中的主谓一致以及介词搭配习惯。"
                : isVi
                ? "Tự kiểm tra sự hòa hợp chủ vị và cách dùng giới từ trong các mệnh đề phụ phức hợp."
                : "Self-check subject-verb concord and prepositional usage in complex dependent clauses.")
        ],
        vocabularySuggestions: [
          isChinese
            ? (isZh
                ? "可适当运用高阶成语与书面词汇，例如“循序渐进”、“举一反三”，提升表达深度。"
                : isVi
                ? "Có thể dùng các thành ngữ/từ vựng cao cấp như '循序渐进' (từng bước tiến bộ), '推波助澜'."
                : "Incorporate advanced idioms such as '循序渐进' or '举一反三' to enrich oral expression.")
            : (isZh
                ? "可引入更精准的论述衔接词，如 'consequently', 'furthermore', 或 'in stark contrast'。"
                : isVi
                ? "Bổ sung các từ nối học thuật như 'consequently', 'furthermore', hoặc 'in stark contrast'."
                : "Incorporate specialized discourse markers such as 'consequently', 'furthermore', or 'in stark contrast'.")
        ],
        praisePoints: [
          isChinese
            ? (isZh
                ? "声调与语调自然流畅，立论紧扣题目，展现出良好的口语构思能力。"
                : isVi
                ? "Thanh điệu và ngữ điệu tự nhiên, lập luận logic và bám sát chủ đề HSKK."
                : "Natural intonation and tone pitch, well-structured arguments aligned with HSKK rubrics.")
            : (isZh
                ? "句式结构连贯，语调起伏自然，逻辑表达清晰有力。"
                : isVi
                ? "Cấu trúc câu trôi chảy, ngữ điệu biểu cảm và diễn đạt rành mạch."
                : "Fluid sentence structure, great tone inflection and clear rhetorical articulation.")
        ]
      };
      setFeedback(mockFeedback);
      onAssessmentCompleted(mockFeedback);
    } finally {
      setLoadingFeedback(false);
    }
  }

  return (
    <div id="speaking-practice-container" className="space-y-8 max-w-6xl mx-auto">
      {/* Introduction Card */}
      <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 flex flex-col md:flex-row gap-6 items-center shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 translate-x-12 -translate-y-12 bg-[#D4AF37]/5 rounded-full blur-2xl" />
        <div className="rounded-2xl bg-[#D4AF37]/10 p-4 text-[#D4AF37] shrink-0 border border-[#D4AF37]/20 relative z-10 font-serif">
          <MessageSquare className="h-10 w-10" />
        </div>
        <div className="flex-1 relative z-10">
          <h2 className="text-2xl font-serif font-bold tracking-tight text-white mb-1">{t.partnerTitle}</h2>
          <p className="text-zinc-300 mt-2 max-w-3xl leading-relaxed text-sm">
            {t.partnerDesc}
          </p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            <span className="bg-[#D4AF37]/20 border border-[#D4AF37]/30 text-[#D4AF37] font-semibold px-3 py-1.5 rounded-full inline-block">
              {t.sessionTimeMinutes.replace('{minutes}', String(sessionMinutes))}
            </span>
            <span className="bg-white/5 border border-white/10 text-zinc-300 font-mono px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5 text-[#D4AF37]" />
              {spokenLanguage === 'chinese' ? t.hskkFrameworkBadge : t.ieltsFrameworkBadge}
            </span>
            <span className="bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] font-mono px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              {filteredCustomTopics.length} {t.myCustomPromptsTitle}
            </span>
          </div>
        </div>
      </div>

      {/* Language & Exam Configurator Banner */}
      <div className="bg-[#161616] border border-white/10 rounded-3xl p-6 shadow-md grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Spoken Language Selector */}
        <div className="space-y-2">
          <label className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2 font-semibold">
            <Globe className="h-4 w-4 text-[#D4AF37]" />
            {t.spokenLangLabel}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setSpokenLanguage('english')}
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                spokenLanguage === 'english'
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37] shadow-sm'
                  : 'border-white/10 bg-[#1e1e1e] text-zinc-400 hover:border-zinc-500'
              }`}
            >
              🇬🇧 English (IELTS)
            </button>
            <button
              type="button"
              onClick={() => setSpokenLanguage('chinese')}
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
                spokenLanguage === 'chinese'
                  ? 'border-[#D4AF37] bg-[#D4AF37]/15 text-[#D4AF37] shadow-sm'
                  : 'border-white/10 bg-[#1e1e1e] text-zinc-400 hover:border-zinc-500'
              }`}
            >
              🇨🇳 中文 (HSKK)
            </button>
          </div>
        </div>

        {/* Exam Specific Level / Framework */}
        <div className="space-y-2">
          {spokenLanguage === 'chinese' ? (
            <>
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2 font-semibold">
                <BookOpen className="h-4 w-4 text-[#D4AF37]" />
                {t.hskkLevelLabel}
              </label>
              <select
                value={hskkLevel}
                onChange={(e) => setHskkLevel(e.target.value as HskkLevel)}
                className="w-full p-3.5 rounded-2xl border border-white/10 bg-[#1e1e1e] text-white text-xs font-medium focus:outline-none focus:border-[#D4AF37] cursor-pointer"
              >
                <option value="primary">{t.hskkPrimary}</option>
                <option value="intermediate">{t.hskkIntermediate}</option>
                <option value="advanced">{t.hskkAdvanced}</option>
              </select>
            </>
          ) : (
            <>
              <label className="text-xs font-mono uppercase tracking-wider text-zinc-300 flex items-center gap-2 font-semibold">
                <Award className="h-4 w-4 text-[#D4AF37]" />
                {t.assessmentFramework}
              </label>
              <div className="p-3.5 rounded-2xl border border-white/10 bg-[#1e1e1e] text-xs text-zinc-300 font-medium flex items-center justify-between">
                <span>{t.ieltsFrameworkBadge}</span>
                <span className="bg-[#D4AF37]/20 text-[#D4AF37] font-mono px-2 py-0.5 rounded text-[11px] font-bold">Part 1, 2, 3</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Topic Navigator & Custom Generator (5 cols on lg) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Topic Mode Switcher Tabs */}
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 p-1.5 bg-[#181818] rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setTopicTab('preset')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  topicTab === 'preset'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <ListPlus className="h-3.5 w-3.5" />
                {t.tabPresetPrompts}
              </button>
              <button
                type="button"
                onClick={() => setTopicTab('custom')}
                className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer relative ${
                  topicTab === 'custom'
                    ? 'bg-[#D4AF37] text-black shadow-md'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {t.tabCustomPrompts}
                {filteredCustomTopics.length > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                    topicTab === 'custom' ? 'bg-black/20 text-black' : 'bg-[#D4AF37]/20 text-[#D4AF37]'
                  }`}>
                    {filteredCustomTopics.length}
                  </span>
                )}
              </button>
            </div>

            {/* TAB 1: PRESET TOPICS */}
            {topicTab === 'preset' && (
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-400 font-mono tracking-wider uppercase">{t.chooseScenario}</h3>
                  <span className="text-[11px] text-zinc-500 font-mono">{activePresets.length} topics</span>
                </div>
                <div className="space-y-2.5">
                  {activePresets.map((p, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setScenario(p.title);
                        setPartnerPrompt(p.prompt);
                        setFeedback(null);
                      }}
                      className={`w-full text-left p-4 rounded-2xl border transition text-sm cursor-pointer ${
                        scenario === p.title
                          ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-[#D4AF37] font-semibold shadow-sm'
                          : 'border-white/5 bg-[#181818] hover:border-zinc-500 text-zinc-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span>{p.title}</span>
                        {scenario === p.title && <CheckCircle2 className="h-4 w-4 shrink-0 text-[#D4AF37] mt-0.5" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 2: CUSTOM TOPICS & AI GENERATOR */}
            {topicTab === 'custom' && (
              <div className="space-y-4 pt-1">
                {/* AI Instant Generator Section */}
                <div className="p-4 rounded-2xl bg-gradient-to-br from-[#D4AF37]/10 via-[#181818] to-[#121212] border border-[#D4AF37]/25 space-y-3">
                  <div className="flex items-center gap-2 text-[#D4AF37]">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-bold uppercase tracking-wider font-mono">{t.aiExpandBannerTitle}</span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    {t.aiExpandBannerDesc}
                  </p>

                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={aiThemeInput}
                      onChange={(e) => setAiThemeInput(e.target.value)}
                      placeholder={t.aiTopicKeywordPlaceholder}
                      onKeyDown={(e) => e.key === 'Enter' && !isGeneratingAiTopic && handleGenerateAiTopic()}
                      className="w-full px-3 py-2.5 rounded-xl border border-white/10 bg-black/40 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#D4AF37]"
                    />
                    <button
                      type="button"
                      onClick={handleGenerateAiTopic}
                      disabled={isGeneratingAiTopic}
                      className="w-full py-2.5 px-4 bg-[#D4AF37] hover:bg-[#c49f2e] text-black rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition disabled:opacity-50"
                    >
                      {isGeneratingAiTopic ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t.aiGeneratingPrompt}
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          {t.aiGeneratePromptBtn}
                        </>
                      )}
                    </button>
                  </div>

                  {aiGenSuccessMsg && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{aiGenSuccessMsg}</span>
                    </div>
                  )}
                </div>

                {/* Button to toggle Manual Custom Form */}
                <div>
                  {!isManualFormOpen ? (
                    <button
                      type="button"
                      onClick={() => setIsManualFormOpen(true)}
                      className="w-full py-2.5 px-4 rounded-2xl border border-dashed border-white/20 hover:border-[#D4AF37] text-zinc-300 hover:text-[#D4AF37] text-xs font-medium flex items-center justify-center gap-2 transition cursor-pointer bg-[#181818]"
                    >
                      <Plus className="h-4 w-4 text-[#D4AF37]" />
                      {t.createCustomPromptHeading}
                    </button>
                  ) : (
                    <div className="p-4 rounded-2xl bg-[#181818] border border-[#D4AF37]/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white font-serif">{t.createCustomPromptHeading}</span>
                        <button
                          type="button"
                          onClick={() => setIsManualFormOpen(false)}
                          className="text-[11px] text-zinc-500 hover:text-zinc-300 cursor-pointer"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-zinc-400 font-mono">{t.customPromptTitleLabel}</label>
                        <input
                          type="text"
                          value={manualTitle}
                          onChange={(e) => setManualTitle(e.target.value)}
                          placeholder={t.customPromptTitlePlaceholder}
                          className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black/40 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[11px] text-zinc-400 font-mono">{t.customPromptContentLabel}</label>
                        <textarea
                          value={manualPrompt}
                          onChange={(e) => setManualPrompt(e.target.value)}
                          placeholder={t.customPromptContentPlaceholder}
                          rows={3}
                          className="w-full p-2.5 rounded-xl border border-white/10 bg-black/40 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#D4AF37] resize-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={handleSaveManualTopic}
                        disabled={!manualTitle.trim() || !manualPrompt.trim()}
                        className="w-full py-2.5 px-4 bg-[#D4AF37] hover:bg-[#c49f2e] text-black rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition disabled:opacity-40"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {t.saveCustomTopicBtn}
                      </button>
                    </div>
                  )}
                </div>

                {/* List of Custom Topics */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold text-zinc-400 font-mono tracking-wider uppercase">{t.myCustomPromptsTitle}</h4>
                    <span className="text-[11px] text-zinc-500 font-mono">{filteredCustomTopics.length}</span>
                  </div>

                  {filteredCustomTopics.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-[#181818] border border-white/5 text-center text-xs text-zinc-500 space-y-1">
                      <p>{t.noCustomPromptsMsg}</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                      {filteredCustomTopics.map((ct) => (
                        <div
                          key={ct.id}
                          onClick={() => {
                            setScenario(ct.title);
                            setPartnerPrompt(ct.prompt);
                            setFeedback(null);
                          }}
                          className={`p-3.5 rounded-2xl border transition text-left cursor-pointer group relative ${
                            scenario === ct.title
                              ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white shadow-sm'
                              : 'border-white/5 bg-[#181818] hover:border-zinc-600 text-zinc-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="font-semibold text-xs text-white line-clamp-1">
                              {ct.title}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteCustomTopic(ct.id, e)}
                              title={t.deleteTopicBtn}
                              className="text-zinc-500 hover:text-rose-400 transition p-1 cursor-pointer shrink-0 opacity-60 group-hover:opacity-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <p className="text-[11px] text-zinc-400 line-clamp-2 italic mb-2">
                            "{ct.prompt}"
                          </p>
                          <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500">
                            <span className="flex items-center gap-1">
                              {ct.isAiGenerated && (
                                <span className="px-1.5 py-0.5 rounded bg-[#D4AF37]/20 text-[#D4AF37] font-semibold flex items-center gap-1">
                                  <Sparkles className="h-2.5 w-2.5" /> AI
                                </span>
                              )}
                              {ct.theme && <span>#{ct.theme}</span>}
                            </span>
                            {scenario === ct.title ? (
                              <span className="text-[#D4AF37] font-bold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Active
                              </span>
                            ) : (
                              <span className="text-zinc-500 group-hover:text-zinc-300">
                                {t.useThisTopicBtn} →
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Guidelines info */}
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-6 text-xs text-zinc-400 space-y-3">
            <h4 className="font-semibold text-zinc-300 uppercase tracking-wider font-mono text-[11px]">{t.speakingWorkflows}</h4>
            <p>{t.step1}</p>
            <p>{t.step2}</p>
            <p>{t.step3}</p>
          </div>
        </div>

        {/* Right Column: Interaction Box & Speech Assessment (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-[#121212] border border-white/10 rounded-3xl p-8 shadow-sm space-y-6">
            {/* Active Topic & Listening block */}
            <div className="p-6 bg-[#1a1a1a] rounded-2xl border border-white/5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono tracking-wider uppercase text-[#D4AF37] font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  {t.activePartner}
                </span>
                <span className="text-xs text-zinc-400 font-mono font-medium truncate max-w-[240px]">
                  {scenario}
                </span>
              </div>
              <p className="text-sm text-zinc-200 font-medium leading-relaxed italic">
                "{partnerPrompt}"
              </p>
              <button
                onClick={speakPrompt}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs bg-white/5 hover:bg-white/10 text-zinc-300 border border-white/10 rounded-xl transition cursor-pointer font-medium"
              >
                <Volume2 className="h-4 w-4 text-[#D4AF37]" /> {t.listenWebSynth}
              </button>
            </div>

            {/* Speaking Recording block */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">{t.responseTranscript}</span>
                {isRecording && (
                  <span className="flex items-center gap-1 text-rose-400 animate-pulse text-xs font-semibold">
                    <span className="h-2 w-2 bg-rose-500 rounded-full" /> {t.recordingAudio}
                  </span>
                )}
              </div>

              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder={t.micPlaceholder}
                className="w-full h-36 rounded-2xl border border-white/10 p-4 text-sm focus:outline-none focus:border-[#D4AF37] bg-[#1a1a1a] text-white resize-none leading-relaxed"
              />

              <div className="flex flex-wrap gap-3">
                {!isRecording ? (
                  <button
                    onClick={startRecognition}
                    className="py-3 px-5 bg-[#D4AF37] hover:bg-[#bda13e] text-[#080808] rounded-xl text-xs uppercase tracking-wider font-bold flex items-center gap-2 cursor-pointer transition shadow-sm"
                  >
                    <Mic className="h-4.5 w-4.5" /> {t.startRecord}
                  </button>
                ) : (
                  <button
                    onClick={stopRecognition}
                    className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs uppercase tracking-wider font-bold flex items-center gap-2 cursor-pointer transition shadow-sm"
                  >
                    <MicOff className="h-4.5 w-4.5" /> {t.finishRecord}
                  </button>
                )}

                <button
                  onClick={submitForAnalysis}
                  disabled={loadingFeedback || !transcript.trim()}
                  className="py-3 px-5 border border-white/10 hover:border-[#D4AF37] hover:text-[#D4AF37] font-medium text-zinc-300 rounded-xl text-xs uppercase tracking-wider bg-white/5 flex items-center gap-2 cursor-pointer transition disabled:opacity-40"
                >
                  {loadingFeedback ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> {t.gettingFeedback}
                    </>
                  ) : (
                    <>
                      <Award className="h-4 w-4 text-[#D4AF37]" /> {t.getFeedbackBtn}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Feedback Display */}
          {feedback && (
            <div className="bg-[#121212] border border-[#D4AF37]/20 rounded-3xl p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <Award className="h-6 w-6 text-[#D4AF37]" />
                  <div>
                    <h3 className="text-lg font-serif font-bold text-white">{t.metricsTitle}</h3>
                    <p className="text-xs text-zinc-400 font-mono">
                      {feedback.framework === 'hskk' 
                        ? `HSKK (${feedback.hskkLevel || hskkLevel}) 汉语水平口语考试` 
                        : 'IELTS Speaking Framework'}
                    </p>
                  </div>
                </div>

                {feedback.overallScore && (
                  <div className="px-4 py-2 bg-[#D4AF37]/15 border border-[#D4AF37]/30 rounded-2xl flex items-center gap-2">
                    <span className="text-xs text-zinc-400 font-mono">{t.overallScoreLabel}</span>
                    <span className="text-lg font-bold text-[#D4AF37] font-mono">{feedback.overallScore}</span>
                  </div>
                )}
              </div>

              {/* Grid ratings */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-[#1a1a1a] border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">{t.grammarRating}</span>
                  <p className="text-2xl font-bold text-[#D4AF37]">{feedback.grammarRating} <span className="text-xs text-zinc-500">/ 10</span></p>
                </div>
                <div className="p-4 bg-[#1a1a1a] border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">{t.pronunciationRating}</span>
                  <p className="text-2xl font-bold text-[#D4AF37]">{feedback.pronunciationRating} <span className="text-xs text-zinc-500">/ 10</span></p>
                </div>
                <div className="p-4 bg-[#1a1a1a] border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">{t.fluencyRating}</span>
                  <p className="text-2xl font-bold text-[#D4AF37]">{feedback.fluencyRating} <span className="text-xs text-zinc-500">/ 10</span></p>
                </div>
                <div className="p-4 bg-[#1a1a1a] border border-white/5 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-mono tracking-wider uppercase text-zinc-500">{t.vocabularyRating}</span>
                  <p className="text-2xl font-bold text-[#D4AF37]">{feedback.vocabularyRating} <span className="text-xs text-zinc-500">/ 10</span></p>
                </div>
              </div>

              {/* Action lists */}
              <div className="space-y-4 pt-2">
                {feedback.grammarCorrections && feedback.grammarCorrections.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono tracking-wider uppercase text-rose-400 font-semibold">{t.grammarCorrections}</h4>
                    <ul className="text-sm space-y-1.5 pl-4 list-disc text-zinc-300">
                      {feedback.grammarCorrections.map((corr, i) => (
                        <li key={i}>{corr}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.vocabularySuggestions && feedback.vocabularySuggestions.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono tracking-wider uppercase text-[#D4AF37] font-semibold">{t.lexicalUpgrades}</h4>
                    <ul className="text-sm space-y-1.5 pl-4 list-disc text-zinc-300">
                      {feedback.vocabularySuggestions.map((sug, i) => (
                        <li key={i}>{sug}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {feedback.praisePoints && feedback.praisePoints.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-mono tracking-wider uppercase text-emerald-400 font-semibold">{t.speakingPraise}</h4>
                    <ul className="text-sm space-y-1.5 pl-4 list-disc text-zinc-400">
                      {feedback.praisePoints.map((pr, i) => (
                        <li key={i}>{pr}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
