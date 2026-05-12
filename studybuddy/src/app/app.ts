import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavbarComponent],
  template: `
    <div class="orb orb1" aria-hidden="true"></div>
    <div class="orb orb2" aria-hidden="true"></div>
    <div class="orb orb3" aria-hidden="true"></div>
    <app-navbar />
    <router-outlet />
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
  `]
})
export class App {}
