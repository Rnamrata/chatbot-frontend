import { Component, computed, input } from '@angular/core';

/** Stroke icons used across Lens (24×24, drawn with currentColor). */
const ICONS = {
  plus: ['M12 5v14M5 12h14'],
  history: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z', 'M12 7v5l3 2'],
  folder: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  panel: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M9 4v16'],
  menu: ['M4 6h16M4 12h16M4 18h16'],
  doc: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', 'M14 2v6h6M8 13h8M8 17h5'],
  code: ['m16 18 6-6-6-6M8 6l-6 6 6 6'],
  chat: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
  pin: ['M12 17v5M9 3h6l-1 6 4 4H6l4-4z'],
  sun: [
    'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
    'M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  ],
  moon: ['M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z'],
  chevronDown: ['m6 9 6 6 6-6'],
  close: ['M6 6l12 12M18 6 6 18'],
  send: ['M22 2 11 13M22 2l-7 20-4-9-9-4z'],
  attach: ['m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5'],
  copy: ['M11 9h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z', 'M5 15V5a2 2 0 0 1 2-2h10'],
  check: ['M20 6 9 17l-5-5'],
  sparkle: ['M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z'],
  upload: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12'],
  alert: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'M12 8v5M12 16.5v.5'],
  checkCircle: ['M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z', 'm8 12 3 3 5-6'],
  spinner: ['M21 12a9 9 0 1 1-6.2-8.6'],
  trash: ['M3 6h18', 'M8 6V4h8v2', 'M19 6l-1 14H6L5 6', 'M10 11v6M14 11v6'],
  warning: ['M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9v4M12 17v.5'],
  idea: ['M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z'],
  arrowRight: ['M5 12h14M13 6l6 6-6 6'],
  unfold: ['m7 15 5 5 5-5M7 9l5-5 5 5'],
} satisfies Record<string, string[]>;

export type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  template: `
    <svg
      [attr.width]="size()"
      [attr.height]="size()"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      @for (d of paths(); track $index) {
        <path [attr.d]="d"></path>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
})
export class Icon {
  readonly name = input.required<IconName>();
  readonly size = input(18);
  protected readonly paths = computed(() => ICONS[this.name()]);
}