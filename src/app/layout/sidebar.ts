import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ago } from '../features/history/history.models';
import { HistoryService } from '../features/history/history.service';
import { Icon, IconName } from '../shared/icon';
import { LensLogo } from '../shared/lens-logo';
import { ConnectionStatus } from './connection-status';

@Component({
  selector: 'app-sidebar',
  imports: [RouterLink, RouterLinkActive, Icon, LensLogo, ConnectionStatus],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.css',
})
export class Sidebar {
  private readonly history = inject(HistoryService);
  private readonly now = signal(new Date());

  /** Pinned chats first, then the latest; "Pinned · 2 min ago". */
  protected readonly recent = computed(() => {
    const now = this.now();
    return this.history.recent().map((item) => ({
      ...item,
      icon: (item.pinned ? 'pin' : item.kind === 'code' ? 'code' : 'chat') as IconName,
      when: item.pinned ? `Pinned · ${ago(item.at, now)}` : ago(item.at, now),
    }));
  });

  constructor() {
    const timer = setInterval(() => this.now.set(new Date()), 60_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}