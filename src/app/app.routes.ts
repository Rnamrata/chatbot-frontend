import { Routes } from '@angular/router';
const chatPage = () => import('./features/chat/chat-page').then((m) => m.ChatPage);
const sourcesPage = () => import('./features/sources/sources-page').then((m) => m.SourcesPage);
const reviewStart = () => import('./features/review/review-start').then((m) => m.ReviewStart);
const reviewPage = () => import('./features/review/review-page').then((m) => m.ReviewPage);
const historyPage = () => import('./features/history/history-page').then((m) => m.HistoryPage);

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
    loadComponent: reviewStart,
  },
  {
    path: 'review/:reviewId',
    title: 'Code review · Lens',
    loadComponent: reviewPage,
  },
  {
    path: 'sources',
    title: 'Sources · Lens',
    loadComponent: sourcesPage,
  },
  {
    path: 'history',
    title: 'History · Lens',
    loadComponent: historyPage,
  },
  { path: '**', redirectTo: 'chat' },
];