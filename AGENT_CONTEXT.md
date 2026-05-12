# StudyBuddy — AI Agent Handoff Context
> Last updated: May 2026
> Read this file completely before making any changes to the project.

---

## 1. Project Overview

**StudyBuddy** is a full-stack AI-powered educational web app.
Students upload PDFs → Google Gemini AI generates summaries, flashcards, and quizzes.
The app supports optional sign-in with full localStorage persistence, and works as a guest too.

---

## 2. How to Run (Both Servers Required)

```bash
# Terminal 1 — Backend (must run from server/ directory)
cd E:\College\Projects\StudyBuddy\server
npm run dev
# → http://localhost:3000

# Terminal 2 — Frontend
cd E:\College\Projects\StudyBuddy\studybuddy
ng serve
# → http://localhost:4200
```

**Verify backend is alive:**
```
GET http://localhost:3000/api/health
→ { "status": "ok", "model": "gemini-2.5-flash", "docsInMemory": 0 }
```

---

## 3. Repository Structure

```
E:\College\Projects\StudyBuddy\
│
├── server/                              ← Node.js + Express backend (TypeScript)
│   ├── src/
│   │   ├── index.ts                     ← Entry point. Loads dotenv via require() FIRST,
│   │   │                                  then imports config. This order is critical.
│   │   ├── register.ts                  ← Unused bootstrap file (kept for reference)
│   │   ├── config/
│   │   │   └── env.ts                   ← Reads process.env. No dotenv call here.
│   │   ├── routes/
│   │   │   └── ai.routes.ts             ← All 9 API endpoints + in-memory docTextStore
│   │   ├── services/
│   │   │   ├── gemini.service.ts        ← All Gemini AI functions (7 exports)
│   │   │   └── pdf.service.ts           ← PDF text extraction via pdf-parse
│   │   └── types/
│   │       └── index.ts                 ← Shared TS interfaces (SummarySection, Flashcard, etc.)
│   ├── .env                             ← 🔑 REAL credentials — never commit
│   ├── .env.example                     ← Safe template to share
│   ├── package.json
│   └── tsconfig.json
│
├── studybuddy/                          ← Angular 21 frontend (standalone components)
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.ts                   ← Root component (renders navbar + router-outlet)
│   │   │   ├── app.routes.ts            ← 6 lazy-loaded routes
│   │   │   ├── app.config.ts            ← provideRouter(withViewTransitions) + provideHttpClient
│   │   │   ├── models/
│   │   │   │   └── study.models.ts      ← All TypeScript interfaces (source of truth)
│   │   │   ├── services/
│   │   │   │   ├── ai.service.ts        ← Calls backend API, tracks progress signal
│   │   │   │   ├── auth.service.ts      ← localStorage auth (register/login/logout)
│   │   │   │   ├── download.service.ts  ← Export flashcards/quiz as printable HTML
│   │   │   │   ├── study-data.service.ts← All app data + localStorage persistence
│   │   │   │   └── theme.service.ts     ← Dark/light mode + accessibility settings
│   │   │   ├── components/
│   │   │   │   ├── navbar/              ← Auth-aware navbar with user dropdown
│   │   │   │   ├── auth-modal/          ← Login + Register modal (tabs)
│   │   │   │   └── accessibility-panel/ ← Font size, TTS, dyslexia, contrast toggles
│   │   │   └── pages/
│   │   │       ├── landing/             ← Marketing page + PDF upload zone
│   │   │       ├── dashboard/           ← Stats, recent docs, quiz chart, heatmap
│   │   │       ├── workspace/           ← PDF upload + AI generation + summaries viewer
│   │   │       ├── flashcards/          ← Flip cards, spaced repetition, download
│   │   │       ├── quiz/                ← MCQ/T-F quiz, timer, results, download
│   │   │       └── profile/             ← User stats, quiz history, edit name, sign out
│   │   ├── environments/
│   │   │   ├── environment.ts           ← { apiUrl: 'http://localhost:3000/api' }
│   │   │   └── environment.prod.ts      ← { apiUrl: 'https://your-server.com/api' }
│   │   └── styles.scss                  ← Global CSS variables, glassmorphism utilities
│   ├── angular.json                     ← fileReplacements for prod environment
│   └── package.json
│
├── AGENT_CONTEXT.md                     ← This file
└── studysphere_ai_v2.html               ← Original HTML prototype (reference only)
```

