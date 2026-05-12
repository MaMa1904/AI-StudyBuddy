import { Component, inject, output } from '@angular/core';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-accessibility-panel',
  templateUrl: './accessibility-panel.html',
  styleUrl: './accessibility-panel.scss'
})
export class AccessibilityPanelComponent {
  theme = inject(ThemeService);
  close = output<void>();

  fontSizes = [12, 14, 16, 18, 20];

  speak(text: string) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(text);
      window.speechSynthesis.speak(utt);
    }
  }
}
