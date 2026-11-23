import { computed, signal } from '@angular/core';
import { Health, StatusService } from '../core/status.service';

/** Every service up, as GET /health reports it when all is well. */
export const ALL_UP: Health = { chatServer: 'up', ollama: 'up', reviewService: 'up', model: 'llama3.2' };

/**
 * A StatusService that doesn't poll /health, for component tests. Change `health`
 * to put the page in another state; `rechecks` counts "Check again" clicks.
 */
export function fakeStatus(initial: Health = ALL_UP) {
  const health = signal<Health>(initial);
  const fake = {
    health,
    allUp: computed(() => {
      const h = health();
      return h.chatServer === 'up' && h.ollama === 'up' && h.reviewService === 'up';
    }),
    checking: computed(() => health().chatServer === 'checking'),
    ollamaUp: computed(() => health().ollama === 'up'),
    rechecks: 0,
    recheck() {
      fake.rechecks++;
    },
  };
  return { fake, health, provider: { provide: StatusService, useValue: fake } };
}

/** Types into a field the way a person would, so (input) handlers run. */
export function typeInto(field: HTMLInputElement | HTMLTextAreaElement, text: string): void {
  field.value = text;
  field.dispatchEvent(new Event('input'));
}

/** Buttons and links by their visible text or aria-label. */
export function byText<T extends HTMLElement = HTMLElement>(root: HTMLElement, selector: string, text: string): T {
  const match = [...root.querySelectorAll<T>(selector)].find(
    (el) => el.textContent?.trim().includes(text) || el.getAttribute('aria-label') === text,
  );
  if (!match) throw new Error(`No ${selector} with "${text}"`);
  return match;
}

/** jsdom doesn't scroll, and has no scrollTo; the code viewer calls it to bring a finding into view. */
export function allowScrolling(): void {
  Element.prototype.scrollTo ??= () => undefined;
}
/** jsdom may not open <dialog> elements; this opens and closes them the way a browser does. */
export function allowDialogs(): void {
  const proto = HTMLDialogElement.prototype;
  if (!proto.showModal || !String(proto.showModal).includes('[native code]')) {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
    proto.close = function (this: HTMLDialogElement) {
      if (!this.hasAttribute('open')) return;
      this.removeAttribute('open');
      this.dispatchEvent(new Event('close'));
    };
  }
}
