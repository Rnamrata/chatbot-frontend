import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/icon';
import { LensAvatar } from '../../shared/lens-avatar';

// cSpell:ignore ollama
export type Problem = 'server' | 'ollama' | null;

/** The empty /chat screen. The two start cards show until the first source is added. */
@Component({
  selector: 'app-welcome',
  imports: [Icon, LensAvatar, RouterLink],
  template: `
    <div class="hero">
      <app-lens-avatar [size]="72" />
      <h2>Hi, I'm Lens</h2>
      <p>
        I answer questions using your own documents and review your code. Everything runs on your computer, so your
        files stay with you.
      </p>
    </div>

    @if (problem()) {
      <div class="alert" role="alert">
        <app-icon name="alert" [size]="20" class="alert-icon" />
        <div class="alert-text">
          @if (problem() === 'ollama') {
            <strong>Ollama isn't running</strong>
            <span>
              Lens needs Ollama to read your documents and write answers. Open a terminal and run
              <code>ollama serve</code>.
            </span>
            <span>
              First time? Also install the two models: <code>ollama pull llama3.2</code> and
              <code>ollama pull nomic-embed-text</code>.
            </span>
          } @else {
            <strong>The chat server isn't running</strong>
            <span>
              Lens can't reach llm-chatbot on :5001. In the llm-chatbot folder, run <code>python main.py</code>.
            </span>
          }
        </div>
        <button type="button" class="again" (click)="checkAgain.emit()">Check again</button>
      </div>
    }

    @if (firstRun()) {
      <div class="cards">
        <a class="card link" routerLink="/sources">
          <span class="card-icon" aria-hidden="true"><app-icon name="upload" [size]="20" /></span>
          <strong>1. Add a source</strong>
          <span class="card-text">A PDF, text file, YouTube video or web page.</span>
        </a>
        <div class="card">
          <span class="card-icon" aria-hidden="true"><app-icon name="chat" [size]="20" /></span>
          <strong>2. Ask about it</strong>
          <span class="card-text">Every answer shows which source it came from.</span>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 22px;
      padding-top: 8px;
    }
    .hero {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      text-align: center;
    }
    h2 {
      font-size: 28px;
      line-height: 36px;
      font-weight: 600;
    }
    .hero p {
      max-width: 520px;
      margin: 0;
      color: var(--ink-2);
    }
    .alert {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      border-radius: var(--radius);
      background: var(--danger-bg);
      box-shadow: inset 4px 0 0 var(--danger-bar);
    }
    .alert-icon {
      margin-top: 1px;
      color: var(--danger);
    }
    .alert-text {
      flex: 1 1 380px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      color: var(--ink-2);
    }
    .alert-text strong {
      color: var(--ink);
    }
    code {
      padding: 1px 6px;
      border-radius: 6px;
      background: var(--code-chip);
      font: 13px var(--font-mono);
    }
    .again {
      height: 40px;
      padding: 0 14px;
      border: 1px solid var(--border-strong);
      border-radius: 10px;
      background: var(--surface);
      color: var(--ink);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
    }
    .card {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 16px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: var(--surface);
      color: var(--ink);
      text-decoration: none;
    }
    .card.link:hover {
      border-color: var(--primary);
    }
    .card-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--primary-soft);
      color: var(--primary-text);
    }
    .card-text {
      font-size: 14px;
      color: var(--ink-2);
    }
  `,
})
export class Welcome {
  readonly problem = input<Problem>(null);
  readonly firstRun = input(false);
  readonly checkAgain = output<void>();
}