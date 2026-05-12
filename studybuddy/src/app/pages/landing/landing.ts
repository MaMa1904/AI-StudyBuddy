import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { StudyDataService } from '../../services/study-data.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal';
import { UploadedDocument } from '../../models/study.models';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, AuthModalComponent],
  templateUrl: './landing.html',
  styleUrl: './landing.scss'
})
export class LandingComponent {
  auth = inject(AuthService);
  dataService = inject(StudyDataService);

  isDragging    = signal(false);
  uploadedFiles = signal<UploadedDocument[]>([]);
  showAuthModal = signal(false);

  features = [
    { icon: 'ti-brain',     color: 'indigo',  title: 'AI Summarization',  desc: 'Chapter-wise summaries, key points, and exam-focused notes generated instantly from your PDFs.' },
    { icon: 'ti-cards',     color: 'purple',  title: 'Smart Flashcards',  desc: 'Spaced repetition flashcards with flip animations, difficulty tracking, and progress indicators.' },
    { icon: 'ti-trophy',    color: 'blue',    title: 'Adaptive Quizzes',  desc: 'MCQ, True/False, and short answer quizzes with timers, analytics, and gamified scoring.' },
    { icon: 'ti-search',    color: 'pink',    title: 'Smart Extraction',  desc: 'Auto-detects chapters, headings, formulas, and keywords from complex academic documents.' },
    { icon: 'ti-wifi-off',  color: 'green',   title: 'Offline Mode',      desc: 'Download flashcards and quizzes to study anywhere — even without an internet connection.' },
    { icon: 'ti-accessible',color: 'yellow',  title: 'Accessibility',     desc: 'Dark/light mode, font size controls, text-to-speech, and dyslexia-friendly reading mode built in.' },
  ];

  steps = [
    { num: '01', icon: 'ti-upload',   title: 'Upload your PDF',       desc: 'Drag and drop any PDF — textbooks, notes, research papers, or scanned documents.' },
    { num: '02', icon: 'ti-brain',    title: 'AI processes it',       desc: 'Our AI extracts chapters, keywords, formulas, and generates summaries automatically.' },
    { num: '03', icon: 'ti-cards',    title: 'Study with smart tools', desc: 'Use flashcards, quizzes, and summaries tailored to your document.' },
    { num: '04', icon: 'ti-chart-bar',title: 'Track your progress',   desc: 'Monitor streaks, quiz scores, and retention rates on your personal dashboard.' },
  ];

  onDragOver(e: DragEvent) { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave() { this.isDragging.set(false); }

  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    const files = e.dataTransfer?.files;
    if (files) this.processFiles(files);
  }

  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) this.processFiles(input.files);
  }

  processFiles(files: FileList) {
    Array.from(files).forEach(file => {
      if (!file.name.toLowerCase().endsWith('.pdf')) return;
      const doc: UploadedDocument = {
        id: this.dataService.generateId(),
        name: file.name,
        size: file.size,
        uploadDate: new Date().toISOString(),
        status: 'processing',
        progress: 0,
      };
      // Add to both local display list AND the global data service
      // so the document appears in the workspace immediately
      this.uploadedFiles.update(f => [...f, doc]);
      this.dataService.addDocument(doc);
      this.simulateUpload(doc.id);
    });
  }

  simulateUpload(id: string) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        // Update both local list and service
        this.uploadedFiles.update(files =>
          files.map(f => f.id === id ? { ...f, progress: 100, status: 'ready' } : f)
        );
        this.dataService.updateDocumentProgress(id, 100);
      } else {
        const rounded = Math.round(progress);
        this.uploadedFiles.update(files =>
          files.map(f => f.id === id ? { ...f, progress: rounded } : f)
        );
        this.dataService.updateDocumentProgress(id, rounded);
      }
    }, 300);
  }

  formatSize(bytes: number) { return this.dataService.formatFileSize(bytes); }
}