---

## 4. Environment Variables (`server/.env`)

| Variable | Required | Current Value | Notes |
|---|---|---|---|
| `GEMINI_API_KEY` | ✅ YES | Set (39 chars) | Get free at https://aistudio.google.com/app/apikey |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | **Do not change** — this is the correct current model |
| `PORT` | No | `3000` | Backend port |
| `ALLOWED_ORIGIN` | No | `http://localhost:4200` | Angular dev server |
| `RATE_LIMIT_WINDOW_MS` | No | `60000` | 1 minute window |
| `RATE_LIMIT_MAX` | No | `30` | Max requests per IP per window |
| `MAX_FILE_SIZE_BYTES` | No | `20971520` | 20 MB max PDF |
| `UPLOAD_DIR` | No | `./uploads` | Temp dir (not used, memory storage) |

**⚠️ Critical dotenv loading note:**
`index.ts` uses `require('dotenv')` at the very top (before any imports) to load `.env`.
This is intentional — TypeScript `import` hoisting would cause `env.ts` to evaluate before
dotenv runs if a normal `import dotenv` was used. Do NOT move or remove those `require()` lines.

---

## 5. Backend API Endpoints

Base URL: `http://localhost:3000/api`

| Method | Path | Body | Returns | Notes |
|---|---|---|---|---|
| GET | `/health` | — | `{ status, model, docsInMemory }` | Always works |
| POST | `/process-pdf` | `multipart/form-data`: `pdf` (file) + `docId` (string) | `{ docId, name, pages, subject, wordCount, keywords, extractedText }` | Stores text in memory for 2h |
| POST | `/generate-summary` | `{ docId }` | `{ docId, summaries[] }` | Requires prior `/process-pdf` |
| POST | `/generate-flashcards` | `{ docId, count? }` | `{ docId, flashcards[] }` | Default count: 15 |
| POST | `/generate-quiz` | `{ docId, count? }` | `{ docId, questions[] }` | Default count: 10 |
| POST | `/generate-all` | `{ docId }` | `{ docId, summaries[], flashcards[], questions[] }` | Runs all 3 in parallel |
| POST | `/simpler-explanation` | `{ content, subject? }` | `{ simplified }` | No docId needed |
| POST | `/expand-detail` | `{ content, subject? }` | `{ expanded }` | No docId needed |
| POST | `/extract-keywords` | `{ text }` | `{ keywords[] }` | No docId needed |

**⚠️ In-memory store limitation:**
`docTextStore` is a `Map<string, { text, subject, name }>` in `ai.routes.ts`.
It is cleared on server restart. If the server restarts, users must re-upload their PDF
before calling generate-* endpoints. This is the #1 known limitation to fix.

---

## 6. Gemini AI Service (`server/src/services/gemini.service.ts`)

Uses `@google/genai` v2.0.1 (NOT the old `@google/generative-ai`).

```typescript
// Correct SDK usage:
import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI({ apiKey: config.gemini.apiKey });
const response = await ai.models.generateContent({
  model: config.gemini.model,   // 'gemini-2.5-flash'
  contents: prompt,
  config: { temperature: 0.4, topP: 0.9, maxOutputTokens: 8192 }
});
const text = response.text;
```

**Exported functions:**
- `generateSummaries(docId, text, subject)` → `SummarySection[]` (3 sections)
- `generateFlashcards(docId, text, subject, count=15)` → `Flashcard[]`
- `generateQuizQuestions(docId, text, subject, count=10)` → `QuizQuestion[]`
- `generateAll(docId, text, subject)` → runs all 3 in `Promise.all()`
- `extractKeywords(text)` → `string[]`
- `simplerExplanation(content, subject)` → `string`
- `expandDetail(content, subject)` → `string`

**JSON parsing:** Gemini sometimes wraps JSON in markdown fences. `parseJSON<T>()` strips them.
**Text truncation:** `truncate(text, maxChars)` caps at 60,000 chars before sending to Gemini.

---

## 7. Angular Services

