import { Component, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudyDataService } from '../../services/study-data.service';
import { AuthService } from '../../services/auth.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal';

@Component({
  selector: 'app-dashboard',
  imports: [RouterLink, AuthModalComponent],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class DashboardComponent {
  data = inject(StudyDataService);
  auth = inject(AuthService);

  showAuthModal = signal(false);
  days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  greeting = computed(() => {
    const user = this.auth.currentUser();
    const hour = new Date().getHours();
    const time = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const name = user ? user.name.split(' ')[0] : 'there';
    return `Good ${time}, ${name} 👋`;
  });

  hasDocuments  = computed(() => this.data.documents().length > 0);
  hasFlashcards = computed(() => this.data.flashcards().length > 0);
  hasQuizzes    = computed(() => this.data.quizAttempts().length > 0);
  subjectProgress = computed(() => this.data.getSubjectProgress());

  // Reactive heatmap — rebuilds whenever activityLog changes
  heatmapCells = computed<number[]>(() => {
    const log = this.data.stats().activityLog ?? [];
    const cells: number[] = [];
    for (let i = 27; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      // Use intensity levels: 0 = none, 1 = light, 2 = medium, 3 = full
      // Count how many times the user studied that day (future: track sessions per day)
      cells.push(log.includes(key) ? 3 : 0);
    }
    return cells;
  });

  // Reactive chart — rebuilds whenever quizScores changes
  chartBars = computed<{ height: number; active: boolean; score: number }[]>(() => {
    const scores = this.data.stats().quizScores ?? [];
    if (!scores.length) return [];
    const max = Math.max(...scores, 1);
    return scores.slice(0, 7).map((s, i) => ({
      height: Math.round((s / max) * 100),
      active: i === scores.length - 1,
      score: s,
    }));
  });

  heatClass(level: number): string {
    return ['', 'l1', 'l2', 'l3'][level] || '';
  }

  formatSize(bytes: number) { return this.data.formatFileSize(bytes); }
  timeAgo(dateStr: string)  { return this.data.timeAgo(dateStr); }

  avgQuizScore = computed(() => {
    const scores = this.data.stats().quizScores ?? [];
    if (!scores.length) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });
}
