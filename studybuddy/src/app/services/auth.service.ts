import { Injectable, signal, computed } from '@angular/core';
import { User, UserData, StudyStats } from '../models/study.models';

const USERS_KEY = 'sb_users';       // all registered users
const SESSION_KEY = 'sb_session';   // currently logged-in user id
const DATA_PREFIX = 'sb_data_';     // per-user data prefix

@Injectable({ providedIn: 'root' })
export class AuthService {
  currentUser = signal<User | null>(null);
  isLoggedIn = computed(() => this.currentUser() !== null);

  constructor() {
    // Restore session on app load
    const sessionId = localStorage.getItem(SESSION_KEY);
    if (sessionId) {
      const users = this.getUsers();
      const user = users.find(u => u.id === sessionId) ?? null;
      this.currentUser.set(user);
    }
  }

  // ── Registration ──────────────────────────────────────────────
  register(name: string, email: string, password: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
      return { success: false, error: 'An account with this email already exists.' };
    }

    const user: User = {
      id: this.generateId(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      avatar: this.makeInitials(name),
      createdAt: new Date().toISOString(),
    };

    // Store hashed password alongside user (simple hash for demo — not production-grade)
    const userRecord = { ...user, passwordHash: this.simpleHash(password) };
    users.push(userRecord);
    localStorage.setItem(USERS_KEY, JSON.stringify(users));

    // Initialize empty user data
    this.initUserData(user);

    // Log in immediately
    this.setSession(user);
    return { success: true };
  }

  // ── Login ─────────────────────────────────────────────────────
  login(email: string, password: string): { success: boolean; error?: string } {
    const users = this.getUsers();
    const record = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (!record) return { success: false, error: 'No account found with this email.' };
    if (record.passwordHash !== this.simpleHash(password)) {
      return { success: false, error: 'Incorrect password.' };
    }

    const user: User = {
      id: record.id,
      name: record.name,
      email: record.email,
      avatar: record.avatar,
      createdAt: record.createdAt,
    };
    this.setSession(user);
    return { success: true };
  }

  // ── Logout ────────────────────────────────────────────────────
  logout() {
    localStorage.removeItem(SESSION_KEY);
    this.currentUser.set(null);
  }

  // ── User Data Access ──────────────────────────────────────────
  getUserData(): UserData | null {
    const user = this.currentUser();
    if (!user) return null;
    const raw = localStorage.getItem(DATA_PREFIX + user.id);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserData;
    } catch {
      console.error('[AuthService] Corrupted user data in localStorage — resetting.');
      return null;
    }
  }

  saveUserData(data: UserData) {
    const user = this.currentUser();
    if (!user) return;
    localStorage.setItem(DATA_PREFIX + user.id, JSON.stringify(data));
  }

  updateStats(updater: (s: StudyStats) => StudyStats) {
    const data = this.getUserData();
    if (!data) return;
    data.stats = updater(data.stats);
    this.saveUserData(data);
  }

  // ── Helpers ───────────────────────────────────────────────────
  private setSession(user: User) {
    this.currentUser.set(user);
    localStorage.setItem(SESSION_KEY, user.id);
  }

  private getUsers(): any[] {
    const raw = localStorage.getItem(USERS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch {
      console.error('[AuthService] Corrupted users list in localStorage — resetting.');
      localStorage.removeItem(USERS_KEY);
      return [];
    }
  }

  private initUserData(user: User) {
    const data: UserData = {
      user,
      stats: {
        documents: 0,
        cardsStudied: 0,
        quizzesDone: 0,
        studyHours: 0,
        streak: 0,
        lastStudied: null,
        activityLog: [],
        quizScores: [],
      },
      documents: [],
      flashcards: [],
      quizAttempts: [],
    };
    localStorage.setItem(DATA_PREFIX + user.id, JSON.stringify(data));
  }

  private makeInitials(name: string): string {
    return name.trim().split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // Simple deterministic hash — NOT for production security
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(16);
  }
}