### `AiService` (`services/ai.service.ts`)
- `progress` signal tracks upload/processing/generation state
- `isAvailable` signal: `null` = not checked, `true` = online, `false` = offline
- `checkHealth()` — pings `/api/health` with 3s timeout
- `processAndGenerate(file, docId, onProgress?)` — full pipeline: upload → generate
- `simplerExplanation(content, subject)` → calls `/api/simpler-explanation`
- `expandDetail(content, subject)` → calls `/api/expand-detail`
- `resetProgress()` — resets all steps to Pending

### `StudyDataService` (`services/study-data.service.ts`)
- Signals: `documents`, `flashcards`, `quizAttempts`, `stats`
- Uses `effect()` to reload data when auth state changes (login/logout)
- `persistNow()` — public method to save to localStorage (call after AI updates)
- Guest data: `localStorage['sb_guest']`
- User data: `localStorage['sb_data_<userId>']`

### `AuthService` (`services/auth.service.ts`)
- `currentUser` signal, `isLoggedIn` computed
- `register(name, email, password)` → creates user, logs in immediately
- `login(email, password)` → validates hash, sets session
- `logout()` → clears session signal + localStorage key
- Users stored in `localStorage['sb_users']` (array with passwordHash)
- Session: `localStorage['sb_session']` = userId
- **Password hashing is a simple bit-shift hash — NOT bcrypt. Not production-safe.**

### `DownloadService` (`services/download.service.ts`)
- `downloadFlashcardsHTML(cards, docName)` → saves printable `.html` file
- `downloadQuizHTML(questions, docName)` → saves printable `.html` with answers
- `downloadFlashcards(cards, filename)` → saves `.json`
- `downloadQuiz(questions, filename)` → saves `.json`

### `ThemeService` (`services/theme.service.ts`)
- Persists to `localStorage['sb_a11y']`
- Toggles: `darkMode`, `dyslexiaMode`, `highContrast`, `textToSpeech`
- `setFontSize(size)` → updates `--base-font` CSS variable

---

## 8. Angular Routes

| Path | Component | Title |
|---|---|---|
| `/` | `LandingComponent` | StudyBuddy — AI-Powered Learning |
| `/dashboard` | `DashboardComponent` | Dashboard — StudyBuddy |
| `/workspace` | `WorkspaceComponent` | Workspace — StudyBuddy |
| `/flashcards` | `FlashcardsComponent` | Flashcards — StudyBuddy |
| `/quiz` | `QuizComponent` | Quiz — StudyBuddy |
| `/profile` | `ProfileComponent` | Profile — StudyBuddy |
| `**` | redirect to `/` | — |

All routes are **lazy-loaded standalone components**. No NgModules anywhere.

---

## 9. Data Models (`models/study.models.ts`)

```typescript
UploadedDocument  { id, name, size, uploadDate(ISO), status, progress, pages?, subject?,
                    summaries?, flashcards?, quizQuestions? }
SummarySection    { id, icon, iconColor, title, expanded, content, keyPoints? }
Flashcard         { id, docId, front, back, type, difficulty, subject, isFavorite,
                    spacedRepetitionScore, lastReviewed? }
QuizQuestion      { id, docId, text, type, options?, correctAnswer, explanation, difficulty }
QuizAttempt       { id, docId, docName, date, score, correct, wrong, skipped, timeTaken, totalQuestions }
QuizResult        { totalQuestions, correct, wrong, skipped, timeTaken, score }
StudyStats        { documents, cardsStudied, quizzesDone, studyHours, streak, lastStudied,
                    activityLog[], quizScores[] }
User              { id, name, email, avatar(initials), createdAt }
UserData          { user, stats, documents[], flashcards[], quizAttempts[] }
AccessibilitySettings { darkMode, fontSize, textToSpeech, dyslexiaMode, highContrast, reducedMotion }
```

---

## 10. Key Angular Patterns

- **Standalone components** — no NgModules anywhere
- **Angular Signals** — `signal()`, `computed()`, `effect()` for all state
- **No RxJS** — pure signals + native `fetch()`
- **Lazy routes** — all 6 pages loaded on demand
- **`effect()` in StudyDataService** — auto-reloads data when `auth.currentUser()` changes
- **`persistNow()`** — must be called after any direct mutation of `documents` signal in workspace

