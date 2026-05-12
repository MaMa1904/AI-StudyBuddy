// ── Shared types between backend and frontend ──────────────────

export interface SummarySection {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  expanded: boolean;
  content: string;
  keyPoints: string[];
}

export interface Flashcard {
  id: string;
  docId: string;
  front: string;
  back: string;
  type: 'definition' | 'formula' | 'fill-in';
  difficulty: 'easy' | 'medium' | 'hard';
  subject: string;
  isFavorite: boolean;
  spacedRepetitionScore: number;
}

export interface QuizQuestion {
  id: string;
  docId: string;
  text: string;
  type: 'mcq' | 'true-false' | 'short-answer';
  options: string[];
  correctAnswer: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface ProcessPdfResponse {
  docId: string;
  name: string;
  pages: number;
  subject: string;
  wordCount: number;
  extractedText: string; // truncated preview
  keywords: string[];
}

export interface GenerateSummaryResponse {
  docId: string;
  summaries: SummarySection[];
}

export interface GenerateFlashcardsResponse {
  docId: string;
  flashcards: Flashcard[];
}

export interface GenerateQuizResponse {
  docId: string;
  questions: QuizQuestion[];
}

export interface GenerateAllResponse {
  docId: string;
  summaries: SummarySection[];
  flashcards: Flashcard[];
  questions: QuizQuestion[];
}

export interface ApiError {
  error: string;
  details?: string;
}
