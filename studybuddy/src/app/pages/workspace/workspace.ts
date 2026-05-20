import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudyDataService } from '../../services/study-data.service';
import { AuthService } from '../../services/auth.service';
import { AiService } from '../../services/ai.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal';
import { HighlightAskComponent } from '../../components/highlight-ask/highlight-ask';
import { UploadedDocument, SummarySection } from '../../models/study.models';

@Component({
  selector: 'app-workspace',
  imports: [RouterLink, AuthModalComponent, HighlightAskComponent],
  templateUrl: './workspace.html',
  styleUrl: './workspace.scss'
})
export class WorkspaceComponent implements OnInit, OnDestroy {
  data  = inject(StudyDataService);
  auth  = inject(AuthService);
  ai    = inject(AiService);

  isDragging      = signal(false);
  showAuthModal   = signal(false);
  selectedDocId   = signal<string | null>(null);
  errorMsg        = signal('');
  backendOnline   = signal<boolean | null>(null);

  // AI modal state
  showAiModal     = signal(false);
  aiModalTitle    = signal('');
  aiModalContent  = signal('');
  aiModalLoading  = signal(false);

  // TTS state
  ttsActive       = signal(false);

  // Track the actual File object for re-upload to backend
  private pendingFiles = new Map<string, File>();

  selectedDoc = computed<UploadedDocument | null>(() => {
    const id = this.selectedDocId();
    if (!id) return null;
    return this.data.documents().find(d => d.id === id) ?? null;
  });

  summaries = computed<SummarySection[]>(() => this.selectedDoc()?.summaries ?? []);
  expandedSections = signal<Set<string>>(new Set(['summary']));

  ngOnInit() {
    this.ai.checkHealth().then(online => this.backendOnline.set(online));
    const docs = this.data.documents();
    if (docs.length > 0 && !this.selectedDocId()) {
      this.selectedDocId.set(docs[0].id);
    }
  }

  // ── Drag & Drop ───────────────────────────────────────────
  onDragOver(e: DragEvent)  { e.preventDefault(); this.isDragging.set(true); }
  onDragLeave()             { this.isDragging.set(false); }
  onDrop(e: DragEvent) {
    e.preventDefault();
    this.isDragging.set(false);
    if (e.dataTransfer?.files) this.processFiles(e.dataTransfer.files);
  }
  onFileSelect(e: Event) {
    const input = e.target as HTMLInputElement;
    if (input.files) this.processFiles(input.files);
    input.value = '';
  }

