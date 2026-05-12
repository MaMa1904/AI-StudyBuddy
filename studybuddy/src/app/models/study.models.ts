export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  uploadDate: string; // ISO string for JSON serialization
  status: 'processing' | 'ready' | 'error';
  progress: number;
  pages?: number;
  subject?: string;
  summaries?: SummarySection[];
  quizQuestions?: QuizQuestion[];
}

export interface SummarySection {
  id: string;
  icon: string;
  iconColor: string;
  title: string;
  expanded: boolean;
  content: string;
  keyPoints?: string[];
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
  lastReviewed?: string;
}

export interface QuizQuestion {
  id: string;
  docId: string;
  text: string;
  type: 'mcq' | 'true-false' | 'short-answer';
  options?: string[];
  correctAnswer: number; // always a numeric index — coerce with Number() when reading old data
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
}

export interface QuizAttempt {
  id: string;
  docId: string;
  docName: string;
  date: string;
  score: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeTaken: number;
  totalQuestions: number;
}

export interface QuizResult {
  totalQuestions: number;
  correct: number;
  wrong: number;
  skipped: number;
  timeTaken: number;
  score: number;
}

export interface StudyStats {
  documents: number;
  cardsStudied: number;
  quizzesDone: number;
  studyHours: number;
  streak: number;
  lastStudied: string | null;
  activityLog: string[]; // ISO date strings of study days
  quizScores: number[];  // last 7 quiz scores
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string; // initials
  createdAt: string;
}

export interface AccessibilitySettings {
  darkMode: boolean;
  fontSize: number;
  textToSpeech: boolean;
  dyslexiaMode: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
}

export interface UserData {
  user: User;
  stats: StudyStats;
  documents: UploadedDocument[];
  flashcards: Flashcard[];
  quizAttempts: QuizAttempt[];
}
