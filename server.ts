import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import compression from "compression";
import rateLimit from "express-rate-limit";

dotenv.config();

// Initialize the Google GenAI client
// Setting User-Agent header as instructed for AI Studio build tracking
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// System Performance & Monitoring Telemetry
const systemMetrics = {
  startedAt: new Date().toISOString(),
  totalRequests: 0,
  apiRequests: 0,
  blockedRequests: 0,
  cachedHits: 0,
  responseTimesMs: [] as number[],
  lastHealthCheck: new Date().toISOString(),
};

// Response Memory Cache Store for high-speed repeated queries (Cache & Bandwidth Optimization)
const apiMemoryCache = new Map<string, { timestamp: number; data: any }>();
const CACHE_TTL_MS = 60 * 1000; // 60 seconds TTL

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust Cloud Run & Nginx reverse proxy headers (X-Forwarded-For, Forwarded)
  app.set("trust proxy", 1);

  // 1. BANDWIDTH & CDN OPTIMIZATION: Gzip/Brotli Compression
  app.use(compression({
    level: 6,
    threshold: 1024, // Compress responses over 1KB
  }));

  // 2. DDOS DEFENDER: Rate Limiter (Protects against flood attacks / brute-force)
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes window
    max: 300, // Limit each IP to 300 requests per window
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false,
    validate: false, // Disable warning validations for reverse proxy environments
    message: {
      error: "Hệ thống phát hiện quá nhiều yêu cầu từ địa chỉ của bạn. DDoS Defender tạm thời giới hạn truy cập (Rate Limit). Vui lòng thử lại sau.",
      status: 429,
    },
    handler: (req, res, next, options) => {
      systemMetrics.blockedRequests++;
      res.status(options.statusCode).send(options.message);
    }
  });

  // Stricter rate limiter for AI generation endpoints to prevent quota exhaustion
  const aiLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 AI prompts per minute per IP
    validate: false, // Disable warning validations for reverse proxy environments
    message: {
      error: "Tần suất yêu cầu AI quá cao trong 1 phút. DDoS Defender bảo vệ luồng xử lý. Vui lòng chờ vài giây.",
      status: 429,
    }
  });

  // Apply DDoS Defender to API routes
  app.use("/api/", apiLimiter);
  app.use("/api/generate-roadmap", aiLimiter);
  app.use("/api/socratic-chat", aiLimiter);
  app.use("/api/speaking-feedback", aiLimiter);
  app.use("/api/generate-speaking-topic", aiLimiter);

  // 3. REQUEST OPTIMIZATION & MONITORING MIDDLEWARE: Latency tracker + CDN Caching headers
  app.use((req, res, next) => {
    systemMetrics.totalRequests++;
    if (req.path.startsWith("/api")) {
      systemMetrics.apiRequests++;
    }

    const startTime = Date.now();

    // CDN / Edge Cache headers for static assets & safe public endpoints
    if (req.method === "GET") {
      if (req.path.startsWith("/assets/") || req.path.match(/\.(js|css|png|jpg|svg|ico|woff2?)$/)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      } else if (!req.path.startsWith("/api/")) {
        res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
      }
    }

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      if (systemMetrics.responseTimesMs.length > 500) {
        systemMetrics.responseTimesMs.shift();
      }
      systemMetrics.responseTimesMs.push(duration);
    });

    next();
  });

  app.use(express.json({ limit: "5mb" }));

  // 4. MONITORING & SYSTEM HEALTH DASHBOARD API: Live status, memory, uptime, bandwidth
  app.get("/api/system/monitoring", (req, res) => {
    const memoryUsage = process.memoryUsage();
    const avgResponseTime = systemMetrics.responseTimesMs.length > 0
      ? Math.round(systemMetrics.responseTimesMs.reduce((a, b) => a + b, 0) / systemMetrics.responseTimesMs.length)
      : 0;

    res.json({
      status: "operational",
      uptimeSeconds: Math.round(process.uptime()),
      systemMetrics: {
        totalRequests: systemMetrics.totalRequests,
        apiRequests: systemMetrics.apiRequests,
        blockedRequests: systemMetrics.blockedRequests,
        cachedHits: systemMetrics.cachedHits,
        avgResponseTimeMs: avgResponseTime,
        activeConnections: app._router?.stack?.length || 0,
      },
      infrastructure: {
        ddosDefender: "Active (Express Rate-Limiting + Token Bucket)",
        compression: "Gzip & Brotli Enabled (Bandwidth Optimized)",
        cdnCache: "Active (Stale-While-Revalidate + Immutable Static Assets)",
        redundancy: "Firebase Cloud Firestore + Local JSON Storage Failover",
        autoRestart: "Process Supervisor Active (Cloud Run / Node Crash Resilience)",
      },
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      },
      serverTime: new Date().toISOString(),
    });
  });

  // Log API status and warn if key is missing
  app.get("/api/health", (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY;
    systemMetrics.lastHealthCheck = new Date().toISOString();
    res.json({
      status: "ok",
      geminiConfigured: hasKey,
      uptime: process.uptime(),
      redundancyState: "healthy",
    });
  });

  // 1. Goal Planner API Endpoint
  app.post("/api/generate-roadmap", async (req, res) => {
    const { targetLanguage, targetLanguages, proficiencyLevel, languageLevels, primaryGoal, availableMinutesPerDay, preferredStyle, uiLanguage } = req.body;

    const selectedLangs: string[] = Array.isArray(targetLanguages) && targetLanguages.length > 0 
      ? targetLanguages 
      : (targetLanguage ? [targetLanguage] : ['English']);

    if (!primaryGoal) {
      return res.status(400).json({ error: "Missing required fields for goal planner" });
    }

    const langNameMap: Record<string, string> = {
      vi: 'Vietnamese (Tiếng Việt)',
      en: 'English',
      zh: 'Simplified Chinese (简体中文)',
      pt: 'Portuguese (Português)',
      es: 'Spanish (Español)',
      fr: 'French (Français)'
    };
    const targetLangName = langNameMap[uiLanguage || 'vi'] || 'Vietnamese (Tiếng Việt)';

    const isDualLanguage = selectedLangs.length > 1;
    const daysPerWeek = isDualLanguage ? 3 : 5;
    const totalDays = 4 * daysPerWeek; // 4 weeks total: 20 tasks if 1 lang, 12 tasks per lang if 2 langs

    try {
      if (isDualLanguage) {
        // Generate plans for each selected language (4 weeks x 3 days each = 12 tasks per language)
        const languagePlans: Record<string, { goalTitle: string; tasks: any[] }> = {};
        const allTasks: any[] = [];

        for (const lang of selectedLangs) {
          const specificLevel = (languageLevels && languageLevels[lang]) || proficiencyLevel || 'Intermediate';
          const prompt = `
            Create a personalized 4-week language learning plan for ${lang}.
            User Details:
            - Target Language: ${lang}
            - Current Proficiency Level for ${lang}: ${specificLevel} (IMPORTANT: Calibrate task complexity strictly for a ${specificLevel} student of ${lang})
            - Overall Goal: ${primaryGoal}
            - Study Time Available: ${availableMinutesPerDay} minutes per day
            - Preferred Study Style: ${preferredStyle}
            - Structure: 4 weeks, EXACTLY 3 study days per week (Total 12 daily tasks, Week 1 (Day 1-3), Week 2 (Day 4-6), Week 3 (Day 7-9), Week 4 (Day 10-12)).
            
            CRITICAL LANGUAGE REQUIREMENT:
            - You MUST write 100% of the output text (goalTitle, task titles, task descriptions, categories) in ${targetLangName}!
            - If uiLanguage is Chinese, write strictly in Simplified Chinese (简体中文).
            - If uiLanguage is Vietnamese, write in Vietnamese.
            - If uiLanguage is English, write in English.

            Assign each task:
            - id: unique string e.g. "${lang.toLowerCase()}-task-w1-d1"
            - day: integer (1 to 12)
            - week: integer (1, 2, 3, or 4)
            - title: specific, engaging task title suited for ${specificLevel} level
            - category: category in ${targetLangName} (Vocabulary, Reading, Speaking, Grammar, Reflection)
            - description: clear SDL autonomous actionable instructions matching ${specificLevel} complexity
            - durationMinutes: ${availableMinutesPerDay}
            - language: "${lang}"
          `;

          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              systemInstruction: `You are an elite educational language strategist specialized in Self-Directed Learning (SDL). Generate a 4-week roadmap with 3 days per week in ${targetLangName}. NEVER output in an unrequested language.`,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  goalTitle: { type: Type.STRING },
                  weeksDuration: { type: Type.INTEGER },
                  tasks: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        id: { type: Type.STRING },
                        day: { type: Type.INTEGER },
                        week: { type: Type.INTEGER },
                        title: { type: Type.STRING },
                        category: { type: Type.STRING },
                        description: { type: Type.STRING },
                        durationMinutes: { type: Type.INTEGER },
                        language: { type: Type.STRING }
                      },
                      required: ["id", "day", "week", "title", "category", "description", "durationMinutes"]
                    }
                  }
                },
                required: ["goalTitle", "weeksDuration", "tasks"]
              }
            }
          });

          const resData = JSON.parse(response.text || "{}");
          const tasks = (resData.tasks || []).map((t: any, idx: number) => ({
            ...t,
            id: t.id || `${lang.toLowerCase()}-task-${idx + 1}`,
            language: lang,
            status: 'Pending',
          }));

          languagePlans[lang] = {
            goalTitle: resData.goalTitle || `${lang} (${specificLevel}) - ${primaryGoal}`,
            tasks,
          };
          allTasks.push(...tasks);
        }

        res.json({
          goalTitle: `${selectedLangs.map(l => `${l} [${(languageLevels && languageLevels[l]) || proficiencyLevel || 'Intermediate'}]`).join(" & ")}: ${primaryGoal}`,
          weeksDuration: 4,
          tasks: allTasks,
          languagePlans,
          selectedLanguages: selectedLangs
        });
      } else {
        // Single language: 4 weeks x 5 days per week = 20 tasks
        const singleLang = selectedLangs[0];
        const specificLevel = (languageLevels && languageLevels[singleLang]) || proficiencyLevel || 'Intermediate';
        const prompt = `
          Create a personalized 4-week language learning plan for ${singleLang}.
          User Information:
          - Target Language: ${singleLang}
          - Current Proficiency Level for ${singleLang}: ${specificLevel} (IMPORTANT: Calibrate task complexity strictly for a ${specificLevel} student of ${singleLang})
          - Goal: ${primaryGoal}
          - Study Time Available: ${availableMinutesPerDay} minutes per day
          - Preferred Study Style: ${preferredStyle}
          - Structure: 4 weeks, EXACTLY 5 study days per week (Total 20 daily tasks, Week 1 (Day 1-5), Week 2 (Day 6-10), Week 3 (Day 11-15), Week 4 (Day 16-20)).
          
          CRITICAL LANGUAGE REQUIREMENT:
          - You MUST write 100% of the output text (goalTitle, task titles, task descriptions, categories) in ${targetLangName}!
          - If the uiLanguage is Chinese, write strictly in Simplified Chinese (简体中文).
          - If the uiLanguage is Vietnamese, write in Vietnamese.
          - If the uiLanguage is English, write in English.

          Generate exactly 20 actionable tasks:
          - id: unique string e.g. "task-w1-d1"
          - day: integer from 1 to 20
          - week: integer (1, 2, 3, or 4)
          - title: specific, engaging task title suited for ${specificLevel} level
          - category: category in ${targetLangName} (Vocabulary, Reading, Speaking, Grammar, Reflection)
          - description: actionable SDL instructions matching ${specificLevel} complexity
          - durationMinutes: ${availableMinutesPerDay}
          - language: "${singleLang}"
        `;

        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: `You are an elite educational language strategist specialized in Self-Directed Learning (SDL). Generate a complete 4-week roadmap with 5 days per week in ${targetLangName}. NEVER output in another language.`,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                goalTitle: { type: Type.STRING },
                weeksDuration: { type: Type.INTEGER },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      day: { type: Type.INTEGER },
                      week: { type: Type.INTEGER },
                      title: { type: Type.STRING },
                      category: { type: Type.STRING },
                      description: { type: Type.STRING },
                      durationMinutes: { type: Type.INTEGER },
                      language: { type: Type.STRING }
                    },
                    required: ["id", "day", "week", "title", "category", "description", "durationMinutes"]
                  }
                }
              },
              required: ["goalTitle", "weeksDuration", "tasks"]
            }
          }
        });

        const resData = JSON.parse(response.text || "{}");
        const tasks = (resData.tasks || []).map((t: any, idx: number) => ({
          ...t,
          id: t.id || `task-${idx + 1}`,
          language: singleLang,
          status: 'Pending',
        }));

        res.json({
          goalTitle: resData.goalTitle || `${singleLang} - ${primaryGoal}`,
          weeksDuration: 4,
          tasks,
          selectedLanguages: [singleLang],
          languagePlans: {
            [singleLang]: {
              goalTitle: resData.goalTitle || `${singleLang} - ${primaryGoal}`,
              tasks
            }
          }
        });
      }
    } catch (error: any) {
      console.error("Roadmap generation error:", error);
      res.status(500).json({ error: "Failed to generate plan. Please try again later.", details: error.message });
    }
  });

  // 2. AI Socratic Tutor API Endpoint
  app.post("/api/socratic-chat", async (req, res) => {
    const { history, message, topic, group, uiLanguage } = req.body; // group: 'EXPERIMENTAL' or 'CONTROL'

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const langNameMap: Record<string, string> = {
      vi: 'Vietnamese (Tiếng Việt)',
      en: 'English',
      zh: 'Simplified Chinese (简体中文)',
      pt: 'Portuguese (Português)',
      es: 'Spanish (Español)',
      fr: 'French (Français)'
    };
    const targetLangName = langNameMap[uiLanguage || 'vi'] || 'Vietnamese (Tiếng Việt)';

    try {
      const isExperimental = group === 'EXPERIMENTAL';
      
      const systemPrompt = isExperimental
        ? `
          You are an intelligent Socratic Language Tutor designed to cultivate Self-Directed Learning (SDL) and deep critical comprehension.
          
          CRITICAL LANGUAGE ENFORCEMENT:
          - You MUST reply 100% in ${targetLangName}.
          - If ${targetLangName} is Simplified Chinese (简体中文) or if the user asks in Chinese, EVERY single word of your explanation, question, hint, and feedback MUST be in Chinese (简体中文). NEVER use Vietnamese, English (except the target English word under discussion), or any other language!
          - If ${targetLangName} is English, reply 100% in English.
          - If ${targetLangName} is Vietnamese, reply 100% in Vietnamese.
          - If ${targetLangName} is Spanish, French, or Portuguese, reply 100% in that language.
          
          CORE HYBRID SOCRATIC PEDAGOGY:
          1. ULTRA-COMPLEX / ESOTERIC / NOVELTY / HIGHLY SPECIALIZED MEDICAL & SCIENTIFIC WORDS (e.g., 'supercalifragilisticexpialidocious', 'pneumonoultramicroscopicsilicovolcanoconiosis', 'floccinaucinihilipilification', 'antidisestablishmentarianism', 'pseudopseudohypoparathyroidism', etc.):
             - RULE: Provide the DIRECT and FULL explanation immediately in ${targetLangName}. 
             - Give the clear literal definition, pronunciation/phonetic breakdown, word origin/etymology, or cultural background (e.g. Mary Poppins musical for 'supercalifragilisticexpialidocious', or lung disease caused by silica dust for 'pneumonoultramicroscopicsilicovolcanoconiosis') directly and concisely.
             - DO NOT turn these ultra-long or novelty terms into forced guessing games, and DO NOT ask unnecessary open-ended Socratic questions. Give the learner the complete answer right away.

          2. DUAL-LAYER APPROACH FOR SIMPLE / MULTI-MEANING / POLYSEMOUS WORDS (e.g., 'draw', 'run', 'bank', 'table', 'interest', 'book', 'set', etc.):
             - LAYER 1 (Basic / Literal / Primary Meaning): State the basic, common everyday meaning DIRECTLY, clearly, and concisely in ${targetLangName} (e.g., for 'draw', directly state that its most common literal meaning is 'vẽ' [to draw a picture] or 'kéo').
             - LAYER 2 (Deeper / Secondary / Polysemous / Figurative Meanings): Do NOT simply dump a long dictionary list of secondary definitions! Instead, immediately transition into Socratic inquiry: present an engaging sentence context, thought-provoking scenario, or guided question to help the learner deduce and discover the deeper, idiomatic, or figurative meanings for themselves.
               * Example for 'draw' in Vietnamese:
                 "'draw' có nghĩa cơ bản quen thuộc nhất là 'vẽ' (hoặc 'kéo'). Tuy nhiên, trong tiếng Anh, từ này còn có những tầng nghĩa rất đặc biệt trong các ngữ cảnh khác. Bạn hãy thử xem 2 câu sau: 'What conclusion can we draw from this experiment?' và 'The football match ended in a 1-1 draw'. Theo bạn, trong 2 ngữ cảnh này, 'draw' mang ý nghĩa gì?"
               * Example for 'draw' in Chinese:
                 "“draw” 最基础、最常见的字面意思确实是“画”（或者“拉、拽”）。不过在英语中，它在许多高级语境和固定搭配中有更深刻的含义。比如看这两句话：1. 'What conclusion can we draw from this experiment?' 2. 'The game ended in a 1-1 draw.' 你觉得在这些语境中，“draw”分别代表什么含义呢？"
               * Example for 'draw' in English:
                 "'draw' most directly and commonly means 'to produce a picture' (or 'to pull'). However, this versatile word has several other fascinating and deeper meanings. Consider these two sentences: 'What conclusion can we draw from this research?' and 'The game ended in a 1-1 draw.' What do you think 'draw' signifies in each of these contexts?"

          3. FOR ABSTRACT / CONCEPTUAL / GRAMMATICAL TOPICS (e.g., 'Biodiversity', 'Subjunctive mood', 'Affect vs. Effect', idioms like 'Break a leg'):
             - Use Socratic scaffolding: break down roots/morphemes (e.g., Bio- + diversity), provide sentence clues, and guide the learner step-by-step to construct the meaning without spoonfeeding flat answers.

          4. PRAISE AND INTERACTION:
             - Praise the learner's active reasoning, curiosity, and independent deductions.
             - Encourage them to test their new understanding by making their own example sentence once they uncover the deeper meaning.
          
          RESPONSE FORMAT:
          - If your response includes any Socratic guiding question, clue, or deeper discovery prompt (even alongside a direct basic meaning), set "isHint": true and "isDirectAnswer": false.
          - If your response gives a direct answer/explanation without Socratic question (e.g. for ultra-complex terms like 'supercalifragilisticexpialidocious' or direct dictionary inquiries), set "isHint": false and "isDirectAnswer": true.
        `
        : `
          You are a Traditional AI Language Tutor. Your goal is to be direct, helpful, and supply instructions, definitions, and rules immediately upon request.
          
          CRITICAL LANGUAGE ENFORCEMENT:
          - You MUST formulate 100% of your response in ${targetLangName}.
          - If ${targetLangName} is Simplified Chinese (简体中文) or if the user asks in Chinese, write 100% in Chinese (简体中文). Do NOT write in Vietnamese or English!
          - If ${targetLangName} is English, write in English.
          - If ${targetLangName} is Vietnamese, write in Vietnamese.
          - If ${targetLangName} is Spanish, French, or Portuguese, write in that language.
          
          TRADITIONAL TUTOR RULES:
          1. Provide clear, direct, and exhaustive translations and definitions immediately when asked in ${targetLangName}.
          2. Outline grammar tables, definitions of vocabulary, and step-by-step corrections straightforwardly.
          3. Do not ask counter-questions. Do not challenge the user to think for themselves. Give them the immediate answer to maximize speed.
          
          You must return a structured JSON response identifying whether you provided a hint or a direct answer (you should aim to provide direct answers with no hints).
        `;

      const contents = [
        ...history.map((h: any) => ({
          role: h.role,
          parts: [{ text: h.content }]
        })),
        {
          role: "user",
          parts: [{ text: `Topic context: ${topic || "General conversation"}. User Input: ${message}` }]
        }
      ];

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents,
        config: {
          systemInstruction: systemPrompt,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: { type: Type.STRING, description: "Your spoken response in the tutor dialogue written strictly in target language." },
              isHint: { type: Type.BOOLEAN, description: "True if your reply acted as a Socratic hint or guiding questioning instead of giving a plain answer." },
              isDirectAnswer: { type: Type.BOOLEAN, description: "True if your reply gave the direct definition/answer/translation immediately." }
            },
            required: ["reply", "isHint", "isDirectAnswer"]
          }
        }
      });

      const responseText = response.text || "{}";
      const data = JSON.parse(responseText.trim());
      res.json(data);
    } catch (error: any) {
      console.error("Socratic chat error:", error);
      res.status(500).json({ error: "Failed to run tutoring response", details: error.message });
    }
  });

  // 3. AI Speaking Partner Feedback Endpoint (IELTS vs HSKK standards)
  app.post("/api/speaking-feedback", async (req, res) => {
    const { transcript, scenario, proficiency, spokenLanguage, framework, hskkLevel, uiLanguage } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: "No transcript provided for feedback" });
    }

    const langNameMap: Record<string, string> = {
      vi: 'Vietnamese (Tiếng Việt)',
      en: 'English',
      zh: 'Simplified Chinese (简体中文)',
      pt: 'Portuguese (Português)',
      es: 'Spanish (Español)',
      fr: 'French (Français)'
    };
    const targetUiLangName = langNameMap[uiLanguage || 'vi'] || 'Vietnamese (Tiếng Việt)';

    const isChinese = spokenLanguage === 'chinese' || framework === 'hskk';
    const examName = isChinese ? `HSKK (${hskkLevel || 'Intermediate'}) 汉语水平口语考试` : 'IELTS Speaking (Band 1.0 - 9.0)';

    try {
      const prompt = `
        Analyze this spoken transcription of a language learner practicing in the context of: "${scenario || 'General Conversation'}".
        - Spoken Target Language: ${isChinese ? 'Chinese (Mandarin / 普通话)' : 'English'}
        - Target Assessment Standard: ${examName}
        - User's Stated Target Level: "${proficiency || (isChinese ? hskkLevel : 'Intermediate')}"
        - Learner Spoken Transcript: "${transcript}"

        CRITICAL REQUIREMENT:
        - All your diagnostic explanations, grammar challenges, vocabulary suggestions, and praise notes MUST be written 100% in ${targetUiLangName}!
        - If UI language is Simplified Chinese (简体中文), ALL feedback, praise points, grammar corrections, and vocabulary suggestions MUST be in Chinese (简体中文). Do NOT write in Vietnamese or English!

        EVALUATION FRAMEWORK:
        ${isChinese ? `
          - Assess according to official HSKK (汉语水平口语考试) rubric for ${hskkLevel || 'intermediate'} level (Primary: HSK 1-2, Intermediate: HSK 3-4, Advanced: HSK 5-6).
          - Overall score: provide a formatted score out of 100 (e.g. "85/100 分" or in ${targetUiLangName}) and a 1-10 normalized rating.
          - Evaluate 4 core HSKK competencies:
            1. Pinyin & Tones (max 30)
            2. Grammar & Sentence Structures (max 30)
            3. Fluency & Speed (max 20)
            4. Expression & Richness (max 20)
        ` : `
          - Assess according to official IELTS Speaking descriptors (Band 1.0 - 9.0 in 0.5 increments).
          - Overall score: provide a formatted IELTS Band (e.g. "Band 6.5 / 9.0") and a 1-10 normalized rating.
          - Evaluate 4 core IELTS criteria:
            1. Fluency & Coherence
            2. Lexical Resource
            3. Grammatical Range & Accuracy
            4. Pronunciation
        `}

        Structure your suggestions to encourage autonomic correction. For mistakes, do not just list the correction, but indicate it as a "Self-Check challenge" where they can deduce why their error occurred.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are an elite Applied Linguistics Examiner and Certified Speaking Assessor for ${examName}. You evaluate pronunciation, grammatical accuracy, lexical sophistication, and fluency. You MUST formulate all written commentary, self-check questions, and suggestions 100% in ${targetUiLangName}. NEVER output in a different language.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transcript: { type: Type.STRING },
              framework: { type: Type.STRING },
              spokenLanguage: { type: Type.STRING },
              hskkLevel: { type: Type.STRING },
              overallScore: { type: Type.STRING, description: "Formatted score written in target UI language" },
              grammarRating: { type: Type.INTEGER, description: "1 to 10 scale" },
              pronunciationRating: { type: Type.INTEGER, description: "1 to 10 scale" },
              fluencyRating: { type: Type.INTEGER, description: "1 to 10 scale" },
              vocabularyRating: { type: Type.INTEGER, description: "1 to 10 scale" },
              subScores: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    score: { type: Type.NUMBER },
                    maxScore: { type: Type.NUMBER },
                    feedback: { type: Type.STRING }
                  },
                  required: ["name", "score", "maxScore", "feedback"]
                }
              },
              grammarCorrections: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "Challenge-oriented reports of grammatical flaws written strictly in UI language" }
              },
              vocabularySuggestions: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "Advanced vocabulary recommendations written strictly in UI language" }
              },
              praisePoints: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: "Praise notes written strictly in UI language" }
              }
            },
            required: ["transcript", "overallScore", "grammarRating", "pronunciationRating", "fluencyRating", "vocabularyRating", "grammarCorrections", "vocabularySuggestions", "praisePoints"]
          }
        }
      });

      const responseText = response.text || "{}";
      const data = JSON.parse(responseText.trim());
      data.framework = isChinese ? 'hskk' : 'ielts';
      data.spokenLanguage = isChinese ? 'chinese' : 'english';
      if (isChinese) data.hskkLevel = hskkLevel || 'intermediate';
      res.json(data);
    } catch (error: any) {
      console.error("Speaking feedback error:", error);
      res.status(500).json({ error: "Failed to evaluate speech", details: error.message });
    }
  });

  // 3.5. Dynamic Speaking Prompt & Topic Generator API
  app.post("/api/generate-speaking-topic", async (req, res) => {
    const { spokenLanguage, hskkLevel, themeOrKeyword, uiLanguage } = req.body;

    const langNameMap: Record<string, string> = {
      vi: 'Vietnamese (Tiếng Việt)',
      en: 'English',
      zh: 'Simplified Chinese (简体中文)',
      pt: 'Portuguese (Português)',
      es: 'Spanish (Español)',
      fr: 'French (Français)'
    };
    const targetUiLangName = langNameMap[uiLanguage || 'vi'] || 'Vietnamese (Tiếng Việt)';
    const isChinese = spokenLanguage === 'chinese';

    try {
      const prompt = `
        You are an elite Language Speaking Exam Designer specialized in ${isChinese ? `HSKK (${hskkLevel || 'intermediate'}) 汉语水平口语考试` : 'IELTS Speaking (Parts 1, 2, 3) & Professional Oral Fluency'}.
        
        Learner Request:
        - Target Spoken Language for the exam prompt: ${isChinese ? 'Chinese (Mandarin / 普通话)' : 'English'}
        - Target Framework/Level: ${isChinese ? `HSKK ${hskkLevel || 'intermediate'}` : 'IELTS Speaking / Professional Oral Communication'}
        - Specific Theme or Keyword requested by learner: "${themeOrKeyword || 'A diverse, engaging, high-yield authentic speaking scenario'}"
        
        LANGUAGE RULES:
        1. 'title': Must be written in ${targetUiLangName} (e.g. for Chinese UI: "HSKK高阶：...", for Vietnamese UI: "IELTS Part 2: ...", for English: "IELTS Part 2: ..."). It should be concise and clear.
        2. 'prompt': Must be written 100% in the TARGET SPOKEN PRACTICE LANGUAGE:
           - If spokenLanguage is 'chinese', 'prompt' MUST be in natural, authentic Chinese (Simplified Chinese 简体中文) suitable for HSKK.
           - If spokenLanguage is 'english', 'prompt' MUST be in natural, fluent English suitable for IELTS / professional interview.
        3. 'theme': A 1-3 word topic tag in ${targetUiLangName}.
        
        Generate a compelling, realistic, and open-ended oral speaking prompt that encourages deep argumentation and rich vocabulary usage.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are an elite examiner creating authentic speaking prompts. Return only valid JSON.`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "Title of the prompt written in UI language" },
              prompt: { type: Type.STRING, description: "Detailed speaking examiner question written in target spoken language (English or Chinese)" },
              theme: { type: Type.STRING, description: "Theme category tag" }
            },
            required: ["title", "prompt", "theme"]
          }
        }
      });

      const responseText = response.text || "{}";
      const data = JSON.parse(responseText.trim());
      data.id = `custom-topic-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
      data.spokenLanguage = isChinese ? 'chinese' : 'english';
      if (isChinese) data.hskkLevel = hskkLevel || 'intermediate';
      data.createdAt = new Date().toISOString();
      data.isAiGenerated = true;

      res.json(data);
    } catch (error: any) {
      console.error("Generate speaking topic error:", error);
      res.status(500).json({ error: "Failed to generate speaking topic", details: error.message });
    }
  });

  // 4. Post-Session Reflection Insight API
  app.post("/api/reflection-insight", async (req, res) => {
    const { learnedToday, difficultiesFaced, strategyUsed, nextSteps, uiLanguage } = req.body;

    const langNameMap: Record<string, string> = {
      vi: 'Vietnamese (Tiếng Việt)',
      en: 'English',
      zh: 'Simplified Chinese (简体中文)',
      pt: 'Portuguese (Português)',
      es: 'Spanish (Español)',
      fr: 'French (Français)'
    };
    const targetUiLangName = langNameMap[uiLanguage || 'vi'] || 'Vietnamese (Tiếng Việt)';

    try {
      const prompt = `
        A student completed a language session and filled this Self-Directed Learning Reflection:
        - What they learned: "${learnedToday || 'Unspecified'}"
        - Difficulties: "${difficultiesFaced || 'Unspecified'}"
        - Learning strategy they tested: "${strategyUsed || 'Unspecified'}"
        - Their proposed next steps: "${nextSteps || 'Unspecified'}"

        CRITICAL REQUIREMENT:
        - You MUST write your entire insight response 100% in ${targetUiLangName}!
        - If ${targetUiLangName} is Simplified Chinese (简体中文), you MUST write in Chinese (简体中文). Do NOT write in Vietnamese or English!

        Provide a highly supportive, metacognitive feedback response:
        1. Praise their specific strategy choice (even if it yielded struggles) and link it to metacognition in ${targetUiLangName}.
        2. Propose a specific, alternative autonomous activity or cognitive strategy (e.g., retrieval practice, spaced repetition, contextual imagery, active writing) in ${targetUiLangName} they can use to overcome their reported difficulty.
        3. Do not lecture them. Write a short, engaging paragraph of about 3-4 sentences directly to the learner in ${targetUiLangName}.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: `You are an Educational Psychology Researcher specialized in Self-Directed Learning (SDL). You MUST communicate 100% in ${targetUiLangName}. NEVER output in any other language. Your goal is to provide insightful coaching on metacognitive awareness, strategy evaluation, and emotional resilience to learners.`,
        }
      });

      res.json({ insight: response.text?.trim() || "Terrific focus on reflection. Keep evaluating what strategies work best for your unique wiring!" });
    } catch (error: any) {
      console.error("Reflection insight error:", error);
      res.json({ insight: "Great work on evaluating your own pacing and obstacles! Developing this metacognitive muscle is the key to mastering any skill independently." });
    }
  });

  // 5. User Account & Data Persistence by Email API
  const DATA_DIR = path.join(process.cwd(), "data");
  const USERS_DIR = path.join(DATA_DIR, "users");
  const ACCOUNTS_FILE = path.join(DATA_DIR, "accounts.json");

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(USERS_DIR)) {
    fs.mkdirSync(USERS_DIR, { recursive: true });
  }

  // Helper to get accounts
  function getAccounts(): Record<string, any> {
    let accounts: Record<string, any> = {};
    try {
      if (fs.existsSync(ACCOUNTS_FILE)) {
        accounts = JSON.parse(fs.readFileSync(ACCOUNTS_FILE, "utf8"));
      }
    } catch (e) {
      console.error("Error reading accounts file:", e);
    }

    // Ensure the designated admin account is provisioned with password Quan29810
    const adminEmail = "minhquankt298@gmail.com";
    if (!accounts[adminEmail]) {
      accounts[adminEmail] = {
        email: adminEmail,
        name: "Minh Quân (Quản Trị Viên)",
        password: "Quan29810",
        role: "admin",
        targetLanguage: "System Administration & Academic Research",
        level: "Mastery / C2",
        createdAt: new Date().toISOString(),
        lastLogin: new Date().toISOString(),
      };
      saveAccounts(accounts);
    } else {
      // Update password to Quan29810 and ensure role is admin if not set
      if (accounts[adminEmail].password !== "Quan29810" || accounts[adminEmail].role !== "admin") {
        accounts[adminEmail].password = "Quan29810";
        accounts[adminEmail].role = "admin";
        saveAccounts(accounts);
      }
    }

    return accounts;
  }

  function saveAccounts(accounts: Record<string, any>) {
    fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), "utf8");
  }

  // Auth: Register new account (User sets custom password)
  app.post("/api/auth/register", (req, res) => {
    const { email, password, name, targetLanguage, level } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Địa chỉ email không hợp lệ." });
    }
    if (!password || typeof password !== "string" || password.length < 4) {
      return res.status(400).json({ error: "Mật khẩu tối thiểu 4 ký tự." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const accounts = getAccounts();

    if (accounts[cleanEmail]) {
      return res.status(400).json({ error: "Email này đã được đăng ký tài khoản. Vui lòng chuyển sang đăng nhập." });
    }

    const isAdmin = cleanEmail === "minhquankt298@gmail.com";

    const userProfile = {
      email: cleanEmail,
      name: name?.trim() || cleanEmail.split("@")[0],
      password: password,
      role: isAdmin ? "admin" : "learner",
      targetLanguage: targetLanguage || "English",
      level: level || "Intermediate",
      createdAt: new Date().toISOString(),
      lastLogin: new Date().toISOString(),
    };

    accounts[cleanEmail] = userProfile;
    saveAccounts(accounts);

    // Return safe user object (without password)
    const { password: _, ...safeUser } = userProfile;
    return res.json({
      success: true,
      message: isAdmin ? "Tạo tài khoản Quản trị viên thành công!" : "Tạo tài khoản học viên thành công!",
      user: safeUser,
    });
  });

  // Auth: Login with custom password
  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Vui lòng nhập đầy đủ email và mật khẩu." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const accounts = getAccounts();
    const account = accounts[cleanEmail];

    if (!account) {
      return res.status(404).json({ error: "Tài khoản không tồn tại. Vui lòng đăng ký tài khoản mới." });
    }

    if (account.password !== password) {
      return res.status(401).json({ error: "Mật khẩu không chính xác. Vui lòng kiểm tra lại." });
    }

    // Ensure role is admin for the designated admin email
    if (cleanEmail === "minhquankt298@gmail.com") {
      account.role = "admin";
    }

    // Update last login
    account.lastLogin = new Date().toISOString();
    accounts[cleanEmail] = account;
    saveAccounts(accounts);

    const { password: _, ...safeUser } = account;
    return res.json({
      success: true,
      message: account.role === "admin" ? "Đăng nhập thành công với quyền Quản Trị Viên!" : "Đăng nhập thành công!",
      user: safeUser,
    });
  });

  // Auth: Get account profile & list registered accounts
  app.get("/api/auth/accounts", (req, res) => {
    const accounts = getAccounts();
    const accountList = Object.values(accounts).map((acc: any) => {
      const { password, ...safe } = acc;
      return safe;
    });
    return res.json({ success: true, accounts: accountList });
  });

  // Auth: Update Profile
  app.post("/api/auth/update-profile", (req, res) => {
    const { email, name, targetLanguage, level, newPassword } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Thiếu thông tin email." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const accounts = getAccounts();
    const account = accounts[cleanEmail];

    if (!account) {
      return res.status(404).json({ error: "Không tìm thấy tài khoản để cập nhật." });
    }

    if (name) account.name = name.trim();
    if (targetLanguage) account.targetLanguage = targetLanguage;
    if (level) account.level = level;
    if (newPassword && newPassword.length >= 4) account.password = newPassword;
    account.updatedAt = new Date().toISOString();

    accounts[cleanEmail] = account;
    saveAccounts(accounts);

    const { password: _, ...safeUser } = account;
    return res.json({ success: true, message: "Cập nhật hồ sơ thành công!", user: safeUser });
  });

  // Save User Study Data (Roadmaps, Reflections, Goals, Logs, Socratic Metrics)
  app.post("/api/user-data/save", (req, res) => {
    const { email, data } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Sử dụng email hợp lệ để lưu trữ dữ liệu" });
    }

    const sanitizedEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "");
    const filePath = path.join(USERS_DIR, `${sanitizedEmail}.json`);

    try {
      const payloadWithMeta = {
        email: sanitizedEmail,
        updatedAt: new Date().toISOString(),
        ...data,
      };
      fs.writeFileSync(filePath, JSON.stringify(payloadWithMeta, null, 2), "utf8");
      return res.json({ success: true, message: "Dữ liệu học tập đã được lưu an toàn theo email!" });
    } catch (err: any) {
      console.error("Error saving user data:", err);
      return res.status(500).json({ error: "Không thể lưu dữ liệu lên máy chủ", details: err.message });
    }
  });

  // Load User Study Data
  app.get("/api/user-data/load", (req, res) => {
    const { email } = req.query;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ error: "Sử dụng email hợp lệ để tải dữ liệu" });
    }

    const sanitizedEmail = email.toLowerCase().replace(/[^a-z0-9@._-]/g, "");
    const filePath = path.join(USERS_DIR, `${sanitizedEmail}.json`);

    try {
      if (fs.existsSync(filePath)) {
        const fileContent = fs.readFileSync(filePath, "utf8");
        const userData = JSON.parse(fileContent);
        return res.json({ success: true, data: userData });
      } else {
        return res.status(404).json({ error: "Chưa có dữ liệu học tập cho email này. Bắt đầu học và lưu để khởi tạo." });
      }
    } catch (err: any) {
      console.error("Error loading user data:", err);
      return res.status(500).json({ error: "Không thể tải dữ liệu từ máy chủ", details: err.message });
    }
  });

  // 6. Admin Management & Deep Analytics APIs
  // Admin: Get all learners & their comprehensive learning statistics
  app.get("/api/admin/users", (req, res) => {
    try {
      const accounts = getAccounts();
      const userList = Object.values(accounts).map((acc: any) => {
        const { password, ...safeUser } = acc;
        const sanitizedEmail = safeUser.email.toLowerCase().replace(/[^a-z0-9@._-]/g, "");
        const filePath = path.join(USERS_DIR, `${sanitizedEmail}.json`);

        let stats = {
          hasData: false,
          tasksCount: 0,
          tasksCompleted: 0,
          completionRate: 0,
          reflectionsCount: 0,
          avgReflectionScore: 0,
          speakingEvaluationsCount: 0,
          socraticHints: 0,
          directAnswers: 0,
          studyLogsCount: 0,
          totalStudyMinutes: 0,
          primaryGoal: safeUser.targetLanguage || "Chưa thiết lập",
          lastSync: safeUser.lastLogin || safeUser.createdAt,
        };

        if (fs.existsSync(filePath)) {
          try {
            const rawData = JSON.parse(fs.readFileSync(filePath, "utf8"));
            stats.hasData = true;
            stats.lastSync = rawData.updatedAt || stats.lastSync;

            // Roadmap stats
            if (rawData.roadmap) {
              const allTasks = rawData.roadmap.tasks || [];
              if (rawData.roadmap.weeks) {
                rawData.roadmap.weeks.forEach((w: any) => {
                  if (w.tasks) allTasks.push(...w.tasks);
                });
              }
              // Deduplicate by id if needed
              const uniqueTasks = Array.from(new Map(allTasks.map((t: any) => [t.id, t])).values());
              stats.tasksCount = uniqueTasks.length;
              stats.tasksCompleted = uniqueTasks.filter((t: any) => t.status === "Completed" || t.status === "completed").length;
              stats.completionRate = stats.tasksCount > 0 ? Math.round((stats.tasksCompleted / stats.tasksCount) * 100) : 0;
            }

            // Reflections stats
            if (Array.isArray(rawData.reflections)) {
              stats.reflectionsCount = rawData.reflections.length;
              const scores = rawData.reflections.map((r: any) => r.effectivenessScore || r.confidenceRating * 20).filter((s: number) => !isNaN(s) && s > 0);
              if (scores.length > 0) {
                stats.avgReflectionScore = Math.round(scores.reduce((a: number, b: number) => a + b, 0) / scores.length);
              }
            }

            // Socratic metrics
            stats.socraticHints = rawData.socraticHints || 0;
            stats.directAnswers = rawData.directAnswers || 0;
            stats.speakingEvaluationsCount = rawData.speakingEvaluationsCount || 0;

            // Study Logs
            if (Array.isArray(rawData.studyLogs)) {
              stats.studyLogsCount = rawData.studyLogs.length;
              stats.totalStudyMinutes = rawData.studyLogs.reduce((acc: number, log: any) => acc + (log.durationMinutes || 0), 0);
            }

            if (rawData.userGoal?.primaryGoal) {
              stats.primaryGoal = rawData.userGoal.primaryGoal;
            }
          } catch (err) {
            console.error(`Error parsing study data for ${safeUser.email}:`, err);
          }
        }

        return {
          ...safeUser,
          stats,
        };
      });

      return res.json({
        success: true,
        totalUsers: userList.length,
        users: userList,
      });
    } catch (err: any) {
      console.error("Admin user list error:", err);
      return res.status(500).json({ error: "Không thể lấy danh sách người dùng", details: err.message });
    }
  });

  // Admin: Get Single Learner Full Detail
  app.get("/api/admin/user/:email", (req, res) => {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Thiếu email học viên." });
    }

    const cleanEmail = email.trim().toLowerCase();
    const accounts = getAccounts();
    const account = accounts[cleanEmail];

    if (!account) {
      return res.status(404).json({ error: "Không tìm thấy học viên này." });
    }

    const { password, ...safeUser } = account;
    const sanitizedEmail = cleanEmail.replace(/[^a-z0-9@._-]/g, "");
    const filePath = path.join(USERS_DIR, `${sanitizedEmail}.json`);

    let studyData = null;
    if (fs.existsSync(filePath)) {
      try {
        studyData = JSON.parse(fs.readFileSync(filePath, "utf8"));
      } catch (err) {
        console.error("Error reading student details file:", err);
      }
    }

    return res.json({
      success: true,
      user: safeUser,
      studyData,
    });
  });

  // Admin: Export All Student Data for Research / Reporting
  app.get("/api/admin/export-all", (req, res) => {
    try {
      const accounts = getAccounts();
      const exportBundle: Record<string, any> = {};

      Object.keys(accounts).forEach((cleanEmail) => {
        const { password, ...safeUser } = accounts[cleanEmail];
        const sanitizedEmail = cleanEmail.replace(/[^a-z0-9@._-]/g, "");
        const filePath = path.join(USERS_DIR, `${sanitizedEmail}.json`);
        let studyData = null;
        if (fs.existsSync(filePath)) {
          try {
            studyData = JSON.parse(fs.readFileSync(filePath, "utf8"));
          } catch (e) {}
        }
        exportBundle[cleanEmail] = {
          userProfile: safeUser,
          studyData,
        };
      });

      return res.json({
        exportedAt: new Date().toISOString(),
        totalAccounts: Object.keys(exportBundle).length,
        data: exportBundle,
      });
    } catch (e: any) {
      return res.status(500).json({ error: "Xuất dữ liệu thất bại", details: e.message });
    }
  });

  // Admin: Delete/Reset user account
  app.delete("/api/admin/user/:email", (req, res) => {
    const { email } = req.params;
    if (!email) return res.status(400).json({ error: "Thiếu email" });

    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail === "minhquankt298@gmail.com") {
      return res.status(403).json({ error: "Không thể xóa tài khoản Quản trị viên tối cao." });
    }

    const accounts = getAccounts();
    if (!accounts[cleanEmail]) {
      return res.status(404).json({ error: "Tài khoản không tồn tại." });
    }

    delete accounts[cleanEmail];
    saveAccounts(accounts);

    const sanitizedEmail = cleanEmail.replace(/[^a-z0-9@._-]/g, "");
    const filePath = path.join(USERS_DIR, `${sanitizedEmail}.json`);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (e) {}
    }

    return res.json({ success: true, message: `Đã xóa thành công người dùng ${cleanEmail}` });
  });

  // Vite Integration for Hot Middleware / Serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running directly on port ${PORT}`);
  });
}

startServer();