  // ── File Processing ───────────────────────────────────────
  processFiles(files: FileList) {
    Array.from(files).forEach(file => {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        this.errorMsg.set('Only PDF files are supported.');
        return;
      }
      this.errorMsg.set('');
      const docId = this.data.generateId();
      const doc: UploadedDocument = {
        id: docId,
        name: file.name,
        size: file.size,
        uploadDate: new Date().toISOString(),
        status: 'processing',
        progress: 0,
        subject: this.guessSubject(file.name),
      };
      this.data.addDocument(doc);
      this.data.recordStudyTime(0);
      this.selectedDocId.set(docId);
      this.ai.resetProgress();
      this.pendingFiles.set(docId, file);

      if (this.backendOnline()) {
        this.processWithAI(file, docId);
      } else {
        this.simulateProcessing(docId);
      }
    });
  }

  // ── Real AI Processing ────────────────────────────────────
  async processWithAI(file: File, docId: string) {
    try {
      const result = await this.ai.processAndGenerate(file, docId, (step, pct) => {
        this.data.updateDocumentProgress(docId, Math.min(pct, 95));
      });

      this.data.documents.update(docs =>
        docs.map(d => d.id === docId ? {
          ...d,
          status: 'ready' as const,
          progress: 100,
          pages: result.pages,
          subject: result.subject,
          summaries: result.summaries,
          quizQuestions: result.questions,
        } : d)
      );

      if (result.flashcards.length > 0) {
        this.data.addFlashcards(result.flashcards);
      }

      this.data.persistNow();
      this.pendingFiles.delete(docId);
    } catch (err: any) {
      console.error('[AI Processing Error]', err);
      // Mark doc as error state so user knows something went wrong
      this.data.documents.update(docs =>
        docs.map(d => d.id === docId ? { ...d, status: 'error' as const, progress: 0 } : d)
      );
      this.errorMsg.set(err.message?.includes('timeout')
        ? 'AI request timed out. The server may be busy — please try again.'
        : err.message || 'AI processing failed. Please try again.');
      this.ai.resetProgress();
    }
  }

  // ── Regenerate ────────────────────────────────────────────
  async regenerate() {
    const doc = this.selectedDoc();
    if (!doc || this.isGenerating) return;
    const file = this.pendingFiles.get(doc.id);
    if (!file) {
      this.errorMsg.set('Please re-upload the PDF to regenerate content.');
      return;
    }
    this.errorMsg.set('');
    this.ai.resetProgress();
    await this.processWithAI(file, doc.id);
  }

  // ── Simpler Explanation ───────────────────────────────────
  async openSimplerExplanation() {
    const doc = this.selectedDoc();
    if (!doc || !this.backendOnline()) return;

    // Use the first summary's content as input
    const content = this.summaries()[0]?.content;
    if (!content) {
      this.errorMsg.set('Generate a summary first before simplifying.');
      return;
    }

    this.aiModalTitle.set('Simpler Explanation');
    this.aiModalContent.set('');
    this.aiModalLoading.set(true);
    this.showAiModal.set(true);

    try {
      const simplified = await this.ai.simplerExplanation(content, doc.subject ?? 'General');
      this.aiModalContent.set(simplified);
    } catch (err: any) {
      this.aiModalContent.set('Failed to simplify. Please try again.');
    } finally {
      this.aiModalLoading.set(false);
    }
  }

  // ── Expand Detail ─────────────────────────────────────────
  async openExpandDetail() {
    const doc = this.selectedDoc();
    if (!doc || !this.backendOnline()) return;

    const content = this.summaries()[0]?.content;
    if (!content) {
      this.errorMsg.set('Generate a summary first before expanding.');
      return;
    }

    this.aiModalTitle.set('Expanded Detail');
    this.aiModalContent.set('');
    this.aiModalLoading.set(true);
    this.showAiModal.set(true);

    try {
      const expanded = await this.ai.expandDetail(content, doc.subject ?? 'General');
      this.aiModalContent.set(expanded);
    } catch (err: any) {
      this.aiModalContent.set('Failed to expand. Please try again.');
    } finally {
      this.aiModalLoading.set(false);
    }
  }

  // ── Text-to-Speech ────────────────────────────────────────
  toggleReadAloud() {
    if (!('speechSynthesis' in window)) {
      this.errorMsg.set('Text-to-speech is not supported in this browser.');
      return;
    }
    if (this.ttsActive()) {
      window.speechSynthesis.cancel();
      this.ttsActive.set(false);
      return;
    }
    const summaryText = this.summaries()
      .map(s => `${s.title}. ${s.content}. Key points: ${s.keyPoints?.join('. ')}`)
      .join('\n\n');

    if (!summaryText.trim()) {
      this.errorMsg.set('No content to read. Generate a summary first.');
      return;
    }

    const utt = new SpeechSynthesisUtterance(summaryText);
    utt.rate = 0.9;
    utt.pitch = 1;
    utt.onend = () => this.ttsActive.set(false);
    utt.onerror = () => this.ttsActive.set(false);
    window.speechSynthesis.speak(utt);
    this.ttsActive.set(true);
  }

  // ── Export Notes ──────────────────────────────────────────
  exportNotes() {
    const doc = this.selectedDoc();
    if (!doc || !this.summaries().length) {
      this.errorMsg.set('No content to export. Generate a summary first.');
      return;
    }

    const lines: string[] = [
      `# ${doc.name}`,
      `Subject: ${doc.subject ?? 'General'} | Pages: ${doc.pages ?? 'N/A'}`,
      `Exported: ${new Date().toLocaleDateString()}`,
      '',
      '---',
      '',
    ];

    this.summaries().forEach(s => {
      lines.push(`## ${s.title}`);
      lines.push('');
      lines.push(s.content);
      lines.push('');
      if (s.keyPoints?.length) {
        s.keyPoints.forEach(p => lines.push(`- ${p}`));
        lines.push('');
      }
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.name.replace('.pdf', '') + '_notes.md';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Fallback simulation ───────────────────────────────────
  simulateProcessing(id: string) {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 12 + 4;
      if (progress >= 100) {
        clearInterval(interval);
        this.data.updateDocumentProgress(id, 100);
        this.ai.progress.update(p => ({ ...p, status: 'done', message: 'Ready (offline mode)', percent: 100 }));
      } else {
        this.data.updateDocumentProgress(id, Math.round(progress));
      }
    }, 350);
  }

  // ── Document management ───────────────────────────────────
  selectDoc(id: string) {
    this.selectedDocId.set(id);
    this.ai.resetProgress();
    this.errorMsg.set('');
    if (this.ttsActive()) { window.speechSynthesis.cancel(); this.ttsActive.set(false); }
  }

  removeDoc(id: string, e: Event) {
    e.stopPropagation();
    this.data.removeDocument(id);
    this.pendingFiles.delete(id);
    if (this.selectedDocId() === id) {
      const remaining = this.data.documents();
      this.selectedDocId.set(remaining.length > 0 ? remaining[0].id : null);
    }
  }

  // ── Summary sections ──────────────────────────────────────
  toggleSection(id: string) {
    this.expandedSections.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  isSectionExpanded(id: string): boolean { return this.expandedSections().has(id); }

  // ── Helpers ───────────────────────────────────────────────
  private guessSubject(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('chem'))   return 'Chemistry';
    if (lower.includes('math') || lower.includes('calc')) return 'Mathematics';
    if (lower.includes('phys'))   return 'Physics';
    if (lower.includes('bio'))    return 'Biology';
    if (lower.includes('econ'))   return 'Economics';
    if (lower.includes('hist'))   return 'History';
    if (lower.includes('cs') || lower.includes('algo') || lower.includes('data')) return 'Computer Science';
    if (lower.includes('law'))    return 'Law';
    return 'General';
  }

  formatSize(bytes: number) { return this.data.formatFileSize(bytes); }
  timeAgo(dateStr: string)  { return this.data.timeAgo(dateStr); }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text)
      .then(() => {
        // Brief visual feedback via error message slot (reuse for success)
        const prev = this.errorMsg();
        this.errorMsg.set('✓ Copied to clipboard');
        setTimeout(() => this.errorMsg.set(prev), 2000);
      })
      .catch(() => {
        this.errorMsg.set('Could not copy — please select and copy manually.');
      });
  }

  get aiProgress()   { return this.ai.progress(); }
  get isGenerating() { return ['uploading', 'processing', 'generating'].includes(this.ai.progress().status); }

  ngOnDestroy() {
    // Stop TTS when navigating away
    if (this.ttsActive() && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}
