# StudyBuddy 📚

AI-powered learning platform. Upload any PDF → get summaries, flashcards, and quizzes instantly.

## Quick Start

### Step 1 — Get a free Gemini API key
Go to **https://aistudio.google.com/app/apikey** → Create API key → Copy it.

### Step 2 — Configure the backend
```bash
cd server
copy .env.example .env
```
Open `server/.env` and replace `your_gemini_api_key_here` with your key.

### Step 3 — Start the backend
```bash
cd server
npm install
npm run dev
```
Server runs at **http://localhost:3000**

### Step 4 — Start the frontend
```bash
cd studybuddy
npm install   # if not already done
ng serve
```
App runs at **http://localhost:4200**

---

## Features
- 📄 PDF upload with drag & drop
- 🤖 Google Gemini AI summaries, flashcards & quizzes
- 🃏 Interactive flashcards with spaced repetition
- 📝 Timed quizzes with instant feedback
- 📊 Dashboard with streaks, stats & progress
- 🔐 Optional sign-in with localStorage persistence
- 🌙 Dark/light mode + accessibility settings
