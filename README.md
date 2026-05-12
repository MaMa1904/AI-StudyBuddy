# 📚 AI-StudyBuddy

<div align="center">
  <p><strong>Your AI-Powered Learning Companion</strong></p>
  <p>Upload any PDF and get instant AI-generated summaries, flashcards, and quizzes.</p>

  <!-- Badges -->
  <img src="https://img.shields.io/badge/Angular-21-DD0031?style=flat&logo=angular" alt="Angular">
  <img src="https://img.shields.io/badge/Node.js-22-339933?style=flat&logo=nodedotjs" alt="Node.js">
  <img src="https://img.shields.io/badge/Express.js-4.19-000000?style=flat&logo=express" alt="Express">
  <img src="https://img.shields.io/badge/Google%20Gemini-AI-8E75B2?style=flat&logo=google" alt="Gemini">
  <img src="https://img.shields.io/badge/TypeScript-5.4-3178C6?style=flat&logo=typescript" alt="TypeScript">
</div>

---

## 🚀 Overview

**AI-StudyBuddy** is a full-stack educational web application designed to supercharge your learning process. By leveraging the power of Google's **Gemini 2.5 Flash** AI model, StudyBuddy transforms static PDF documents into interactive study materials in seconds. 

Whether you're a student preparing for exams or a professional learning new skills, StudyBuddy automatically detects the subject, extracts key information, and provides a customized learning experience.

## ✨ Key Features

- **📄 Smart PDF Processing:** Upload PDFs via drag & drop. Automatically extracts text and identifies the subject using `pdf-parse`.
- **🤖 Gemini AI Integration:** Automatically generates structured summaries, interactive flashcards, and comprehensive quizzes (MCQ & True/False) in parallel.
- **🃏 Interactive Flashcards:** 3D flip animations, categorization (Definitions, Formulas, etc.), and spaced repetition scoring.
- **📝 Timed Quizzes:** Test your knowledge with 5-minute timed quizzes, instant feedback, and score analytics.
- **📊 Personalized Dashboard:** Track your study hours, streaks, quiz scores, and activity heatmaps.
- **🌓 Accessibility & Theming:** Built-in Dark/Light mode, font-size adjustments, text-to-speech summaries, dyslexia-friendly fonts, and high contrast options.
- **💾 Export & Download:** Export your AI-generated notes to Markdown, or download flashcards and quizzes as printable HTML files.
- **🔐 User Persistence:** Optional sign-in with local storage persistence, plus a fully functional Guest mode.

## 💻 Tech Stack

### Frontend
* **Framework:** Angular 21 (Standalone Components, Signals, no RxJS)
* **Language:** TypeScript 5.4
* **Styling:** SCSS + CSS Variables (Glassmorphism design)
* **State Management:** Angular Signals

### Backend
* **Runtime:** Node.js 22
* **Framework:** Express 4.19
* **Language:** TypeScript 5.4
* **AI Integration:** `@google/genai` (Gemini 2.5 Flash)
* **PDF Processing:** `pdf-parse`
* **Security:** Helmet, Express Rate Limit, CORS

---

## 🛠️ Getting Started

### Prerequisites

- Node.js (v22 recommended)
- npm (v10+)
- Angular CLI (`npm install -g @angular/cli`)
- A free **Google Gemini API Key** (Get it at [Google AI Studio](https://aistudio.google.com/app/apikey))

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/AI-StudyBuddy.git
cd AI-StudyBuddy
```

### 2. Configure the Backend

```bash
cd server
npm install

# Create your environment variables file
cp .env.example .env
```
Open `server/.env` and replace `your_gemini_api_key_here` with your actual Gemini API key.

### 3. Start the Backend Server

```bash
npm run dev
```
The server will run at **http://localhost:3000**

### 4. Start the Frontend Application

Open a new terminal window:

```bash
cd studybuddy
npm install
ng serve
```
The application will run at **http://localhost:4200**

---

## 🔌 API Endpoints (Backend)

The Express backend provides the following core endpoints (`http://localhost:3000/api`):

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET`  | `/health` | Server health check & active model status |
| `POST` | `/process-pdf` | Upload and extract text from PDF |
| `POST` | `/generate-summary` | Generate smart summaries |
| `POST` | `/generate-flashcards` | Generate flashcards (default: 15) |
| `POST` | `/generate-quiz` | Generate quiz questions (default: 10) |
| `POST` | `/generate-all` | Run summaries, flashcards, and quiz generation in parallel |
| `POST` | `/simpler-explanation` | Ask AI to simplify a specific concept |
| `POST` | `/expand-detail` | Ask AI to elaborate on a specific concept |
| `POST` | `/extract-keywords` | Extract relevant keywords from text |

---

## 🏗️ Project Architecture

StudyBuddy utilizes a modern, signal-based Angular frontend communicating with a lightweight Node.js/Express backend.
- The **Frontend** leverages Angular 21's standalone components and Signals for purely reactive state management without RxJS overhead. Data persistence is handled via `localStorage`.
- The **Backend** stores parsed PDF text in memory to efficiently serve multiple parallel AI requests using the `@google/genai` SDK.

---

## 🚧 Known Limitations & Future Work

- **In-Memory Storage:** Uploaded PDF text is currently stored in server memory and will be cleared upon a backend restart. Future updates will introduce Redis or a database (e.g., MongoDB/PostgreSQL).
- **Authentication:** Current authentication uses simple local hashing. A migration to JWT + bcrypt is planned.
- **AI Chat:** An upcoming feature to chat directly with the document in a conversational sidebar.

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/your-username/AI-StudyBuddy/issues).

## 📄 License

This project is licensed under the MIT License.
