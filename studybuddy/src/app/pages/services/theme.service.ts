import { Injectable, signal } from '@angular/core';
import { AccessibilitySettings } from '../models/study.models';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  settings = signal<AccessibilitySettings>({
    darkMode: true,
    fontSize: 14,
    textToSpeech: false,
    dyslexiaMode: false,
    highContrast: false,
    reducedMotion: false,
  });

  constructor() {
    // Respect OS-level preference for reduced motion on first load
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const saved = localStorage.getItem('sb_a11y');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as AccessibilitySettings;
        this.settings.set(parsed);
      } catch {
        // Corrupted — use defaults
      }
    } else if (prefersReduced) {
      this.settings.update(s => ({ ...s, reducedMotion: true }));
    }
    this.applySettings();
  }

  toggleDarkMode() {
    this.settings.update(s => ({ ...s, darkMode: !s.darkMode }));
    this.applySettings();
    this.save();
  }

  toggleDyslexia() {
    this.settings.update(s => ({ ...s, dyslexiaMode: !s.dyslexiaMode }));
    this.applySettings();
    this.save();
  }

  toggleHighContrast() {
    this.settings.update(s => ({ ...s, highContrast: !s.highContrast }));
    this.applySettings();
    this.save();
  }

  toggleReducedMotion() {
    this.settings.update(s => ({ ...s, reducedMotion: !s.reducedMotion }));
    this.applySettings();
    this.save();
  }

  toggleTTS() {
    this.settings.update(s => ({ ...s, textToSpeech: !s.textToSpeech }));
    this.save();
  }

  setFontSize(size: number) {
    this.settings.update(s => ({ ...s, fontSize: size }));
    document.documentElement.style.setProperty('--base-font', size + 'px');
    this.save();
  }

  private applySettings() {
    const s = this.settings();
    const body = document.body;
    body.classList.toggle('light-mode',      !s.darkMode);
    body.classList.toggle('dyslexia-mode',   s.dyslexiaMode);
    body.classList.toggle('high-contrast',   s.highContrast);
    body.classList.toggle('reduced-motion',  s.reducedMotion);
    document.documentElement.style.setProperty('--base-font', s.fontSize + 'px');
  }

  private save() {
    localStorage.setItem('sb_a11y', JSON.stringify(this.settings()));
  }
}