---

## 11. Workspace Page — AI Flow Detail

```
User drops PDF
  → WorkspaceComponent.processFiles()
  → data.addDocument(doc)           // adds to signal + persists
  → pendingFiles.set(docId, file)   // stores File object in memory
  → ai.processAndGenerate(file, docId, onProgress)
      → AiService.processPdf()      // POST /api/process-pdf (multipart)
      → AiService.generateAll()     // POST /api/generate-all
  → data.documents.update(...)      // injects summaries + quizQuestions
  → data.addFlashcards(...)         // adds to global flashcards signal
  → data.persistNow()               // saves everything to localStorage
```

**Regenerate button** requires the File object to still be in `pendingFiles` map.
If the user refreshes the page, `pendingFiles` is cleared (it's in-memory only).
They must re-upload the PDF to regenerate. This is a known UX limitation.

---

## 12. localStorage Key Map

| Key | Contents |
|---|---|
| `sb_users` | `Array<User & { passwordHash }>` — all registered accounts |
| `sb_session` | `string` — currently logged-in user ID |
| `sb_data_<userId>` | `UserData` — documents, flashcards, quizAttempts, stats |
| `sb_guest` | `{ documents, flashcards, quizAttempts, stats }` — guest session |
| `sb_a11y` | `AccessibilitySettings` — theme/font/accessibility prefs |

---

## 13. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Frontend framework | Angular | 21 |
| Frontend language | TypeScript | 5.4 |
| Frontend styles | SCSS + CSS variables | — |
| State management | Angular Signals | built-in |
| Backend runtime | Node.js | 22 |
| Backend framework | Express | 4.19 |
| Backend language | TypeScript | 5.4 |
| AI SDK | `@google/genai` | 2.0.1 |
| AI model | Gemini 2.5 Flash | `gemini-2.5-flash` |
| PDF parsing | `pdf-parse` | 1.1.1 |
| Auth | localStorage (client-side) | — |
| Icons | Tabler Icons (CDN) | latest |
| Fonts | Sora + Space Mono | Google Fonts |

---

## 14. Features Implemented ✅

- [x] PDF upload with drag & drop (workspace + landing page)
- [x] PDF text extraction via `pdf-parse` (server-side)
- [x] Subject auto-detection from PDF content (10 subjects)
- [x] Keyword extraction (offline, frequency-based)
- [x] Google Gemini AI: summaries (3 sections), flashcards (15), quiz (10 questions)
- [x] Parallel AI generation via `Promise.all()`
- [x] "Simpler Explanation" AI button → modal with Gemini response
- [x] "Expand Detail" AI button → modal with Gemini response
- [x] Interactive flashcards with 3D flip animation + spaced repetition
- [x] Flashcard filters: All / Definitions / Formulas / Fill-in / Difficult / Favorites
- [x] Timed quiz (5 min) with MCQ + True/False, instant feedback, score analytics
- [x] Quiz history saved per user/guest
- [x] Dashboard: stats tiles, quiz bar chart, activity heatmap, recent docs
- [x] Optional sign-in (register/login/logout) with localStorage persistence
- [x] Guest mode (data saved in `sb_guest`, cleared on explicit action)
- [x] Dark/light mode toggle
- [x] Accessibility panel: font size (12–20px), TTS, dyslexia font, high contrast
- [x] Text-to-speech (reads summaries aloud via Web Speech API)
- [x] Export notes as Markdown file
- [x] Download flashcards as printable HTML
- [x] Download quiz as printable HTML with answers
- [x] User profile page: edit name, view stats, quiz history, sign out
- [x] Backend online/offline indicator in workspace sidebar
- [x] Fallback simulation when backend is offline
- [x] Rate limiting (30 req/min per IP)
- [x] CORS restricted to `http://localhost:4200`
- [x] Helmet security headers

---

## 15. Known Issues & Limitations

| Issue | Severity | Location | Fix Needed |
|---|---|---|---|
| Server restart clears all uploaded PDFs | High | `ai.routes.ts` `docTextStore` | Replace Map with Redis or DB |
| Regenerate requires re-upload after page refresh | Medium | `workspace.ts` `pendingFiles` | Store file in IndexedDB or re-upload automatically |
| Password hashing is not bcrypt | High (if deploying) | `auth.service.ts` | Replace with bcrypt + JWT backend auth |
| No real database | High (if deploying) | All services | Add MongoDB or PostgreSQL |
| `env.ts` default model fallback is old `gemini-1.5-flash` | Low | `config/env.ts` line 30 | Change fallback to `gemini-2.5-flash` |
| Quiz questions stored inside `UploadedDocument.quizQuestions` | Medium | `study.models.ts` | Move to separate `quizQuestions` signal in StudyDataService |
| No loading state on profile page quiz history | Low | `profile.html` | Add skeleton loader |

---

## 16. TODO — Next Implementation Priorities

### High Priority
- [ ] **Fix `env.ts` default model** — change fallback from `gemini-1.5-flash` to `gemini-2.5-flash`
- [ ] **Persist PDF text to disk/DB** — so server restart doesn't lose uploaded docs
  - Option A: Save extracted text to `uploads/<docId>.txt` on disk
  - Option B: Add Redis with `SET docId text EX 7200`
  - Option C: Add MongoDB with a `documents` collection
- [ ] **AI Chat Assistant** — "Ask a question about this document" feature
  - New endpoint: `POST /api/chat` with `{ docId, message, history[] }`
  - New Angular component: `ChatComponent` in workspace sidebar
- [ ] **Move quiz questions to their own signal** in `StudyDataService`
  - Currently stored inside `UploadedDocument.quizQuestions` (awkward)
  - Should be `quizQuestions = signal<QuizQuestion[]>([])` like flashcards

### Medium Priority
- [ ] **Real backend auth** (JWT + bcrypt)
  - Install: `bcrypt`, `jsonwebtoken`, `@types/bcrypt`, `@types/jsonwebtoken`
  - New routes: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
  - Angular: replace localStorage auth with HTTP calls + JWT in httpOnly cookie
- [ ] **User profile photo** — upload avatar image, store as base64 in localStorage
- [ ] **Study reminders** — browser Notification API, set daily reminder time
- [ ] **Share study materials** — generate shareable link (requires backend + DB)

### Low Priority
- [ ] **Production deployment config** — Docker + nginx + PM2
- [ ] **PWA support** — service worker for true offline mode
- [ ] **Keyboard shortcuts** — space to flip card, arrow keys to navigate
- [ ] **Leaderboard** — compare scores with other users (requires backend)

---

## 17. Quick Reference — Common Tasks

**Add a new API endpoint:**
1. Add function to `server/src/services/gemini.service.ts`
2. Add route to `server/src/routes/ai.routes.ts`
3. Add method to `studybuddy/src/app/services/ai.service.ts`
4. Call from the relevant Angular component

**Add a new Angular page:**
1. Create `src/app/pages/<name>/<name>.ts|html|scss`
2. Add lazy route to `app.routes.ts`
3. Add nav link to `navbar.ts` `navLinks` array if needed

**Add a new data field to a model:**
1. Update `studybuddy/src/app/models/study.models.ts`
2. Update `server/src/types/index.ts` if it's a backend type
3. Update `StudyDataService` if it needs to be persisted
4. Update `AuthService.initUserData()` to include the new field with a default

**Debug Gemini responses:**
- All Gemini calls go through `generate(prompt)` in `gemini.service.ts`
- Add `console.log('[Gemini raw]', raw)` before `parseJSON()` to see raw output
- Common issue: Gemini wraps JSON in ```json fences — `parseJSON()` handles this

---

## 18. Verified Working (Tested Live)

```
✅ GET  /api/health                    → { status: "ok", model: "gemini-2.5-flash" }
✅ POST /api/simpler-explanation       → Gemini returns simplified text
✅ POST /api/expand-detail             → Gemini returns detailed explanation (~400 words)
✅ POST /api/extract-keywords          → Gemini returns keyword array
✅ Angular build (ng build --dev)      → 0 errors, 6 lazy chunks
✅ Backend tsc --noEmit                → 0 errors
```

---

*If you are an AI agent reading this: start by running both servers, hit `/api/health`,
then read the specific files for the feature you are implementing before making changes.*
