import { Component, inject, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';

type AuthTab = 'login' | 'register';

@Component({
  selector: 'app-auth-modal',
  imports: [FormsModule],
  templateUrl: './auth-modal.html',
  styleUrl: './auth-modal.scss'
})
export class AuthModalComponent {
  auth  = inject(AuthService);
  close = output<void>();

  tab          = signal<AuthTab>('login');
  loading      = signal(false);
  error        = signal('');
  showPassword = signal(false);

  // Login form fields
  loginEmail    = '';
  loginPassword = '';

  // Register form fields
  regName     = '';
  regEmail    = '';
  regPassword = '';
  regConfirm  = '';

  setTab(t: AuthTab) {
    this.tab.set(t);
    this.error.set('');
  }

  onLogin() {
    this.error.set('');
    if (!this.loginEmail || !this.loginPassword) {
      this.error.set('Please fill in all fields.');
      return;
    }
    this.loading.set(true);
    const result = this.auth.login(this.loginEmail, this.loginPassword);
    this.loading.set(false);
    if (result.success) {
      this.close.emit();
    } else {
      this.error.set(result.error ?? 'Login failed.');
    }
  }

  onRegister() {
    this.error.set('');
    if (!this.regName || !this.regEmail || !this.regPassword || !this.regConfirm) {
      this.error.set('Please fill in all fields.');
      return;
    }
    if (this.regName.trim().length < 2) {
      this.error.set('Name must be at least 2 characters.');
      return;
    }
    if (!this.isValidEmail(this.regEmail)) {
      this.error.set('Please enter a valid email address.');
      return;
    }
    if (this.regPassword.length < 6) {
      this.error.set('Password must be at least 6 characters.');
      return;
    }
    if (this.regPassword !== this.regConfirm) {
      this.error.set('Passwords do not match.');
      return;
    }
    this.loading.set(true);
    const result = this.auth.register(this.regName, this.regEmail, this.regPassword);
    this.loading.set(false);
    if (result.success) {
      this.close.emit();
    } else {
      this.error.set(result.error ?? 'Registration failed.');
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
