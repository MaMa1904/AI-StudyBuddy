import { Component, signal, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AiService } from '../../services/ai.service';

@Component({
  selector: 'app-highlight-ask',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './highlight-ask.html',
  styleUrl: './highlight-ask.scss'
})
export class HighlightAskComponent {
  ai = inject(AiService);

  visible      = signal(false);
  popupX       = signal(0);
  popupY       = signal(0);
  selectedText = signal('');
  isLoading    = signal(false);
  answer       = signal('');
  subject      = 'General';

  @HostListener('document:mouseup', ['$event'])
  onMouseUp(event: MouseEvent) {
    const selection = window.getSelection();
    const text = selection?.toString().trim() ?? '';
    if (text.length > 5) {
      this.selectedText.set(text);
      this.popupX.set(Math.min(event.clientX, window.innerWidth - 340));
      this.popupY.set(event.clientY + 16);
      this.visible.set(true);
      this.answer.set('');
      // Auto-call Gemini immediately
      this.autoExplain(text);
    }
  }

  autoExplain(text: string) {
    this.isLoading.set(true);
    this.ai.askAboutSelection(text, 'Explain this concept clearly in simple terms.', this.subject)
      .then(res => this.answer.set(res.answer))
      .catch(() => this.answer.set('Could not get explanation. Try again.'))
      .finally(() => this.isLoading.set(false));
  }

  close() {
    this.visible.set(false);
    this.answer.set('');
    window.getSelection()?.removeAllRanges();
  }
}
