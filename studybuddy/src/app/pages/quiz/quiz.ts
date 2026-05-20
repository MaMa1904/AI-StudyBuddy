import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { StudyDataService } from '../../services/study-data.service';
import { AuthService } from '../../services/auth.service';
import { DownloadService } from '../../services/download.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal';
import { QuizQuestion, QuizResult, QuizAttempt } from '../../models/study.models';

type QuizState = 'setup' | 'active' | 'result';
type Difficulty = 'All' | 'Easy' | 'Medium' | 'Hard';

@Component({
  selector: 'app-quiz',
  imports: [RouterLink, FormsModule, AuthModalComponent],
  templateUrl: './quiz.html',
  styleUrl: './quiz.scss'
})
export class QuizComponent implements OnDestroy {
  data     = inject(StudyDataService);
  auth     = inject(AuthService);
  download = inject(DownloadService);
  Math     = Math;

  state            = signal<QuizState>('setup');
  currentIndex     = signal(0);
  selectedAnswer   = signal<number | null>(null);
  showFeedback     = signal(false);
  answers          = signal<(number | null)[]>([]);
  timeLeft         = signal(300);
  timerInterval: ReturnType<typeof setInterval> | null = null;
  quizFinished     = false; // guard against double-finish
  activeDifficulty = signal<Difficulty>('All');
  enableTimer      = signal(true);
  enableTimerChecked = true; // plain boolean for ngModel binding
  shuffleQuestions = signal(false);
  shuffleQuestionsChecked = false; // plain boolean for ngModel binding
  result           = signal<QuizResult | null>(null);
  showAuthModal    = signal(false);

  // Track actual start time for accurate elapsed time (works even when timer is disabled)
  private quizStartTime = 0;

  // Stable snapshot of questions for the active quiz — prevents re-shuffle on every read
  private activeQuestions = signal<QuizQuestion[]>([]);

  difficulties: Difficulty[] = ['All', 'Easy', 'Medium', 'Hard'];
  questionTypes = [
    { label: 'Multiple Choice', value: 'mcq',          checked: true },
    { label: 'True / False',    value: 'true-false',    checked: true },
    { label: 'Short Answer',    value: 'short-answer',  checked: false },
  ];

  // Collect all quiz questions from all documents
  allQuestions = computed<QuizQuestion[]>(() => {
    const questions: QuizQuestion[] = [];
    this.data.documents().forEach(doc => {
      if (doc.quizQuestions?.length) questions.push(...doc.quizQuestions);
    });
    return questions;
  });

  // Setup pool — used for the setup screen count display and startQuiz snapshot
  setupPool = computed<QuizQuestion[]>(() => {
    const d = this.activeDifficulty();
    let pool = this.allQuestions();
    if (!pool.length) return [];

    // Filter by question type — only include checked types
    const checkedTypes = this.questionTypes
      .filter(t => t.checked)
      .map(t => t.value);
    if (checkedTypes.length > 0 && checkedTypes.length < this.questionTypes.length) {
      const filtered = pool.filter(q => checkedTypes.includes(q.type));
      pool = filtered.length > 0 ? filtered : pool; // fall back to all if none match
    }

    // Filter by difficulty
    if (d !== 'All') {
      const filtered = pool.filter(q => q.difficulty === d.toLowerCase());
      pool = filtered.length > 0 ? filtered : pool; // fall back to all if none match
    }

    return pool;
  });

  // During an active quiz, use the stable snapshot; otherwise use the setup pool
  questions = computed<QuizQuestion[]>(() => {
    if (this.state() === 'active' || this.state() === 'result') {
      return this.activeQuestions();
    }
    return this.setupPool();
  });

  hasQuestions = computed(() => this.allQuestions().length > 0);

  currentQuestion = computed<QuizQuestion | null>(() =>
    this.questions()[this.currentIndex()] ?? null
  );

  progress = computed(() => {
    const total = this.questions().length;
    return total > 0 ? Math.round(((this.currentIndex() + 1) / total) * 100) : 0;
  });

