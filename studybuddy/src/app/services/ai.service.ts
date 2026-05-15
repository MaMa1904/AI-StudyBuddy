import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';
import {
  SummarySection,
  Flashcard,
  QuizQuestion,
} from '../models/study.models';

export type AiStatus = 'idle' | 'uploading' | 'processing' | 'generating' | 'done' | 'error';

export interface AiProgress {
  status: AiStatus;
  message: string;
  percent: number;
  steps: { label: string; value: number; status: string; color: string }[];
}

export interface GenerateAllResult {
  summaries: SummarySection[];
  flashcards: Flashcard[];
  questions: QuizQuestion[];
  keywords: string[];
  subject: string;
  pages: number;
}

@Injectable({ providedIn: 'root' })
export class AiService {
  private baseUrl = environment.apiUrl;

  // ── Reactive progress state ───────────────────────────────
  progress = signal<AiProgress>({
    status: 'idle',
    message: '',
    percent: 0,
    steps: [
      { label: 'Summary',    value: 0, status: 'Pending', color: 'linear-gradient(135deg,#10B981,#059669)' },
      { label: 'Flashcards', value: 0, status: 'Pending', color: 'var(--grad)' },
      { label: 'Quiz',       value: 0, status: 'Pending', color: 'var(--grad)' },
    ],
  });

  isAvailable = signal<boolean | null>(null); // null = not checked yet

  // ── Check if backend is reachable ────────────────────────
  async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
      const available = res.ok;
      this.isAvailable.set(available);
      return available;
    } catch {
      this.isAvailable.set(false);
      return false;
    }
  }

  // ── Upload PDF and extract text ───────────────────────────
  async processPdf(file: File, docId: string): Promise<{
    pages: number;
    subject: string;
    keywords: string[];
    wordCount: number;
  }> {
    this.setProgress('uploading', 'Uploading PDF…', 10);

    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('docId', docId);

    const res = await fetch(`${this.baseUrl}/process-pdf`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(60000), // 60s timeout for upload + extraction
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload failed' }));
      throw new Error(err.error || 'Failed to process PDF');
    }

    this.setProgress('processing', 'Extracting text…', 30);
    return res.json();
  }

  // ── Generate everything in one call ──────────────────────
  async generateAll(docId: string): Promise<GenerateAllResult> {
    this.setProgress('generating', 'Generating summaries…', 40, [
      { label: 'Summary',    value: 10, status: 'Generating…', color: 'linear-gradient(135deg,#10B981,#059669)' },
      { label: 'Flashcards', value: 0,  status: 'Pending',     color: 'var(--grad)' },
      { label: 'Quiz',       value: 0,  status: 'Pending',     color: 'var(--grad)' },
    ]);

    const res = await fetch(`${this.baseUrl}/generate-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ docId }),
      signal: AbortSignal.timeout(120000), // 2 min timeout for AI generation
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Generation failed' }));
      throw new Error(err.error || 'Failed to generate content');
    }

    const data = await res.json();

    this.setProgress('done', 'All content generated!', 100, [
      { label: 'Summary',    value: 100, status: 'Done', color: 'linear-gradient(135deg,#10B981,#059669)' },
      { label: 'Flashcards', value: 100, status: 'Done', color: 'var(--grad)' },
      { label: 'Quiz',       value: 100, status: 'Done', color: 'var(--grad)' },
    ]);

    return {
      summaries:  data.summaries  ?? [],
      flashcards: data.flashcards ?? [],
      questions:  data.questions  ?? [],
      keywords:   data.keywords   ?? [],
      subject:    data.subject    ?? 'General',
      pages:      data.pages      ?? 0,
    };
  }

  // ── Upload + Generate in one flow ────────────────────────
  async processAndGenerate(
    file: File,
    docId: string,
    onProgress?: (step: string, pct: number) => void
  ): Promise<GenerateAllResult & { pages: number; subject: string; keywords: string[] }> {

    // Step 1: Upload & extract
    onProgress?.('Uploading PDF…', 10);
    const pdfInfo = await this.processPdf(file, docId);

    // Step 2: Animate progress while waiting for AI
    onProgress?.('AI is reading your document…', 35);
    this.animateStep(0, 35, 60, 800);

    // Step 3: Generate all content
    onProgress?.('Generating summaries, flashcards & quiz…', 60);
    const generated = await this.generateAll(docId);

    onProgress?.('Done!', 100);

    return {
      ...generated,
      pages:    pdfInfo.pages,
      subject:  pdfInfo.subject,
      keywords: pdfInfo.keywords,
    };
  }

  // ── Simpler explanation ───────────────────────────────────
  async simplerExplanation(content: string, subject: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/simpler-explanation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, subject }),
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error('Failed to simplify content');
    const data = await res.json();
    return data.simplified;
  }

  // ── Expand detail ─────────────────────────────────────────
  async expandDetail(content: string, subject: string): Promise<string> {
    const res = await fetch(`${this.baseUrl}/expand-detail`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, subject }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) throw new Error('Failed to expand content');
    const data = await res.json();
    return data.expanded;
  }

  // ── Reset progress ────────────────────────────────────────
  resetProgress() {
    this.progress.set({
      status: 'idle',
      message: '',
      percent: 0,
      steps: [
        { label: 'Summary',    value: 0, status: 'Pending', color: 'linear-gradient(135deg,#10B981,#059669)' },
        { label: 'Flashcards', value: 0, status: 'Pending', color: 'var(--grad)' },
        { label: 'Quiz',       value: 0, status: 'Pending', color: 'var(--grad)' },
      ],
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  private setProgress(
    status: AiStatus,
    message: string,
    percent: number,
    steps?: AiProgress['steps']
  ) {
    this.progress.update(p => ({
      status,
      message,
      percent,
      steps: steps ?? p.steps,
    }));
  }

  private animateStep(stepIndex: number, from: number, to: number, durationMs: number) {
    const steps = 20;
    const increment = (to - from) / steps;
    const interval = durationMs / steps;
    let current = from;
    const iv = setInterval(() => {
      current = Math.min(current + increment, to);
      this.progress.update(p => ({
        ...p,
        percent: Math.round(current),
        steps: p.steps.map((s, i) =>
          i === stepIndex
            ? { ...s, value: Math.round(current), status: current >= to ? 'Done' : Math.round(current) + '%' }
            : s
        ),
      }));
      if (current >= to) clearInterval(iv);
    }, interval);
  }
  explainInLanguage(content: string, language: string, subject: string): Promise<{ explanation: string }> {
  return fetch(`${environment.apiUrl}/explain-in-language`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, language, subject }),
  }).then(r => r.json());
}
generateStudyPlan(
  chapters: { name: string; subject: string; wordCount: number }[],
  deadlineDays: number
): Promise<{ plan: string }> {
  return fetch(`${environment.apiUrl}/generate-study-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chapters, deadlineDays }),
  }).then(r => r.json());
}
}
