import { Component, ElementRef, computed, effect, input, output, signal, untracked, viewChild } from '@angular/core';
import { Icon } from '../../shared/icon';
import { addedLabel, badgeLabel, checkFile } from '../sources/source-checks';
import { FILE_TYPES, LibrarySource } from '../sources/sources.models';
import { FileUpload } from './chat.models';

/** "Add sources to this chat": upload a file, or choose from the library. A native modal dialog. */
@Component({
  selector: 'app-add-sources-dialog',
  imports: [Icon],
  template: `
    <dialog #dialog aria-labelledby="add-title" (close)="closed.emit()" (click)="onBackdrop($event)">
      <div class="panel">
        <div class="head">
          <h2 id="add-title">Add sources to this chat</h2>
          <button type="button" class="x" aria-label="Close" (click)="dialog.close()">
            <app-icon name="close" />
          </button>
        </div>

        <div class="upload">
          <button type="button" class="pick" (click)="file.click()">
            <app-icon name="upload" [size]="18" />
            Upload from device
          </button>
          <span class="note">PDF, TXT or Markdown, up to 20 MB. You can also drop files on the chat.</span>
          <input #file type="file" class="visually-hidden" [accept]="accept" multiple (change)="onFiles(file)" tabindex="-1" />
          @if (fileProblem(); as problem) {
            <p class="problem" role="alert">{{ problem }}</p>
          }
        </div>

        <div class="search">
          <app-icon name="search" [size]="16" />
          <label for="add-search" class="visually-hidden">Search your sources</label>
          <input
            #search
            id="add-search"
            type="search"
            placeholder="Search your sources"
            autocomplete="off"
            [value]="query()"
            (input)="query.set(search.value)"
          />
        </div>

        <span class="label">Your sources</span>
        <div class="list">
          @for (u of adding(); track u.id) {
            <div class="row busy">
              <input type="checkbox" checked disabled [attr.aria-label]="u.name + ' is being added to this chat'" />
              <span class="badge" aria-hidden="true">{{ fileBadge(u.name) }}</span>
              <span class="text">
                <span class="name">{{ u.name }}</span>
                <span class="detail">Reading the file… it joins this chat when it's ready</span>
                <span class="bar" aria-hidden="true"><span></span></span>
              </span>
              <span class="status">Adding…</span>
            </div>
          }
          @for (s of rows(); track s.id) {
            <label class="row" [for]="'add-' + s.id">
              <input type="checkbox" [id]="'add-' + s.id" [checked]="isPicked(s.id)" (change)="toggle(s.id)" />
              <span class="badge" [class]="'badge ' + s.badge" aria-hidden="true">{{ s.badge }}</span>
              <span class="text">
                <span class="name" [title]="s.name">{{ s.name }}</span>
                <span class="detail">{{ s.detail }}</span>
              </span>
              <span class="status" [class.busy]="s.busy">{{ s.busy ? 'Adding…' : 'Ready' }}</span>
            </label>
          } @empty {
            @if (!adding().length) {
              <span class="none">{{ query() ? 'No sources match your search.' : 'No sources yet. Upload a file, or paste a link in the message.' }}</span>
            }
          }
          @if (hasLegacy()) {
            <span class="none">Older data stored without names can't be added to a chat.</span>
          }
        </div>

        <div class="foot">
          <span class="count">{{ selectedLabel() }}</span>
          <button type="button" class="plain" (click)="dialog.close()">Cancel</button>
          <button type="button" class="primary" (click)="useThese()">{{ addLabel() }}</button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    dialog {
      width: min(560px, calc(100vw - 32px));
      max-height: min(720px, calc(100dvh - 32px));
      padding: 0;
      border: 1px solid var(--border);
      border-radius: 18px;
      background: var(--surface);
      color: var(--ink);
      box-shadow: var(--shadow-lg, 0 20px 60px rgb(0 0 0 / 0.25));
    }
    dialog::backdrop {
      background: rgb(10 16 30 / 0.45);
    }
    .panel {
      display: flex;
      flex-direction: column;
      gap: 14px;
      max-height: inherit;
      padding: 20px;
    }
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    h2 {
      margin: 0;
      font-size: 18px;
    }
    .x {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--ink-2);
      cursor: pointer;
    }
    .x:hover {
      background: var(--surface-2);
    }
    .upload {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px 12px;
    }
    .pick {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      height: 44px;
      padding: 0 16px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .pick:hover {
      border-color: var(--primary);
    }
    .note,
    .label,
    .count {
      font-size: 13px;
      color: var(--muted);
    }
    .problem {
      flex-basis: 100%;
      margin: 0;
      color: var(--danger);
      font-size: 13px;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 12px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      color: var(--muted);
    }
    .search:focus-within {
      border-color: var(--primary);
    }
    .search input {
      flex: 1;
      min-width: 0;
      height: 40px;
      border: none;
      outline: none;
      background: transparent;
      color: var(--ink);
      font: inherit;
    }
    .label {
      font-weight: 600;
      color: var(--ink-2);
    }
    .list {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-height: 120px;
      overflow-y: auto;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 56px;
      padding: 8px 10px;
      border-radius: 10px;
      cursor: pointer;
    }
    .row:hover {
      background: var(--surface-2);
    }
    .row.busy {
      cursor: default;
    }
    .row input {
      flex: none;
      width: 18px;
      height: 18px;
      margin: 0;
      accent-color: var(--primary);
    }
    .badge {
      flex: 0 0 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 36px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      background: var(--primary-soft);
      color: var(--primary-text);
    }
    .badge.WEB {
      background: var(--surface-2);
      color: var(--ink-2);
    }
    .badge.YT {
      background: var(--code-chip);
      color: var(--ink);
    }
    .text {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .name,
    .detail {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .name {
      font-size: 14px;
      font-weight: 500;
    }
    .detail {
      font-size: 12px;
      color: var(--muted);
    }
    .bar {
      height: 4px;
      overflow: hidden;
      border-radius: 2px;
      background: var(--surface-2);
    }
    .bar span {
      display: block;
      width: 40%;
      height: 100%;
      border-radius: 2px;
      background: var(--primary);
      animation: slide 1.2s ease-in-out infinite;
    }
    @keyframes slide {
      from {
        transform: translateX(-100%);
      }
      to {
        transform: translateX(250%);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar span {
        animation: none;
        width: 100%;
        opacity: 0.4;
      }
    }
    .status {
      flex: none;
      font-size: 12px;
      color: var(--ready);
    }
    .status.busy,
    .row.busy .status {
      color: var(--busy);
    }
    .none {
      padding: 12px 10px;
      font-size: 13px;
      color: var(--muted);
    }
    .foot {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
      padding-top: 12px;
      border-top: 1px solid var(--border);
    }
    .count {
      flex: 1 1 200px;
    }
    .plain,
    .primary {
      height: 44px;
      padding: 0 16px;
      border-radius: 10px;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    .plain {
      border: 1px solid var(--border-strong);
      background: var(--surface);
      color: var(--ink);
    }
    .primary {
      border: none;
      background: var(--primary);
      color: var(--on-primary);
    }
  `,
})
export class AddSourcesDialog {
  readonly open = input(false);
  readonly library = input.required<LibrarySource[]>();
  /** The chat's sources when the dialog opens; the checkboxes start from these. */
  readonly chosen = input<string[]>([]);
  readonly uploads = input<FileUpload[]>([]);
  readonly closed = output<void>();
  /** The sources the chat should use ([] = every source). */
  readonly apply = output<string[]>();
  readonly upload = output<File>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly accept = FILE_TYPES.join(',');
  protected readonly query = signal('');
  private readonly picked = signal<string[]>([]);
  protected readonly fileProblem = signal<string | null>(null);

