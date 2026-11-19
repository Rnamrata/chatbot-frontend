import { Component, input } from '@angular/core';

/** The Lens robot on its blue tile, with the amber magnifier badge. Same in both themes. */
@Component({
  selector: 'app-lens-logo',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" viewBox="0 0 40 40" role="img" aria-label="Lens logo">
      <rect width="40" height="40" rx="10" fill="#2C5BD6"></rect>
      <path d="M20 7.5v4" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"></path>
      <circle cx="20" cy="7" r="2.2" fill="#FFD27A"></circle>
      <rect x="7.5" y="16" width="3" height="7" rx="1.5" fill="#FFFFFF"></rect>
      <rect x="29.5" y="16" width="3" height="7" rx="1.5" fill="#FFFFFF"></rect>
      <rect x="10" y="11.5" width="20" height="17" rx="6" fill="#FFFFFF"></rect>
      <rect x="13" y="15.5" width="14" height="8" rx="4" fill="#13254F"></rect>
      <circle cx="16.8" cy="19.5" r="1.8" fill="#7DD3FC"></circle>
      <circle cx="23.2" cy="19.5" r="1.8" fill="#7DD3FC"></circle>
      <path d="M17 31.5h6" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"></path>
      <circle cx="30" cy="30" r="6.6" fill="#2C5BD6"></circle>
      <circle cx="29" cy="29" r="3.4" fill="#13254F" stroke="#FFD27A" stroke-width="2"></circle>
      <path d="M31.5 31.5 34.6 34.6" stroke="#FFD27A" stroke-width="2.4" stroke-linecap="round"></path>
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
    }
  `,
})
export class LensLogo {
  readonly size = input(40);
}