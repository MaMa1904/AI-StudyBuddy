import { Injectable, signal, inject, effect } from '@angular/core';
import { Flashcard, QuizQuestion, UploadedDocument, StudyStats, QuizAttempt, UserData } from '../models/study.models';
import { AuthService } from './auth.service';

const GUEST_KEY = 'sb_guest';

@Injectable({ providedIn: 'root' })
export class StudyDataService {
  private auth = inject(AuthService);

  // ── Reactive state (always reflects current user or guest) ────
  documents    = signal<UploadedDocument[]>([]);
  flashcards   = signal<Flashcard[]>([]);
  quizAttempts = signal<QuizAttempt[]>([]);
  stats        = signal<StudyStats>(this.emptyStats());

  constructor() {
    // Load data whenever auth state changes
    effect(() => {
      const user = this.auth.currentUser();
      if (user) {
        this.loadFromUser();
      } else {
        this.loadFromGuest();
      }
    });
  }

  // ── Load / Save ───────────────────────────────────────────────
  private loadFromUser() {
    const data = this.auth.getUserData();
    if (data) {
      this.documents.set(data.documents ?? []);
      this.flashcards.set(data.flashcards ?? []);
      this.quizAttempts.set(data.quizAttempts ?? []);
      this.stats.set(data.stats ?? this.emptyStats());
    } else {
      this.resetToEmpty();
    }
  }

  private loadFromGuest() {
    const raw = localStorage.getItem(GUEST_KEY);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        this.documents.set(data.documents ?? []);
        this.flashcards.set(data.flashcards ?? []);
        this.quizAttempts.set(data.quizAttempts ?? []);
        this.stats.set(data.stats ?? this.emptyStats());
      } catch {
        this.resetToEmpty();
      }
    } else {
      this.resetToEmpty();
    }
  }

  private persist() {
    const user = this.auth.currentUser();
    const payload = {
      documents: this.documents(),
      flashcards: this.flashcards(),
      quizAttempts: this.quizAttempts(),
      stats: this.stats(),
    };
    if (user) {
      const existing = this.auth.getUserData();
      if (existing) {
        this.auth.saveUserData({ ...existing, ...payload });
      }
    } else {
      localStorage.setItem(GUEST_KEY, JSON.stringify(payload));
    }
  }

  private resetToEmpty() {
    this.documents.set([]);
    this.flashcards.set([]);
    this.quizAttempts.set([]);
    this.stats.set(this.emptyStats());
  }

  private emptyStats(): StudyStats {
    return {
      documents: 0,
      cardsStudied: 0,
      quizzesDone: 0,
      studyHours: 0,
      streak: 0,
      lastStudied: null,
      activityLog: [],
      quizScores: [],
    };
  }

  // ── Documents ─────────────────────────────────────────────────
  addDocument(doc: UploadedDocument) {
    this.documents.update(docs => [doc, ...docs]);
    this.stats.update(s => ({ ...s, documents: s.documents + 1 }));
    this.persist();
  }

  updateDocumentProgress(id: string, progress: number) {
    this.documents.update(docs =>
      docs.map(d => d.id === id
        ? { ...d, progress, status: progress >= 100 ? 'ready' : 'processing' }
        : d)
    );
    this.persist();
  }

  removeDocument(id: string) {
    this.documents.update(docs => docs.filter(d => d.id !== id));
    this.flashcards.update(cards => cards.filter(c => c.docId !== id));
    this.stats.update(s => ({ ...s, documents: Math.max(0, s.documents - 1) }));
    this.persist();
  }

  // ── Flashcards ────────────────────────────────────────────────
  addFlashcards(cards: Flashcard[]) {
    this.flashcards.update(existing => [...existing, ...cards]);
    this.persist();
  }

  toggleFavorite(id: string) {
    this.flashcards.update(cards =>
      cards.map(c => c.id === id ? { ...c, isFavorite: !c.isFavorite } : c)
    );
    this.persist();
  }

  markCardReviewed(id: string, difficulty: 'easy' | 'medium' | 'hard') {
    const scoreMap = { easy: 1, medium: 0, hard: -1 };
    this.flashcards.update(cards =>
      cards.map(c => c.id === id
        ? { ...c, spacedRepetitionScore: Math.max(0, c.spacedRepetitionScore + scoreMap[difficulty]), lastReviewed: new Date().toISOString() }
        : c)
    );
    this.stats.update(s => ({ ...s, cardsStudied: s.cardsStudied + 1 }));
    this.recordStudyTime(0.02); // ~1 min per card
    this.persist();
  }

  // ── Quiz Attempts ─────────────────────────────────────────────
  saveQuizAttempt(attempt: QuizAttempt) {
    this.quizAttempts.update(a => [attempt, ...a]);
    this.stats.update(s => {
      const scores = [attempt.score, ...(s.quizScores ?? [])].slice(0, 7);
      return { ...s, quizzesDone: s.quizzesDone + 1, quizScores: scores };
    });
    this.recordStudyTime(attempt.timeTaken / 3600);
    this.persist();
  }

  // ── Study Time & Streak ───────────────────────────────────────
  recordStudyTime(hours: number) {
    const today = new Date().toISOString().split('T')[0];
    this.stats.update(s => {
      const log = [...(s.activityLog ?? [])];
      if (!log.includes(today)) log.push(today);
      const streak = this.calcStreak(log);
      return {
        ...s,
        studyHours: Math.round((s.studyHours + hours) * 100) / 100,
        activityLog: log,
        streak,
        lastStudied: today,
      };
    });
    this.persist();
  }

  private calcStreak(log: string[]): number {
    if (!log.length) return 0;
    const sorted = [...log].sort().reverse();
    const today = new Date().toISOString().split('T')[0];
    let streak = 0;
    let check = today;
    for (const day of sorted) {
      if (day === check) {
        streak++;
        const d = new Date(check);
        d.setDate(d.getDate() - 1);
        check = d.toISOString().split('T')[0];
      } else if (day < check) {
        break;
      }
    }
    return streak;
  }

  // ── Computed helpers ──────────────────────────────────────────
  getFlashcardsForDoc(docId: string): Flashcard[] {
    return this.flashcards().filter(c => c.docId === docId);
  }

  getQuizQuestionsForDoc(docId: string): QuizQuestion[] {
    const doc = this.documents().find(d => d.id === docId);
    return doc?.quizQuestions ?? [];
  }

  getSubjectProgress(): { name: string; pct: number; color: string }[] {
    const cards = this.flashcards();
    if (!cards.length) return [];
    const subjects = [...new Set(cards.map(c => c.subject))];
    const colors = ['var(--grad)', 'linear-gradient(135deg,#7C3AED,#EC4899)', 'linear-gradient(135deg,#10B981,#059669)', 'linear-gradient(135deg,#2563EB,#4F46E5)'];
    return subjects.slice(0, 4).map((name, i) => {
      const subCards = cards.filter(c => c.subject === name);
      const reviewed = subCards.filter(c => c.lastReviewed).length;
      const pct = subCards.length > 0 ? Math.round((reviewed / subCards.length) * 100) : 0;
      return { name, pct, color: colors[i % colors.length] };
    });
  }

  // ── Utilities ─────────────────────────────────────────────────
  formatFileSize(bytes: number): string {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  timeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ── Public persist (used by workspace after AI updates) ───────
  persistNow() {
    this.persist();
  }
}
