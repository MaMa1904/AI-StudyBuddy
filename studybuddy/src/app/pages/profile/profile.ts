import { Component, inject, signal, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { StudyDataService } from '../../services/study-data.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class ProfileComponent {
  auth   = inject(AuthService);
  data   = inject(StudyDataService);
  router = inject(Router);
  Math   = Math;

  editMode    = signal(false);
  editName    = signal('');
  saveMsg     = signal('');
  saveMsgType = signal<'success' | 'error'>('success');
  showConfirm = signal(false);

  // Show "Clear Guest Data" only when guest data actually exists
  hasGuestData = computed(() => localStorage.getItem('sb_guest') !== null);

  storageUsed = computed(() => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) ?? '';
      if (key.startsWith('sb_')) {
        total += (localStorage.getItem(key) ?? '').length * 2; // UTF-16 bytes
      }
    }
    return (total / 1024).toFixed(1); // KB
  });

  startEdit() {
    this.editName.set(this.auth.currentUser()?.name ?? '');
    this.editMode.set(true);
    this.saveMsg.set('');
  }

  saveEdit() {
    const name = this.editName().trim();
    if (!name || name.length < 2) {
      this.saveMsg.set('Name must be at least 2 characters.');
      this.saveMsgType.set('error');
      return;
    }
    const user = this.auth.currentUser();
    if (!user) return;

    try {
      const newAvatar = name.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
      const updatedUser = { ...user, name, avatar: newAvatar };

      // Update in users list
      const usersRaw = localStorage.getItem('sb_users');
      if (usersRaw) {
        const users = JSON.parse(usersRaw);
        const updated = users.map((u: any) => u.id === user.id ? { ...u, name, avatar: newAvatar } : u);
        localStorage.setItem('sb_users', JSON.stringify(updated));
      }

      // Update user data record
      const dataKey = `sb_data_${user.id}`;
      const dataRaw = localStorage.getItem(dataKey);
      if (dataRaw) {
        const userData = JSON.parse(dataRaw);
        userData.user = updatedUser;
        localStorage.setItem(dataKey, JSON.stringify(userData));
      }

      this.auth.currentUser.set(updatedUser);
      this.editMode.set(false);
      this.saveMsg.set('Profile updated successfully!');
      this.saveMsgType.set('success');
      setTimeout(() => this.saveMsg.set(''), 3000);
    } catch {
      this.saveMsg.set('Failed to save. Please try again.');
      this.saveMsgType.set('error');
    }
  }

  clearGuestData() {
    // Remove guest data from localStorage WITHOUT calling persistNow()
    // (persistNow would immediately re-write the current in-memory state back)
    localStorage.removeItem('sb_guest');
    this.saveMsg.set('Guest data cleared.');
    this.saveMsgType.set('success');
    setTimeout(() => this.saveMsg.set(''), 3000);
  }

  confirmLogout() { this.showConfirm.set(true); }
  cancelLogout()  { this.showConfirm.set(false); }

  logout() {
    this.auth.logout();
    this.router.navigate(['/']);
  }

  formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return 'Unknown date';
    }
  }
}
