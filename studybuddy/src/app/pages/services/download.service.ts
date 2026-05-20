import { Injectable } from '@angular/core';
import { Flashcard, QuizQuestion } from '../models/study.models';

@Injectable({ providedIn: 'root' })
export class DownloadService {

  // ── Download flashcards as JSON ───────────────────────────
  downloadFlashcards(cards: Flashcard[], filename = 'flashcards') {
    const data = {
      exported: new Date().toISOString(),
      count: cards.length,
      flashcards: cards.map(c => ({
        front: c.front,
        back: c.back,
        type: c.type,
        difficulty: c.difficulty,
        subject: c.subject,
      })),
    };
    this.downloadJSON(data, `${filename}_flashcards.json`);
  }

  // ── Download flashcards as printable HTML ─────────────────
  downloadFlashcardsHTML(cards: Flashcard[], docName = 'Study Cards') {
    const cardHtml = cards.map((c, i) => `
      <div class="card">
        <div class="card-num">${i + 1} / ${cards.length}</div>
        <div class="card-subject">${c.subject} · ${c.type} · ${c.difficulty}</div>
        <div class="card-front"><strong>Q:</strong> ${escapeHtml(c.front)}</div>
        <div class="card-back"><strong>A:</strong> ${escapeHtml(c.back)}</div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${docName} — Flashcards</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #4F46E5; margin-bottom: 8px; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
    .card { border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
    .card-num { font-size: 11px; color: #999; margin-bottom: 4px; }
    .card-subject { font-size: 11px; color: #4F46E5; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
    .card-front { font-size: 15px; font-weight: 600; margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
    .card-back { font-size: 14px; color: #444; line-height: 1.6; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${docName}</h1>
  <p class="meta">Exported ${new Date().toLocaleDateString()} · ${cards.length} cards</p>
  ${cardHtml}
</body>
</html>`;

    this.downloadText(html, `${docName.replace(/[^a-z0-9]/gi, '_')}_flashcards.html`, 'text/html');
  }

  // ── Download quiz as JSON ─────────────────────────────────
  downloadQuiz(questions: QuizQuestion[], filename = 'quiz') {
    const data = {
      exported: new Date().toISOString(),
      count: questions.length,
      questions: questions.map(q => ({
        text: q.text,
        type: q.type,
        options: q.options,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
    };
    this.downloadJSON(data, `${filename}_quiz.json`);
  }

  // ── Download quiz as printable HTML ──────────────────────
  downloadQuizHTML(questions: QuizQuestion[], docName = 'Quiz') {
    const qHtml = questions.map((q, i) => {
      const opts = (q.options ?? []).map((o, j) => `
        <div class="option ${j === q.correctAnswer ? 'correct' : ''}">
          <span class="opt-letter">${['A','B','C','D'][j] ?? j+1}</span>
          ${escapeHtml(o)}
          ${j === q.correctAnswer ? ' ✓' : ''}
        </div>
      `).join('');
      return `
        <div class="question">
          <div class="q-num">Q${i + 1} · ${q.type} · ${q.difficulty}</div>
          <div class="q-text">${escapeHtml(q.text)}</div>
          <div class="options">${opts}</div>
          <div class="explanation"><strong>Explanation:</strong> ${escapeHtml(q.explanation)}</div>
        </div>
      `;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${docName} — Quiz</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { color: #4F46E5; }
    .meta { color: #666; font-size: 13px; margin-bottom: 24px; }
    .question { border: 1px solid #ddd; border-radius: 12px; padding: 18px; margin-bottom: 18px; page-break-inside: avoid; }
    .q-num { font-size: 11px; color: #4F46E5; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; }
    .q-text { font-size: 15px; font-weight: 600; margin-bottom: 12px; }
    .option { padding: 7px 10px; border-radius: 6px; margin-bottom: 5px; font-size: 13px; display: flex; gap: 8px; }
    .option.correct { background: #d1fae5; color: #065f46; font-weight: 600; }
    .opt-letter { font-weight: 700; min-width: 20px; }
    .explanation { margin-top: 12px; padding-top: 10px; border-top: 1px dashed #eee; font-size: 12px; color: #555; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${docName}</h1>
  <p class="meta">Exported ${new Date().toLocaleDateString()} · ${questions.length} questions</p>
  ${qHtml}
</body>
</html>`;

    this.downloadText(html, `${docName.replace(/[^a-z0-9]/gi, '_')}_quiz.html`, 'text/html');
  }

  // ── Helpers ───────────────────────────────────────────────
  private downloadJSON(data: object, filename: string) {
    this.downloadText(JSON.stringify(data, null, 2), filename, 'application/json');
  }

  private downloadText(content: string, filename: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