  timerDisplay = computed(() => {
    const t = this.timeLeft();
    const m = Math.floor(t / 60).toString().padStart(2, '0');
    const s = (t % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  recentAttempts = computed(() => this.data.quizAttempts().slice(0, 5));

  startQuiz() {
    let qs = [...this.setupPool()];
    if (!qs.length) return;

    // Shuffle once at quiz start if enabled — creates a stable order for the session
    if (this.shuffleQuestions()) {
      for (let i = qs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [qs[i], qs[j]] = [qs[j], qs[i]];
      }
    }

    this.activeQuestions.set(qs);
    this.quizFinished = false;
    this.quizStartTime = Date.now();
    this.state.set('active');
    this.currentIndex.set(0);
    this.selectedAnswer.set(null);
    this.showFeedback.set(false);
    this.answers.set(new Array(qs.length).fill(null));
    this.timeLeft.set(300);
    if (this.enableTimer()) this.startTimer();
  }

  startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = setInterval(() => {
      this.timeLeft.update(t => {
        if (t <= 1) {
          this.stopTimer();
          this.finishQuiz();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  stopTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  selectAnswer(index: number) {
    if (this.showFeedback()) return;
    this.selectedAnswer.set(index);
    this.showFeedback.set(true);
    this.answers.update(a => {
      const copy = [...a];
      copy[this.currentIndex()] = index;
      return copy;
    });
  }

  nextQuestion() {
    const total = this.questions().length;
    if (this.currentIndex() < total - 1) {
      this.currentIndex.update(i => i + 1);
      this.selectedAnswer.set(null);
      this.showFeedback.set(false);
    } else {
      this.finishQuiz();
    }
  }

  finishQuiz() {
    // Guard: prevent double-finish from timer race condition
    if (this.quizFinished) return;
    this.quizFinished = true;
    this.stopTimer();

    const qs  = this.questions();
    const ans = this.answers();

    // Guard: prevent division by zero
    if (!qs.length) {
      this.state.set('setup');
      return;
    }

    let correct = 0, wrong = 0, skipped = 0;
    qs.forEach((q, i) => {
      if (ans[i] === null) skipped++;
      // Coerce both sides to number for safe comparison
      else if (Number(ans[i]) === Number(q.correctAnswer)) correct++;
      else wrong++;
    });

    const score = Math.round((correct / qs.length) * 100);
    // Use real elapsed time — works correctly even when timer is disabled
    const timeTaken = Math.round((Date.now() - this.quizStartTime) / 1000);
    this.result.set({ totalQuestions: qs.length, correct, wrong, skipped, timeTaken, score });

    const attempt: QuizAttempt = {
      id: this.data.generateId(),
      docId: qs[0]?.docId ?? '',
      docName: this.data.documents().find(d => d.id === qs[0]?.docId)?.name ?? 'Quiz',
      date: new Date().toISOString(),
      score,
      correct,
      wrong,
      skipped,
      timeTaken,
      totalQuestions: qs.length,
    };
    this.data.saveQuizAttempt(attempt);
    this.state.set('result');
  }

  retryQuiz() {
    this.state.set('setup');
    this.result.set(null);
    this.activeQuestions.set([]);
    this.quizFinished = false;
  }

  isCorrect(q: QuizQuestion, selected: number | null): boolean {
    if (selected === null) return false;
    return Number(selected) === Number(q.correctAnswer);
  }

  optionClass(q: QuizQuestion, optionIndex: number): string {
    if (!this.showFeedback()) return this.selectedAnswer() === optionIndex ? 'selected' : '';
    if (optionIndex === Number(q.correctAnswer)) return 'correct';
    if (optionIndex === this.selectedAnswer() && optionIndex !== Number(q.correctAnswer)) return 'wrong';
    return '';
  }

  optionLetter(i: number): string {
    return ['A', 'B', 'C', 'D'][i] || String(i + 1);
  }

  scoreGrade(score: number): string {
    if (score >= 90) return 'Excellent! 🎉';
    if (score >= 75) return 'Great Job! 👏';
    if (score >= 60) return 'Good Effort 👍';
    return 'Keep Practicing 💪';
  }

  downloadQuiz() {
    const qs = this.questions();
    if (!qs.length) return;
    const docName = this.data.documents().find(d => d.id === qs[0]?.docId)?.name ?? 'Quiz';
    this.download.downloadQuizHTML(qs, docName.replace('.pdf', ''));
  }

  ngOnDestroy() {
    this.stopTimer();
  }
}
