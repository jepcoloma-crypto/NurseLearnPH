import { createChildLogger } from "../utils/logger.js";

const logger = createChildLogger("gemini-service");

const apiKey = process.env.GEMINI_API_KEY || "";
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL = "gemini-3.6-flash";

export function isGeminiConfigured(): boolean {
  return !!apiKey;
}

// ─── Raw API Call ────────────────────────────────────────────────────────────

async function callGemini(model: string, contents: Array<{ parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> }>): Promise<string> {
  if (!apiKey) throw new Error("Gemini API key not configured. Set GEMINI_API_KEY in .env");

  const url = `${GEMINI_API_URL}/${model}:generateContent`;
  const MAX_ATTEMPTS = 5;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-goog-api-key": apiKey,
        },
        body: JSON.stringify({ contents }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const error = await response.text();
        // 429 = quota/rate limit. The daily free-tier quota won't clear inside a
        // backoff window, so fail fast and let the caller fall back to mock
        // content instead of sleeping through 40s+ of retries.
        if (response.status === 429) {
          logger.warn({ error }, "Gemini rate/quota limited (429); failing fast to mock fallback");
          throw new Error(`Gemini API error: ${response.status} - ${error}`);
        }
        // Retry transient overload/server errors with backoff
        const transient = response.status === 503 || response.status === 500;
        if (transient && attempt < MAX_ATTEMPTS) {
          lastError = new Error(`Gemini API error: ${response.status} - ${error}`);
          logger.warn({ status: response.status, attempt }, "Gemini transient error, retrying");
          await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 1500, 20000)));
          continue;
        }
        logger.error({ status: response.status, error }, "Gemini API error");
        throw new Error(`Gemini API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };

      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error("No text in Gemini response");

      return text;
    } catch (err) {
      clearTimeout(timeout);
      const name = (err as Error).name;
      // Network/abort errors are retryable
      if (attempt < MAX_ATTEMPTS && (name === "AbortError" || name === "TypeError")) {
        lastError = err as Error;
        logger.warn({ attempt, err: (err as Error).message }, "Gemini network error, retrying");
        await new Promise((r) => setTimeout(r, Math.min(2 ** attempt * 1500, 20000)));
        continue;
      }
      throw err;
    }
  }

  throw lastError ?? new Error("Gemini API failed after retries");
}

// ─── Text Generation ────────────────────────────────────────────────────────

export async function generateText(prompt: string): Promise<string> {
  return callGemini(DEFAULT_MODEL, [{ parts: [{ text: prompt }] }]);
}

// ─── Document Analysis (PDF/Image) ──────────────────────────────────────────

export interface AnalyzedContent {
  summary: string;
  keyConcepts: string[];
  learningObjectives: string[];
  suggestedLessonTitle: string;
  suggestedCategory: string;
  rawContent: string;
}

export async function analyzeDocument(
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<AnalyzedContent> {
  const base64Data = fileBuffer.toString("base64");

  const prompt = `You are a nursing education expert. Analyze this document and extract structured content.

Document: ${fileName}

Provide a JSON response with this exact structure:
{
  "summary": "2-3 paragraph summary of the document content",
  "keyConcepts": ["concept1", "concept2", ...],
  "learningObjectives": ["objective1", "objective2", ...],
  "suggestedLessonTitle": "A clear, descriptive title for this lesson",
  "suggestedCategory": "One of: Fundamentals, Medical-Surgical, Pediatrics, Obstetrics, Community Health, Psychiatric, Pharmacology, Leadership",
  "rawContent": "The full extracted text content from the document"
}

Focus on nursing-relevant content. Identify key medical/nursing terms, procedures, and concepts.`;

  const result = await callGemini(DEFAULT_MODEL, [
    {
      parts: [
        { text: prompt },
        { inlineData: { mimeType, data: base64Data } },
      ],
    },
  ]);

  return parseJsonResponse<AnalyzedContent>(result);
}

// ─── Question Generation ────────────────────────────────────────────────────

interface GeneratedQuestion {
  stem: string;
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE";
  options: { optionText: string; isCorrect: boolean }[];
  rationale: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  category: string;
  bloomLevel: string;
  explanation: string;
}

interface QuestionGenerationOptions {
  count: number;
  difficulty?: "EASY" | "MEDIUM" | "HARD";
  types?: ("MULTIPLE_CHOICE" | "TRUE_FALSE")[];
  category?: string;
}

export async function generateQuestions(
  content: string,
  options: QuestionGenerationOptions
): Promise<GeneratedQuestion[]> {
  const types = options.types?.join(", ") || "MULTIPLE_CHOICE, TRUE_FALSE";
  const difficulty = options.difficulty || "MEDIUM";

  const prompt = `You are a nursing education assessment expert. Generate ${options.count} unique, non-repeating exam questions based on the following content.

Content:
${content.substring(0, 15000)}

Requirements:
- Generate ${options.count} unique questions with NO duplicates
- Each question must cover a DIFFERENT aspect of the topic
- Types: ${types}
- Default difficulty: ${difficulty}
- Focus on higher-order thinking (analysis, application, evaluation)
- Include clear rationales for correct answers
- Questions should be suitable for BSN nursing students in the Philippines
- Avoid repeating similar concepts or phrasing

Return a JSON array with this structure:
[
  {
    "stem": "The question text",
    "type": "MULTIPLE_CHOICE or TRUE_FALSE",
    "options": [
      { "optionText": "Option A", "isCorrect": true },
      { "optionText": "Option B", "isCorrect": false },
      { "optionText": "Option C", "isCorrect": false },
      { "optionText": "Option D", "isCorrect": false }
    ],
    "rationale": "Why this answer is correct",
    "difficulty": "EASY/MEDIUM/HARD",
    "category": "Topic category",
    "bloomLevel": "Remember/Understand/Apply/Analyze/Evaluate/Create",
    "explanation": "Detailed explanation for learning"
  }
]

For TRUE_FALSE questions, use exactly 2 options: True and False.
For MULTIPLE_CHOICE, use exactly 4 options (A-D).`;

  const result = await callGemini(DEFAULT_MODEL, [{ parts: [{ text: prompt }] }]);
  return parseJsonResponse<GeneratedQuestion[]>(result);
}

// ─── Lesson Content Generation ──────────────────────────────────────────────

interface GeneratedLesson {
  title: string;
  description: string;
  content: string;
  objectives: string[];
  keyTerms: { term: string; definition: string }[];
  studyNotes: string;
  practiceQuestions: { question: string; answer: string }[];
}

export async function generateLessonFromContent(
  rawContent: string,
  title?: string
): Promise<GeneratedLesson> {
  const prompt = `You are a nursing education content developer. Transform the following raw content into a well-structured nursing lesson.

${title ? `Lesson Title: ${title}` : "Generate an appropriate lesson title."}

Raw Content:
${rawContent.substring(0, 20000)}

Create a comprehensive lesson with this JSON structure:
{
  "title": "Clear, descriptive lesson title",
  "description": "Brief overview of what this lesson covers (2-3 sentences)",
  "content": "Full lesson content in markdown format with headers, paragraphs, and clear explanations. Include clinical examples where appropriate.",
  "objectives": ["By the end of this lesson, students will be able to...", ...],
  "keyTerms": [{"term": "Medical/Nursing term", "definition": "Clear definition"}, ...],
  "studyNotes": "Concise study notes summarizing key points for review",
  "practiceQuestions": [{"question": "Review question", "answer": "Clear answer with explanation"}, ...]
}

Make the content:
- Evidence-based and current
- Relevant to Philippine nursing practice
- Appropriate for BSN students
- Include nursing considerations and patient safety tips
- Use clear, professional language`;

  const result = await callGemini(DEFAULT_MODEL, [{ parts: [{ text: prompt }] }]);
  return parseJsonResponse<GeneratedLesson>(result);
}

// ─── AI Tutor Chat ──────────────────────────────────────────────────────────

export async function generateTutorResponse(
  studentMessage: string,
  conversationHistory: string[],
  lessonContext?: string
): Promise<string> {
  const historyText = conversationHistory.length > 0
    ? `\n\nConversation History:\n${conversationHistory.join("\n")}`
    : "";

  const contextText = lessonContext
    ? `\n\nLesson Context:\n${lessonContext}`
    : "";

  const prompt = `You are an expert nursing tutor helping a BSN student in the Philippines. Be helpful, encouraging, and use the Socratic method when appropriate.

${contextText}${historyText}

Student: ${studentMessage}

Respond as a knowledgeable, patient nursing tutor. Use clinical examples when relevant. If the student is wrong, guide them to the correct answer rather than just telling them.`;

  return callGemini(DEFAULT_MODEL, [{ parts: [{ text: prompt }] }]);
}

// ─── Helper: Parse JSON from AI Response ────────────────────────────────────

function parseJsonResponse<T>(text: string): T {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/\{[\s\S]*\}/) || text.match(/\[[\s\S]*\]/);

  if (!jsonMatch) {
    throw new Error("Failed to parse AI response as JSON");
  }

  const jsonStr = jsonMatch[1] || jsonMatch[0];

  try {
    return JSON.parse(jsonStr) as T;
  } catch {
    const cleaned = jsonStr.replace(/[\r\n\t]/g, " ").replace(/\s+/g, " ");
    return JSON.parse(cleaned) as T;
  }
}
