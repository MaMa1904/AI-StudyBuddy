import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/landing/landing').then(m => m.LandingComponent),
    title: 'StudyBuddy — AI-Powered Learning'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.DashboardComponent),
    title: 'Dashboard — StudyBuddy'
  },
  {
    path: 'workspace',
    loadComponent: () => import('./pages/workspace/workspace').then(m => m.WorkspaceComponent),
    title: 'Workspace — StudyBuddy'
  },
  {
    path: 'flashcards',
    loadComponent: () => import('./pages/flashcards/flashcards').then(m => m.FlashcardsComponent),
    title: 'Flashcards — StudyBuddy'
  },
  {
  path: 'study-plan',
  loadComponent: () => import('./pages/study-plan/study-plan').then(m => m.StudyPlanComponent),
  title: 'Study Plan — StudyBuddy'
},
  {
    path: 'quiz',
    loadComponent: () => import('./pages/quiz/quiz').then(m => m.QuizComponent),
    title: 'Quiz — StudyBuddy'
  },
  {
    path: 'profile',
    loadComponent: () => import('./pages/profile/profile').then(m => m.ProfileComponent),
    title: 'Profile — StudyBuddy'
  },
  {
    path: '**',
    redirectTo: ''
  }
];
