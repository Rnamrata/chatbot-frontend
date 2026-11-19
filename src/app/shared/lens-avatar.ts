import { Component, input } from '@angular/core';

/**
 * The robot in the theme's blue on a soft circle, shown next to every answer.
 * While Lens is working (`thinking`), the magnifier badge pulses.
 */
@Component({
  selector: 'app-lens-avatar',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" role="img" aria-label="Lens assistant">
      <circle class="bg" cx="20" cy="20" r="20"></circle>
      <path class="line" d="M20 7.5v4" stroke-width="2" stroke-linecap="round"></path>
      <circle class="fill" cx="20" cy="7" r="2.2"></circle>
      <rect class="fill" x="7.5" y="16" width="3" height="7" rx="1.5"></rect>
      <rect class="fill" x="29.5" y="16" width="3" height="7" rx="1.5"></rect>
      <rect class="fill" x="10" y="11.5" width="20" height="17" rx="6"></rect>
      <rect x="13" y="15.5" width="14" height="8" rx="4" fill="#0F1B33"></rect>
      <circle cx="16.8" cy="19.5" r="1.8" fill="#7DD3FC"></circle>
      <circle cx="23.2" cy="19.5" r="1.8" fill="#7DD3FC"></circle>
      <path class="line" d="M17 31.5h6" stroke-width="2" stroke-linecap="round"></path>
      <circle class="bg" cx="30" cy="30" r="6.6"></circle>
      <g class="badge" [class.pulse]="thinking()">
        <circle cx="29" cy="29" r="3.4" fill="#0F1B33" stroke="#F2A93B" stroke-width="2"></circle>
        <path d="M31.5 31.5 34.6 34.6" stroke="#F2A93B" stroke-width="2.4" stroke-linecap="round"></path>
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
    .bg {
      fill: var(--avatar-bg);
    }
    .fill {
      fill: var(--primary);
    }
    .line {
      stroke: var(--primary);
    }
    .pulse {
      animation: lens-glow 1.2s ease-in-out infinite;
    }
    @keyframes lens-glow {
      50% {
        opacity: 0.45;
      }
    }
  `,
})
export class LensAvatar {
  readonly size = input(40);
  readonly thinking = input(false);
}