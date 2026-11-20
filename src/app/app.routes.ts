import { Routes } from '@angular/router';
const chatPage = () => import('./features/chat/chat-page').then((m) => m.ChatPage);
const sourcesPage = () => import('./features/sources/sources-page').then((m) => m.SourcesPage);
const placeholder = () =>
  import('./features/placeholder-page').then((m) => m.PlaceholderPage);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'chat' },
  {
    path: 'chat',
    title: 'New chat · Lens',
    loadComponent: chatPage,
  },
  {
    path: 'chat/:sessionId',
    title: 'Chat · Lens',
    loadComponent: chatPage,
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
    loadComponent: sourcesPage,
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