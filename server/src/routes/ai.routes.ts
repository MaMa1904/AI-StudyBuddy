import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { config } from '../config/env';
import { extractPdfText } from '../services/pdf.service';
import {
  generateSummaries,
  generateFlashcards,
  generateQuizQuestions,
  generateAll,
  simplerExplanation,
  expandDetail,
  extractKeywords,
} from '../services/gemini.service';

const router = Router();

// ── In-memory document store with timer tracking ─────────────
// Maps docId → extracted text (kept in memory for the session)
interface DocEntry {
  text: string;
  subject: string;
  name: string;
  timer: ReturnType<typeof setTimeout>;
}
const docTextStore = new Map<string, DocEntry>();

// ── Disk cache directory for surviving restarts ───────────────
const cacheDir = path.resolve(config.upload.dir, '..', 'doc_cache');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });

function cacheToDisK(docId: string, entry: Omit<DocEntry, 'timer'>) {
  try {
    const filePath = path.join(cacheDir, `${docId}.json`);
    fs.writeFileSync(filePath, JSON.stringify({ text: entry.text, subject: entry.subject, name: entry.name }));
  } catch (err) {
    console.warn('[cache] Failed to write disk cache:', err);
  }
}

function loadFromDisk(docId: string): Omit<DocEntry, 'timer'> | null {
  try {
    const filePath = path.join(cacheDir, `${docId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return { text: data.text, subject: data.subject, name: data.name };
  } catch {
    return null;
  }
}

// ── Store helper with timer lifecycle management ─────────────
function storeDoc(docId: string, text: string, subject: string, name: string) {
  // Cancel any existing timer for this docId (prevents memory leak)
  const existing = docTextStore.get(docId);
  if (existing?.timer) clearTimeout(existing.timer);

  // Auto-cleanup after 2 hours to save memory
  const timer = setTimeout(() => {
    docTextStore.delete(docId);
    // Also clean disk cache
    try { fs.unlinkSync(path.join(cacheDir, `${docId}.json`)); } catch { /* ok */ }
  }, 2 * 60 * 60 * 1000);

  docTextStore.set(docId, { text, subject, name, timer });

  // Also write to disk for restart resilience
  cacheToDisK(docId, { text, subject, name });
}

// ── Retrieve document — check memory first, then disk ────────
function getDoc(docId: string): Omit<DocEntry, 'timer'> | null {
  const mem = docTextStore.get(docId);
  if (mem) return { text: mem.text, subject: mem.subject, name: mem.name };

  // Try disk cache (server may have restarted)
  const disk = loadFromDisk(docId);
  if (disk) {
    // Re-hydrate into memory with a fresh timer
    storeDoc(docId, disk.text, disk.subject, disk.name);
    return disk;
  }
  return null;
}

// ── Multer config ─────────────────────────────────────────────
const uploadDir = path.resolve(config.upload.dir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.memoryStorage(); // keep in memory, don't write to disk
const upload = multer({
  storage,
  limits: {
    fileSize: config.upload.maxFileSizeBytes,
    files: 1, // only accept 1 file per request (prevents DoS)
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are accepted.'));
    }
  },
});

// ── Helper: send error ────────────────────────────────────────
function sendError(res: Response, status: number, message: string, details?: string) {
  res.status(status).json({ error: message, details });
}

// ── Helper: validate string fields ───────────────────────────
function requireString(value: unknown, name: string, maxLen = 100000): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  return value.slice(0, maxLen).trim();
}

// ─────────────────────────────────────────────────────────────
// POST /api/process-pdf
// Upload and extract text from a PDF
// ─────────────────────────────────────────────────────────────
router.post('/process-pdf', upload.single('pdf'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return sendError(res, 400, 'No PDF file provided.');
    }

    const docId = requireString(req.body.docId, 'docId')
      || `doc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const result = await extractPdfText(req.file.buffer);

    if (!result.text || result.text.trim().length < 50) {
      return sendError(res, 422, 'PDF appears to be empty or contains too little text to process.');
    }

    // Store text for subsequent AI calls (with timer + disk cache)
    storeDoc(docId, result.text, result.subject, req.file.originalname);

    return res.json({
      docId,
      name: req.file.originalname,
      pages: result.pages,
      subject: result.subject,
      wordCount: result.wordCount,
      keywords: result.keywords,
      extractedText: result.text.slice(0, 500) + (result.text.length > 500 ? '...' : ''),
    });
  } catch (err: any) {
    console.error('[process-pdf]', err);
    if (err.message?.includes('File too large')) {
      return sendError(res, 413, 'PDF file is too large. Maximum size is 20 MB.');
    }
    return sendError(res, 500, 'Failed to process PDF.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/generate-summary
// Generate AI summaries for a processed document
// ─────────────────────────────────────────────────────────────
router.post('/generate-summary', async (req: Request, res: Response) => {
  try {
    const docId = requireString(req.body.docId, 'docId');
    if (!docId) return sendError(res, 400, 'docId is required.');

    const stored = getDoc(docId);
    if (!stored) return sendError(res, 404, 'Document not found. Please re-upload the PDF.');

    const summaries = await generateSummaries(docId, stored.text, stored.subject);
    return res.json({ docId, summaries });
  } catch (err: any) {
    console.error('[generate-summary]', err);
    return sendError(res, 500, 'Failed to generate summary.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/generate-flashcards
// Generate AI flashcards for a processed document
// ─────────────────────────────────────────────────────────────
router.post('/generate-flashcards', async (req: Request, res: Response) => {
  try {
    const docId = requireString(req.body.docId, 'docId');
    if (!docId) return sendError(res, 400, 'docId is required.');

    const count = Math.min(Math.max(Number(req.body.count) || 15, 1), 50);

    const stored = getDoc(docId);
    if (!stored) return sendError(res, 404, 'Document not found. Please re-upload the PDF.');

    const flashcards = await generateFlashcards(docId, stored.text, stored.subject, count);
    return res.json({ docId, flashcards });
  } catch (err: any) {
    console.error('[generate-flashcards]', err);
    return sendError(res, 500, 'Failed to generate flashcards.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/generate-quiz
// Generate AI quiz questions for a processed document
// ─────────────────────────────────────────────────────────────
router.post('/generate-quiz', async (req: Request, res: Response) => {
  try {
    const docId = requireString(req.body.docId, 'docId');
    if (!docId) return sendError(res, 400, 'docId is required.');

    const count = Math.min(Math.max(Number(req.body.count) || 10, 1), 30);

    const stored = getDoc(docId);
    if (!stored) return sendError(res, 404, 'Document not found. Please re-upload the PDF.');

    const questions = await generateQuizQuestions(docId, stored.text, stored.subject, count);
    return res.json({ docId, questions });
  } catch (err: any) {
    console.error('[generate-quiz]', err);
    return sendError(res, 500, 'Failed to generate quiz.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/generate-all
// Generate summaries + flashcards + quiz in one request
// Also returns subject, pages, keywords from the stored doc
// ─────────────────────────────────────────────────────────────
router.post('/generate-all', async (req: Request, res: Response) => {
  try {
    const docId = requireString(req.body.docId, 'docId');
    if (!docId) return sendError(res, 400, 'docId is required.');

    const stored = getDoc(docId);
    if (!stored) return sendError(res, 404, 'Document not found. Please re-upload the PDF.');

    const result = await generateAll(docId, stored.text, stored.subject);

    // Also extract keywords so the frontend gets them in one call
    let keywords: string[] = [];
    try {
      keywords = await extractKeywords(stored.text);
    } catch {
      // Non-fatal — keywords are a nice-to-have
    }

    return res.json({
      docId,
      subject: stored.subject,
      name: stored.name,
      keywords,
      ...result,
    });
  } catch (err: any) {
    console.error('[generate-all]', err);
    return sendError(res, 500, 'Failed to generate content.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/simpler-explanation
// Rewrite a piece of content in simpler language
// ─────────────────────────────────────────────────────────────
router.post('/simpler-explanation', async (req: Request, res: Response) => {
  try {
    const content = requireString(req.body.content, 'content', 10000);
    if (!content) return sendError(res, 400, 'content is required.');
    const subject = requireString(req.body.subject, 'subject', 100) || 'General';

    const simplified = await simplerExplanation(content, subject);
    return res.json({ simplified });
  } catch (err: any) {
    console.error('[simpler-explanation]', err);
    return sendError(res, 500, 'Failed to simplify content.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/extract-keywords
// Extract keywords from text using AI
// ─────────────────────────────────────────────────────────────
router.post('/extract-keywords', async (req: Request, res: Response) => {
  try {
    const text = requireString(req.body.text, 'text', 50000);
    if (!text) return sendError(res, 400, 'text is required.');

    const keywords = await extractKeywords(text);
    return res.json({ keywords });
  } catch (err: any) {
    console.error('[extract-keywords]', err);
    return sendError(res, 500, 'Failed to extract keywords.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// POST /api/expand-detail
// Expand a summary section with more depth
// ─────────────────────────────────────────────────────────────
router.post('/expand-detail', async (req: Request, res: Response) => {
  try {
    const content = requireString(req.body.content, 'content', 10000);
    if (!content) return sendError(res, 400, 'content is required.');
    const subject = requireString(req.body.subject, 'subject', 100) || 'General';

    const expanded = await expandDetail(content, subject);
    return res.json({ expanded });
  } catch (err: any) {
    console.error('[expand-detail]', err);
    return sendError(res, 500, 'Failed to expand content.', err.message);
  }
});

// ─────────────────────────────────────────────────────────────
// GET /api/health
// Health check endpoint
// ─────────────────────────────────────────────────────────────
router.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    model: config.gemini.model,
    docsInMemory: docTextStore.size,
  });
});

// ── Cleanup exported for graceful shutdown ─────────────────────
export function cleanupDocStore() {
  for (const [, entry] of docTextStore) {
    if (entry.timer) clearTimeout(entry.timer);
  }
  docTextStore.clear();
}

export default router;
