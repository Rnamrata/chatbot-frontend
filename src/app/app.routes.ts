import { Routes } from '@angular/router';

// Phase 1: every screen is a placeholder. Phases 2–5 swap in the real page components.
const placeholder = () =>
  import('./features/placeholder-page').then((m) => m.PlaceholderPage);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
  {
    path: 'chat',
    title: 'New chat · Lens',
    loadComponent: placeholder,
    data: { heading: 'New chat', phase: 'phase 2' },
  },
  {
    path: 'chat/:sessionId',
    title: 'Chat · Lens',
    loadComponent: placeholder,
    data: { heading: 'Chat', phase: 'phase 2' },
  },
  {
    path: 'review',
    title: 'New code review · Lens',
    loadComponent: placeholder,
    data: { heading: 'New code review', phase: 'phase 4' },
  },
  {
    path: 'review/:reviewId',
    title: 'Code review · Lens',
    loadComponent: placeholder,
    data: { heading: 'Code review', phase: 'phase 4' },
  },
  {
    path: 'sources',
    title: 'Sources · Lens',
    loadComponent: placeholder,
    data: {
      heading: 'Sources',
      subtitle: 'Everything you add here can be used to answer questions in any chat.',
      phase: 'phase 3',
    },
  },
  {
    path: 'history',
    title: 'History · Lens',
    loadComponent: placeholder,
    data: {
      heading: 'History',
      subtitle: 'Every chat and code review, newest first.',
      phase: 'phase 5',
    },
  },
  { path: '**', redirectTo: 'chat' },
];