import { Component, inject, signal, HostListener } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { AccessibilityPanelComponent } from '../accessibility-panel/accessibility-panel';
import { AuthModalComponent } from '../auth-modal/auth-modal';

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, RouterLinkActive, AccessibilityPanelComponent, AuthModalComponent],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent {
  theme = inject(ThemeService);
  auth  = inject(AuthService);

  showA11y       = signal(false);
  mobileMenuOpen = signal(false);
  showAuthModal  = signal(false);
  showUserMenu   = signal(false);

  navLinks = [
    { path: '/',           label: 'Home',       icon: 'ti-home' },
    { path: '/dashboard',  label: 'Dashboard',  icon: 'ti-layout-dashboard' },
    { path: '/workspace',  label: 'Workspace',  icon: 'ti-file-text' },
    { path: '/flashcards', label: 'Flashcards', icon: 'ti-cards' },
    { path: '/quiz',       label: 'Quiz',       icon: 'ti-help-circle' },
  ];

  toggleA11y()     { this.showA11y.update(v => !v); this.showUserMenu.set(false); }
  toggleMobile()   { this.mobileMenuOpen.update(v => !v); }
  closeMobile()    { this.mobileMenuOpen.set(false); }
  openAuth()       { this.showAuthModal.set(true); this.showUserMenu.set(false); }
  closeAuth()      { this.showAuthModal.set(false); }
  toggleUserMenu() { this.showUserMenu.update(v => !v); this.showA11y.set(false); }

  logout() {
    this.auth.logout();
    this.showUserMenu.set(false);
  }

  // Close user dropdown when clicking anywhere outside it
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (this.showUserMenu() && !target.closest('.user-menu-wrap')) {
      this.showUserMenu.set(false);
    }
    if (this.showA11y() && !target.closest('app-accessibility-panel') && !target.closest('.nav-btn[title="Accessibility"]')) {
      // Don't close a11y panel on outside click — it has its own overlay
    }
  }
}
