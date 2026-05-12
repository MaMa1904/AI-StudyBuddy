import { GoogleGenAI } from '@google/genai';
import { config } from '../config/env';
import { SummarySection, Flashcard, QuizQuestion } from '../types';

// ── Initialise client ─────────────────────────────────────────
const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });

// ── Retry with exponential backoff ────────────────────────────
async function generate(prompt: string, retries = 3): Promise<string> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: config.gemini.model,
        contents: prompt,
        config: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 8192,
        },
      });
      return response.text ?? '';
    } catch (err: any) {
      lastError = err;
      const isRetryable = err.status === 429 || err.status === 503 || err.code === 'ECONNRESET';
      if (!isRetryable || attempt === retries - 1) break;

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      console.warn(`[Gemini] Retry ${attempt + 1}/${retries} after ${delay}ms — ${err.message}`);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  throw lastError ?? new Error('Gemini generation failed after retries');
}

// ── Strip markdown code fences from Gemini JSON responses ─────
function parseJSON<T>(raw: string): T {
  const cleaned = raw
    .replace(/^```json\s*/im, '')
    .replace(/^```\s*/im, '')
    .replace(/```\s*$/im, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (e) {
    throw new Error(`Gemini returned invalid JSON. Raw response (first 200 chars): ${cleaned.slice(0, 200)}`);
  }
}

// ── Truncate text to stay within token limits ─────────────────
function truncate(text: string, maxChars = 60000): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + '\n\n[Document truncated for processing...]';
}

// ── Sanitize user text before embedding in prompts ────────────
function sanitizeForPrompt(text: string): string {
  // Strip control characters (except newlines/tabs) to prevent prompt injection
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

// ─────────────────────────────────────────────────────────────
// 1. GENERATE SUMMARIES
// ─────────────────────────────────────────────────────────────
export async function generateSummaries(
  _docId: string,
  text: string,
  subject: string
): Promise<SummarySection[]> {
  const prompt = `
You are an expert academic tutor. Analyze the following document and generate structured study summaries.

Document subject: ${sanitizeForPrompt(subject)}
Document text:
${truncate(sanitizeForPrompt(text), 50000)}

Generate exactly 3 summary sections. Respond with ONLY a valid JSON array, no markdown fences:
[
  {
    "id": "summary",
    "icon": "ti-bolt",
    "iconColor": "#FBBF24",
    "title": "Chapter Summary",
    "expanded": true,
    "content": "A comprehensive 3-4 sentence overview of the entire document.",
    "keyPoints": ["key point 1", "key point 2", "key point 3", "key point 4", "key point 5"]
  },
  {
    "id": "exam",
    "icon": "ti-notebook",
    "iconColor": "#818CF8",
    "title": "Exam-Focused Notes",
    "expanded": false,
    "content": "Topics most likely to appear in exams based on emphasis in the text.",
    "keyPoints": ["exam topic 1", "exam topic 2", "exam topic 3", "exam topic 4"]
  },
  {
    "id": "revision",
    "icon": "ti-list-check",
    "iconColor": "#10B981",
    "title": "Quick Revision Points",
    "expanded": false,
    "content": "Condensed one-line facts for last-minute review.",
    "keyPoints": ["fact 1", "fact 2", "fact 3", "fact 4", "fact 5", "fact 6"]
  }
]

Rules:
- Be specific to the actual document content, not generic
- Key points must be concise (max 15 words each)
- Focus on the most important concepts
- Use simple, clear language
`;

  const raw = await generate(prompt);
  return parseJSON<SummarySection[]>(raw);
}

// ─────────────────────────────────────────────────────────────
// 2. GENERATE FLASHCARDS
// ─────────────────────────────────────────────────────────────
export async function generateFlashcards(
  docId: string,
  text: string,
  subject: string,
  count = 15
): Promise<Flashcard[]> {
  const prompt = `
You are an expert academic tutor creating spaced-repetition flashcards.

Document subject: ${sanitizeForPrompt(subject)}
Document text:
${truncate(sanitizeForPrompt(text), 45000)}

Generate exactly ${count} flashcards. Respond with ONLY a valid JSON array, no markdown fences:
[
  {
    "front": "Question or term on the front of the card",
    "back": "Complete answer or explanation on the back",
    "type": "definition",
    "difficulty": "easy"
  }
]

Rules:
- "type": one of "definition" | "formula" | "fill-in"
- "difficulty": one of "easy" | "medium" | "hard"
- front: max 20 words
- back: max 60 words, complete and accurate
- Mix: ~50% definition, ~25% formula, ~25% fill-in
- Mix difficulty: ~30% easy, ~50% medium, ~20% hard
- Be specific to the actual document content
`;

  const raw = await generate(prompt);
  const cards = parseJSON<{ front: string; back: string; type: string; difficulty: string }[]>(raw);

  return cards.map((c, i) => ({
    id: `${docId}_fc_${i}_${Date.now()}`,
    docId,
    front: c.front,
    back: c.back,
    type: c.type as Flashcard['type'],
    difficulty: c.difficulty as Flashcard['difficulty'],
    subject,
    isFavorite: false,
    spacedRepetitionScore: 0,
  }));
}

// ─────────────────────────────────────────────────────────────
// 3. GENERATE QUIZ QUESTIONS
// ─────────────────────────────────────────────────────────────
export async function generateQuizQuestions(
  docId: string,
  text: string,
  subject: string,
  count = 10
): Promise<QuizQuestion[]> {
  const prompt = `
You are an expert academic exam setter.

Document subject: ${sanitizeForPrompt(subject)}
Document text:
${truncate(sanitizeForPrompt(text), 45000)}

Generate exactly ${count} quiz questions. Respond with ONLY a valid JSON array, no markdown fences:
[
  {
    "text": "The full question text?",
    "type": "mcq",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": 0,
    "explanation": "Why this answer is correct.",
    "difficulty": "medium"
  }
]

Rules:
- "type": "mcq" (4 options) or "true-false" (options: ["True","False"])
- "correctAnswer": a NUMBER index (0-3 for mcq, 0 or 1 for true-false)
- "difficulty": "easy" | "medium" | "hard"
- Mix: ~60% mcq, ~40% true-false
- Mix difficulty: ~30% easy, ~50% medium, ~20% hard
- Questions must be answerable from the document only
- Explanation: 1-2 sentences, specific to the document
`;

  const raw = await generate(prompt);
  const questions = parseJSON<{
    text: string; type: string; options: string[];
    correctAnswer: number; explanation: string; difficulty: string;
  }[]>(raw);

  return questions.map((q, i) => ({
    id: `${docId}_q_${i}_${Date.now()}`,
    docId,
    text: q.text,
    type: q.type as QuizQuestion['type'],
    options: q.options,
    correctAnswer: Number(q.correctAnswer),
    explanation: q.explanation,
    difficulty: q.difficulty as QuizQuestion['difficulty'],
  }));
}

// ─────────────────────────────────────────────────────────────
// 4. GENERATE ALL (parallel)
// ─────────────────────────────────────────────────────────────
export async function generateAll(
  docId: string,
  text: string,
  subject: string
): Promise<{ summaries: SummarySection[]; flashcards: Flashcard[]; questions: QuizQuestion[] }> {
  const [summaries, flashcards, questions] = await Promise.all([
    generateSummaries(docId, text, subject),
    generateFlashcards(docId, text, subject, 15),
    generateQuizQuestions(docId, text, subject, 10),
  ]);
  return { summaries, flashcards, questions };
}

// ─────────────────────────────────────────────────────────────
// 5. EXTRACT KEYWORDS
// ─────────────────────────────────────────────────────────────
export async function extractKeywords(text: string): Promise<string[]> {
  const prompt = `
Extract the 10 most important keywords or key phrases from this academic text.
Respond with ONLY a JSON array of strings, no markdown fences:
["keyword1", "keyword2", ...]

Text:
${truncate(sanitizeForPrompt(text), 10000)}
`;
  const raw = await generate(prompt);
  return parseJSON<string[]>(raw);
}

// ─────────────────────────────────────────────────────────────
// 6. SIMPLER EXPLANATION
// ─────────────────────────────────────────────────────────────
export async function simplerExplanation(content: string, subject: string): Promise<string> {
  const prompt = `
Rewrite the following academic content in simple language suitable for a high school student.
Keep it concise (max 150 words). Plain text only, no JSON, no markdown.

Subject: ${sanitizeForPrompt(subject)}
Content: ${sanitizeForPrompt(content)}
`;
  return (await generate(prompt)).trim();
}

// ─────────────────────────────────────────────────────────────
// 7. EXPAND DETAIL
// ─────────────────────────────────────────────────────────────
export async function expandDetail(content: string, subject: string): Promise<string> {
  const prompt = `
You are an expert academic tutor. Expand the following summary into a detailed explanation
suitable for university-level study. Include deeper explanations, real-world examples,
and connections to related topics. Max 400 words. Plain text only, no JSON, no markdown headers.

Subject: ${sanitizeForPrompt(subject)}
Summary: ${sanitizeForPrompt(content)}
`;
  return (await generate(prompt)).trim();
}
