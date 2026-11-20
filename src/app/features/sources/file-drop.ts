import { Component, input, output, signal } from '@angular/core';
import { Icon } from '../../shared/icon';
import { FILE_TYPES, MAX_FILE_BYTES } from './sources.models';

/** "Upload a file" card: click to choose or drop a PDF, TXT or Markdown file. */
@Component({
  selector: 'app-file-drop',
  imports: [Icon],
  host: { role: 'region', 'aria-labelledby': 'file-drop-heading' },
  template: `
    <h2 id="file-drop-heading">Upload a file</h2>
    <input
      #picker
      id="file-in"
      type="file"
      class="visually-hidden"
      [accept]="accept"
      [disabled]="busy()"
      (change)="pick(picker.files); picker.value = ''"
    />
    <label
      for="file-in"
      class="drop"
      [class.over]="dragging()"
      [class.busy]="busy()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragging.set(false)"
      (drop)="onDrop($event)"
    >
      @if (busy()) {
        <app-icon name="spinner" [size]="28" class="spin" />
        <span><strong>Reading the file…</strong></span>
        <span class="hint">Lens is splitting it into sections it can search.</span>
      } @else {
        <app-icon name="upload" [size]="28" class="up" />
        <span><strong>Choose a file</strong> or drop it here</span>
        <span class="hint">PDF, TXT or Markdown, up to 20 MB</span>
      }
    </label>
    @if (problem(); as message) {
      <p class="error" role="alert">{{ message }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
    }
    h2 {
      font-family: var(--font-body);
      font-size: 16px;
      font-weight: 600;
    }
    .drop {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 150px;
      padding: 16px;
      border: 2px dashed var(--drop-border);
      border-radius: var(--radius);
      background: var(--primary-soft);
      color: var(--ink-2);
      text-align: center;
      cursor: pointer;
    }
    .drop strong {
      color: var(--primary-text);
    }
    .drop.over,
    .drop:hover {
      border-color: var(--primary);
    }
    .drop.busy {
      cursor: progress;
    }
    input:focus-visible + .drop {
      outline: 3px solid #3b82f6;
      outline-offset: 2px;
    }
    .up {
      color: var(--primary-text);
    }
    .spin {
      color: var(--primary-text);
      animation: spin 1s linear infinite;
    }
    .hint {
      font-size: 13px;
      color: var(--muted);
    }
    .error {
      margin: 0;
      font-size: 14px;
      color: var(--danger);
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class FileDrop {
  readonly busy = input(false);
  /** Error from the server for the last upload. */
  readonly error = input<string | null>(null);
  readonly picked = output<File>();

  protected readonly accept = FILE_TYPES.join(',');
  protected readonly dragging = signal(false);
  private readonly invalid = signal<string | null>(null);

  protected problem(): string | null {
    return this.invalid() ?? this.error();
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    if (!this.busy()) this.dragging.set(true);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    if (!this.busy()) this.pick(event.dataTransfer?.files ?? null);
  }

  protected pick(files: FileList | null): void {
    const file = files?.[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!FILE_TYPES.some((ext) => name.endsWith(ext))) {
      this.invalid.set('Lens can read PDF, TXT and Markdown files.');
    } else if (file.size > MAX_FILE_BYTES) {
      this.invalid.set('That file is larger than 20 MB.');
    } else if (file.size === 0) {
      this.invalid.set('That file is empty.');
    } else {
      this.invalid.set(null);
      this.picked.emit(file);
    }
  }
}