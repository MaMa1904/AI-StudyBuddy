import { Component, inject, signal, computed, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TitleCasePipe } from '@angular/common';
import { StudyDataService } from '../../services/study-data.service';
import { AuthService } from '../../services/auth.service';
import { DownloadService } from '../../services/download.service';
import { AuthModalComponent } from '../../components/auth-modal/auth-modal';
import { Flashcard } from '../../models/study.models';

type FilterType = 'All' | 'Definitions' | 'Formulas' | 'Fill-in' | 'Difficult' | 'Favorites';

@Component({
  selector: 'app-flashcards',
  imports: [RouterLink, TitleCasePipe, AuthModalComponent],
  templateUrl: './flashcards.html',
  styleUrl: './flashcards.scss'
})
export class FlashcardsComponent {
  data     = inject(StudyDataService);
  auth     = inject(AuthService);
  download = inject(DownloadService);

  currentIndex  = signal(0);
  isFlipped     = signal(false);
  activeFilter  = signal<FilterType>('All');
  shuffled      = signal(false);
  showAuthModal = signal(false);
  sessionDone   = signal(false); // true when user has reviewed all cards in session

  // Session-specific review counts (reset each session)
  sessionHard = signal(0);
  sessionOk   = signal(0);
  sessionEasy = signal(0);

  // Stable shuffled order — stores IDs only so card data stays fresh
  private shuffledIds = signal<string[]>([]);

  // Real counts from actual card data (reflects user markings via markCardReviewed)
  hardCount = computed(() => this.data.flashcards().filter(c => c.difficulty === 'hard').length);
  okCount   = computed(() => this.data.flashcards().filter(c => c.difficulty === 'medium').length);
  easyCount = computed(() => this.data.flashcards().filter(c => c.difficulty === 'easy').length);

  filters: FilterType[] = ['All', 'Definitions', 'Formulas', 'Fill-in', 'Difficult', 'Favorites'];

  filteredCards = computed<Flashcard[]>(() => {
    const filter = this.activeFilter();
    let cards = this.data.flashcards();

    switch (filter) {
      case 'Definitions': cards = cards.filter(c => c.type === 'definition'); break;
      case 'Formulas':    cards = cards.filter(c => c.type === 'formula');    break;
      case 'Fill-in':     cards = cards.filter(c => c.type === 'fill-in');    break;
      case 'Difficult':   cards = cards.filter(c => c.difficulty === 'hard'); break;
      case 'Favorites':   cards = cards.filter(c => c.isFavorite);            break;
    }

    // When shuffled, reorder using stored IDs but always use fresh card data
    if (this.shuffled()) {
      const cardMap = new Map(cards.map(c => [c.id, c]));
      return this.shuffledIds()
        .map(id => cardMap.get(id))
        .filter((c): c is Flashcard => !!c);
    }
    return cards;
  });

  currentCard = computed<Flashcard | null>(() =>
    this.filteredCards()[this.currentIndex()] ?? null
  );

  progress = computed(() => {
    const total = this.filteredCards().length;
    return total > 0 ? Math.round(((this.currentIndex() + 1) / total) * 100) : 0;
  });

  isLastCard = computed(() =>
    this.filteredCards().length > 0 &&
    this.currentIndex() === this.filteredCards().length - 1
  );

  setFilter(f: FilterType) {
    this.activeFilter.set(f);
    this.currentIndex.set(0);
    this.isFlipped.set(false);
    this.sessionDone.set(false);
    this.resetSessionCounts();
    // Re-create shuffled order if shuffle is active with new filter
    if (this.shuffled()) {
      this.createShuffledOrder();
    }
  }

  flipCard() { this.isFlipped.update(v => !v); }

  nextCard() {
    const total = this.filteredCards().length;
    if (this.currentIndex() < total - 1) {
      this.currentIndex.update(i => i + 1);
      this.isFlipped.set(false);
    }
    // If on last card, do nothing — markCard handles completion
  }

  prevCard() {
    if (this.currentIndex() > 0) {
      this.currentIndex.update(i => i - 1);
      this.isFlipped.set(false);
    }
  }

  toggleShuffle() {
    const newVal = !this.shuffled();
    this.shuffled.set(newVal);
    if (newVal) {
      this.createShuffledOrder();
    }
    // Reset to first card when toggling shuffle
    this.currentIndex.set(0);
    this.isFlipped.set(false);
    this.sessionDone.set(false);
    this.resetSessionCounts();
  }

  toggleFavorite() {
    const card = this.currentCard();
    if (card) this.data.toggleFavorite(card.id);
  }

  markCard(difficulty: 'hard' | 'ok' | 'easy') {
    const card = this.currentCard();
    if (card) this.data.markCardReviewed(card.id, difficulty === 'ok' ? 'medium' : difficulty);

    // Track session-specific marks
    if (difficulty === 'hard') this.sessionHard.update(n => n + 1);
    else if (difficulty === 'ok') this.sessionOk.update(n => n + 1);
    else this.sessionEasy.update(n => n + 1);

    if (this.isLastCard()) {
      // Show completion state instead of silently doing nothing
      this.sessionDone.set(true);
    } else {
      this.nextCard();
    }
  }

  restartSession() {
    this.currentIndex.set(0);
    this.isFlipped.set(false);
    this.sessionDone.set(false);
    this.resetSessionCounts();
    // Re-shuffle for a fresh session
    if (this.shuffled()) {
      this.createShuffledOrder();
    }
  }

  difficultyClass(d: string) {
    return { easy: 'tag-easy', medium: 'tag-med', hard: 'tag-hard' }[d] || '';
  }

  typeLabel(t: string) {
    return { definition: 'Definition', formula: 'Formula', 'fill-in': 'Fill in the Blank' }[t] || t;
  }

  downloadCards() {
    const cards = this.filteredCards();
    if (!cards.length) return;
    this.download.downloadFlashcardsHTML(cards, 'StudyBuddy Flashcards');
  }

  // ── Keyboard shortcuts ──────────────────────────────────────
  @HostListener('document:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    // Don't capture keys when user is typing in an input/textarea
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (this.sessionDone() || !this.currentCard()) return;

    switch (e.key) {
      case ' ':         // Space — flip card
        e.preventDefault();
        this.flipCard();
        break;
      case 'ArrowRight': // → — next card
        e.preventDefault();
        this.nextCard();
        break;
      case 'ArrowLeft':  // ← — previous card
        e.preventDefault();
        this.prevCard();
        break;
      case '1':          // 1 — mark hard
        this.markCard('hard');
        break;
      case '2':          // 2 — mark ok
        this.markCard('ok');
        break;
      case '3':          // 3 — mark easy
        this.markCard('easy');
        break;
      case 'f':          // f — toggle favorite
        this.toggleFavorite();
        break;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────
  private resetSessionCounts() {
    this.sessionHard.set(0);
    this.sessionOk.set(0);
    this.sessionEasy.set(0);
  }

  private createShuffledOrder() {
    const filter = this.activeFilter();
    let cards = this.data.flashcards();

    switch (filter) {
      case 'Definitions': cards = cards.filter(c => c.type === 'definition'); break;
      case 'Formulas':    cards = cards.filter(c => c.type === 'formula');    break;
      case 'Fill-in':     cards = cards.filter(c => c.type === 'fill-in');    break;
      case 'Difficult':   cards = cards.filter(c => c.difficulty === 'hard'); break;
      case 'Favorites':   cards = cards.filter(c => c.isFavorite);            break;
    }

    // Fisher-Yates shuffle — store IDs only for stable order with fresh data
    const ids = cards.map(c => c.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    this.shuffledIds.set(ids);
  }
}