  protected readonly rows = computed(() => {
    const q = this.query().trim().toLowerCase();
    return this.library()
      .filter((s) => s.status !== 'outdated')
      .filter((s) => !q || `${s.name} ${s.source ?? ''}`.toLowerCase().includes(q))
      .map((s) => ({
        id: s.id,
        name: s.name,
        badge: badgeLabel(s.type, s.source, s.name),
        busy: s.status === 'processing',
        detail:
          s.status === 'processing'
            ? (s.source ?? '')
            : [s.type === 'web' || s.type === 'youtube' ? host(s.source) : null, sections(s.chunks), addedLabel(s.added_at).toLowerCase()]
                .filter((x) => x && x !== '—')
                .join(' · '),
      }));
  });
  protected readonly adding = computed(() => this.uploads().filter((u) => u.status === 'adding'));
  protected readonly hasLegacy = computed(() => this.library().some((s) => s.status === 'outdated'));
  private readonly count = computed(() => this.picked().filter((id) => this.library().some((s) => s.id === id)).length);
  protected readonly selectedLabel = computed(() => {
    const n = this.count();
    return n === 0 ? 'Nothing selected: the chat uses all sources' : `${n} selected`;
  });
  protected readonly addLabel = computed(() => {
    const n = this.count();
    return n === 0 ? 'Use all sources' : n === 1 ? 'Use 1 source' : `Use ${n} sources`;
  });

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open() && !el.open) {
        untracked(() => {
          this.picked.set([...this.chosen()]);
          this.query.set('');
          this.fileProblem.set(null);
        });
        el.showModal();
      } else if (!this.open() && el.open) {
        el.close();
      }
    });
  }

  protected isPicked(id: string): boolean {
    return this.picked().includes(id);
  }

  protected toggle(id: string): void {
    this.picked.update((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  }

  protected onFiles(input: HTMLInputElement): void {
    const files = [...(input.files ?? [])];
    input.value = ''; // the same file can be picked again
    const problems = files.map(checkFile).filter((p): p is string => !!p);
    this.fileProblem.set(problems.join(' ') || null);
    for (const f of files) if (!checkFile(f)) this.upload.emit(f);
  }

  protected useThese(): void {
    this.apply.emit(this.picked().filter((id) => this.library().some((s) => s.id === id)));
    this.dialog().nativeElement.close();
  }

  /** A click on the dimmed area around the panel closes the dialog. */
  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) this.dialog().nativeElement.close();
  }

  protected fileBadge(name: string): string {
    const n = name.toLowerCase();
    return n.endsWith('.md') ? 'MD' : n.endsWith('.txt') ? 'TXT' : 'PDF';
  }
}

function sections(n: number): string {
  return `${n.toLocaleString('en-US')} ${n === 1 ? 'section' : 'sections'}`;
}

function host(url: string | null): string | null {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : null;
  } catch {
    return null;
  }
}
