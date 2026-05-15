import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StudyDataService } from '../../services/study-data.service';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-study-plan',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './study-plan.html',
  styleUrl: './study-plan.scss'
})
export class StudyPlanComponent {
  data = inject(StudyDataService);
  ai   = inject(AiService);

  selectedDocIds = signal<string[]>([]);
  deadlineDays   = 7;
  isGenerating   = signal(false);
  studyPlan      = signal('');
  errorMsg       = signal('');

  toggleDoc(docId: string) {
    const current = this.selectedDocIds();
    if (current.includes(docId)) {
      this.selectedDocIds.set(current.filter(id => id !== docId));
    } else {
      this.selectedDocIds.set([...current, docId]);
    }
  }

  isSelected(docId: string): boolean {
    return this.selectedDocIds().includes(docId);
  }

  generatePlan() {
    const docs = this.data.documents().filter(d =>
      this.selectedDocIds().includes(d.id)
    );
    if (docs.length === 0) {
      this.errorMsg.set('Please select at least one document.');
      return;
    }
    if (this.deadlineDays < 1) {
      this.errorMsg.set('Please enter a valid number of days.');
      return;
    }

    const chapters = docs.map(d => ({
      name: d.name,
      subject: d.subject ?? 'General',
      wordCount: d.size ? Math.round(d.size / 5) : 1000,
    }));

    this.errorMsg.set('');
    this.isGenerating.set(true);
    this.studyPlan.set('');

    this.ai.generateStudyPlan(chapters, this.deadlineDays)
      .then(res => this.studyPlan.set(res.plan))
      .catch(() => this.errorMsg.set('Failed to generate plan. Try again.'))
      .finally(() => this.isGenerating.set(false));
  }

  planLines = computed(() =>
    this.studyPlan() ? this.studyPlan().split('\n').filter(l => l.trim()) : []
  );
}
