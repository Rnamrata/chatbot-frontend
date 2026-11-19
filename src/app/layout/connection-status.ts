import { Component, computed, inject } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { API_BASE_URL } from '../core/api';
import { ServiceState, StatusService } from '../core/status.service';
import { Icon } from '../shared/icon';

interface Row {
  name: string;
  state: ServiceState;
  detail: string;
}

/** One line when everything is up; the full card as soon as something is down. */
@Component({
  selector: 'app-connection-status',
  imports: [NgTemplateOutlet, Icon],
  templateUrl: './connection-status.html',
  styleUrl: './connection-status.css',
})
export class ConnectionStatus {
  protected readonly status = inject(StatusService);
  private readonly serverPort = ':' + new URL(inject(API_BASE_URL)).port;

  protected readonly collapsed = computed(() => this.status.allUp() || this.status.checking());

  protected readonly rows = computed<Row[]>(() => {
    const h = this.status.health();
    return [
      { name: 'Chat server', state: h.chatServer, detail: label(h.chatServer, this.serverPort) },
      { name: 'Ollama', state: h.ollama, detail: label(h.ollama, h.model ?? 'running') },
      { name: 'Review service', state: h.reviewService, detail: label(h.reviewService, ':4000') },
    ];
  });

  /** Read out by screen readers when the state changes. */
  protected readonly announcement = computed(() => {
    if (this.status.checking()) return '';
    if (this.status.allUp()) return 'All services connected';
    const down = this.rows().filter((r) => r.state === 'down').map((r) => r.name);
    return down.length ? `Offline: ${down.join(', ')}` : '';
  });
}

function label(state: ServiceState, whenUp: string): string {
  switch (state) {
    case 'up':
      return whenUp;
    case 'down':
      return 'offline';
    case 'unknown':
      return 'unknown';
    default:
      return '…';
  }
}