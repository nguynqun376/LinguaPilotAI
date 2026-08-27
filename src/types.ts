/**
 * LinguaPilot AI TypeScript Types
 */

export type ProficiencyLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export type LearningStyle = 'Visual' | 'Auditory' | 'Reading/Writing' | 'Conversational';

export interface UserGoalConfig {
  targetLanguage: string; // e.g. "English", "Chinese", or "English, Chinese"
  targetLanguages?: string[]; // array of selected languages e.g. ["English"], ["Chinese"], ["English", "Chinese"]
  proficiencyLevel: ProficiencyLevel;
  languageLevels?: { [language: string]: ProficiencyLevel };
  primaryGoal: string; // e.g. "IELTS 6.5", "Business Tech Speaking", "HSK 4"
  availableMinutesPerDay: number;
  preferredStyle: LearningStyle;
  isCompleted: boolean;
}

export interface RoadmapTask {
  id: string;
  day: number;
  week: number;
  title: string;
  category: 'Vocabulary' | 'Reading' | 'Speaking' | 'Grammar' | 'Reflection' | string;
  description: string;
  status: 'Pending' | 'Completed' | 'Skipped';
  durationMinutes: number;
  language?: string; // which language this task belongs to e.g. "English" or "Chinese"
}

export interface LearningRoadmap {
  goalTitle: string;
  weeksDuration: number;
  tasks: RoadmapTask[];
  languagePlans?: {
    [languageName: string]: {
      goalTitle: string;
      tasks: RoadmapTask[];
    };
  };
  selectedLanguages?: string[];
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: string;
  // Socratic / Learning Companionship metadata
  isHint?: boolean;
  isDirectAnswer?: boolean;
  encouragedReflection?: boolean;
}

export interface SocraticSession {
  id: string;
  userId: string;
  targetTopic: string;
  messages: Message[];
  hintsRequested: number;
  directAnswersRequested: number;
  solved: boolean;
}

export type SpokenLanguage = 'english' | 'chinese';
export type AssessmentFramework = 'ielts' | 'hskk';
export type HskkLevel = 'primary' | 'intermediate' | 'advanced';

export interface CustomSpeakingTopic {
  id: string;
  title: string;
  prompt: string;
  spokenLanguage: SpokenLanguage;
  hskkLevel?: HskkLevel;
  theme?: string;
  createdAt: string;
  isAiGenerated?: boolean;
}

export interface SpeechFeedback {
  transcript: string;
  framework?: AssessmentFramework;
  spokenLanguage?: SpokenLanguage;
  hskkLevel?: HskkLevel;
  overallScore?: number | string; // e.g. "Band 7.0" or "85/100"
  grammarRating: number; // 1-10 (or subscore)
  pronunciationRating: number; // 1-10
  fluencyRating: number; // 1-10
  vocabularyRating: number; // 1-10
  subScores?: {
    name: string;
    score: number;
    maxScore: number;
    feedback?: string;
  }[];
  grammarCorrections: string[];
  vocabularySuggestions: string[];
  praisePoints: string[];
}

export interface ReflectionEntry {
  id: string;
  date: string;
  learnedToday: string;
  difficultiesFaced: string;
  strategyUsed: string;
  nextSteps: string;
  aiSuggestedInsight?: string;
  weeklyReportId?: string;
}

export interface StudySessionLog {
  id: string;
  date: string;
  durationMinutes: number;
  sessionType: 'Socratic Tutor' | 'Speaking Practice' | 'Goal Reading' | 'Reflection';
  hintsUsed: number;
  directAnswersUsed: number;
  reflectionsDone: number;
  selfAssessmentsDone: number;
}

export interface SDLMetrics {
  goalAchievementRate: number; // percentage of completed tasks Out of total
  completedTasksCount: number;
  missedTasksCount: number;
  studyStreak: number;
  weeklyStudyTimeMinutes: number;
  vocabularyGrowth: number; // e.g. estimated words learned
  speakingPerformance: number; // 1-100 score
  readingPerformance: number; // 1-100 score
  independenceScore: number; // 0-100 computed autonomy score
}

// Research system
export type ParticipantGroup = 'EXPERIMENTAL' | 'CONTROL';

export interface ResearchTelemetry {
  sessionId: string;
  group: ParticipantGroup;
  durationMinutes: number;
  hintsUsed: number;
  directAnswersUsed: number;
  reflectionsCompleted: number;
  motivationRating: number; // 1-5 scale rating after session
  learningGainScore: number; // pre vs post assessment or quiz score
  timestamp: string;
}
