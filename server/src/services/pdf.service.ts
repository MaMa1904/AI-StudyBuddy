import pdfParse from 'pdf-parse';

export interface PdfExtractResult {
  text: string;
  pages: number;
  wordCount: number;
  subject: string;
  keywords: string[];
}

// ── Extract text from a PDF buffer ───────────────────────────
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractResult> {
  const data = await pdfParse(buffer);

  const text = cleanText(data.text);
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const subject = guessSubjectFromText(text);
  const keywords = extractBasicKeywords(text);

  return {
    text,
    pages: data.numpages,
    wordCount,
    subject,
    keywords,
  };
}

// ── Extract text from a file path (not used by routes, kept for CLI/testing) ──
export async function extractPdfFromPath(filePath: string): Promise<PdfExtractResult> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('fs');
  const buffer = fs.readFileSync(filePath);
  return extractPdfText(buffer);
}

// ── Clean extracted text ──────────────────────────────────────
function cleanText(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')   // collapse excessive newlines
    .replace(/[ \t]{2,}/g, ' ')   // collapse multiple spaces
    .replace(/[^\x20-\x7E\n\u00C0-\u024F\u0370-\u03FF]/g, ' ') // keep latin + greek chars
    .trim();
}

// ── Guess subject from text content ──────────────────────────
function guessSubjectFromText(text: string): string {
  const lower = text.toLowerCase().slice(0, 5000); // check first 5000 chars

  const subjects: [string, string[]][] = [
    ['Chemistry',       ['molecule', 'atom', 'bond', 'reaction', 'orbital', 'electron', 'compound', 'acid', 'base', 'mole']],
    ['Mathematics',     ['theorem', 'proof', 'integral', 'derivative', 'matrix', 'vector', 'equation', 'polynomial', 'calculus']],
    ['Physics',         ['force', 'velocity', 'acceleration', 'momentum', 'energy', 'quantum', 'wave', 'particle', 'field']],
    ['Biology',         ['cell', 'dna', 'protein', 'gene', 'organism', 'evolution', 'metabolism', 'enzyme', 'chromosome']],
    ['Computer Science',['algorithm', 'function', 'variable', 'array', 'class', 'object', 'recursion', 'complexity', 'binary']],
    ['Economics',       ['market', 'supply', 'demand', 'gdp', 'inflation', 'fiscal', 'monetary', 'elasticity', 'equilibrium']],
    ['History',         ['century', 'war', 'empire', 'revolution', 'civilization', 'dynasty', 'treaty', 'colonial']],
    ['Law',             ['statute', 'jurisdiction', 'plaintiff', 'defendant', 'contract', 'tort', 'liability', 'precedent']],
    ['Psychology',      ['behavior', 'cognitive', 'stimulus', 'response', 'therapy', 'disorder', 'perception', 'memory']],
    ['Literature',      ['narrative', 'protagonist', 'metaphor', 'theme', 'symbolism', 'genre', 'prose', 'verse']],
  ];

  let bestSubject = 'General';
  let bestScore = 0;

  for (const [subject, keywords] of subjects) {
    const score = keywords.reduce((acc, kw) => {
      const regex = new RegExp(`\\b${kw}`, 'gi');
      const matches = lower.match(regex);
      return acc + (matches ? matches.length : 0);
    }, 0);

    if (score > bestScore) {
      bestScore = score;
      bestSubject = subject;
    }
  }

  return bestSubject;
}

// ── Extract basic keywords without AI (fast, offline) ────────
function extractBasicKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'this', 'that', 'these', 'those', 'it', 'its',
    'as', 'if', 'then', 'than', 'so', 'not', 'no', 'can', 'also', 'which',
    'who', 'what', 'when', 'where', 'how', 'all', 'each', 'both', 'more',
  ]);

  const wordFreq: Record<string, number> = {};
  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 4 && !stopWords.has(w));

  for (const word of words) {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}
