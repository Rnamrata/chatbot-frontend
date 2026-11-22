# Lens

[![CI](https://github.com/Rnamrata/chatbot-frontend/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/Rnamrata/chatbot-frontend/actions/workflows/ci.yml)

Lens is the frontend for two local AI services: ask questions about your own documents (**Document Q&A**) and get an automated review of a code file (**Code Review**). Everything runs on your computer with Ollama, so your files stay with you.

It is an Angular 22 app that talks to:

- [llm-chatbot](https://github.com/Rnamrata/llm-chatbot), a Flask server on `:5001` that does retrieval-augmented answers with Ollama and Chroma, and
- [code-review-backend](https://github.com/Rnamrata/code-review-backend), a Node service on `:4000` that runs ESLint, Ruff, Java rules and an LLM reviewer.

```
Angular (Lens, :4200)
   │  HTTP, JSON + multipart
   ▼
llm-chatbot / Flask (:5001) ── Ollama (llama3.2 + nomic-embed-text)
   │                    └──── Chroma vector store (chunks, reviews, findings)
   ▼
code-review-backend / Node (:4000)
```

The browser only ever calls Flask; Flask forwards reviews to the Node service.

## Status

| Phase | Scope | State |
|---|---|---|
| 1. Foundation | Theme tokens, light and dark themes, shell, routing, mode switch, connection status | Done |
| 2. Document Q&A | Chat, markdown answers, sources and passage panel, welcome and offline states | Done |
| 3. Sources | Add files, YouTube videos and web pages; sources table, remove, old-data cleanup | Done |
| 4. Code review | Start screen, in-progress view, code viewer with folding, findings, severity filter, Ask Lens | Done |
| 5. History | Search, type filter, date groups, pin and delete, clear old chats, sidebar Recent | Done |
| 6. Phone and polish | Phone layouts (drawer, Sources chooser, findings first), keyboard and screen reader fixes, contrast check in light and dark | Done |
| 7. Testing | Component tests, full run against both backends | Planned |


## Prerequisites

- **Node.js 24 (LTS).** Angular 22 supports Node 22, 24 and 26+. Odd-numbered versions such as 25 print `EBADENGINE` warnings. With nvm: `nvm install 24 && nvm alias default 24`.
- **Ollama** with the two models Lens uses:

  ```bash
  ollama pull llama3.2
  ```

  ```bash
  ollama pull nomic-embed-text
  ```

- **llm-chatbot** and **code-review-backend** cloned and installed, following their READMEs. The Sources screen needs an llm-chatbot version with the `/sources` endpoints (llm-chatbot PR #6), and Code Review needs the full review details and refusal handling (llm-chatbot PR #7), and History needs saved sessions (llm-chatbot PR #8). All three are in llm-chatbot's `master`.

## Running everything

Start the services in this order, each in its own terminal.

1. **Ollama.** If the Ollama app is open, it is already running; `ollama serve` then reports `address already in use`, which is fine.

   ```bash
   ollama serve
   ```

2. **llm-chatbot** on `:5001`. Use the project's virtual environment, not a global or Anaconda Python, which won't have its packages.

   ```bash
   cd ../llm-chatbot && source .venv/bin/activate && python main.py
   ```

3. **code-review-backend** on `:4000`. Only Code Review needs it; Document Q&A works without it.

   ```bash
   cd ../code-review-backend && npm run dev
   ```

4. **Lens** on `:4200`.

   ```bash
   npm install
   ```

   ```bash
   npm start
   ```

Open http://localhost:4200. The sidebar footer shows "All connected" when all three services are up, or a Connections card naming the one that is down.

Lens must run on port 4200: llm-chatbot only accepts requests from `http://localhost:4200` (its `CORS_ORIGINS` setting). The Flask address is set in `src/app/core/api.ts`.

## Scripts

| Command | What it does |
|---|---|
| `npm start` | Dev server at http://localhost:4200 with live reload |
| `npm run build` | Production build into `dist/` |
| `npm test` | Unit tests with Vitest, in watch mode (press `q` to quit) |
| `npx ng test --watch=false` | Run the tests once |

## Continuous integration

GitHub Actions ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs on every pull request into `master` and every push to `master`. On Node 24 it runs `npm ci`, `npm run build` and the tests once. Run the same checks locally before opening a pull request:

```bash
npm ci && npm run build && npx ng test --watch=false
```

## Project structure

```
src/app/
  core/       API_BASE_URL, theme, layout, page header, review state, activity (tells History to reload), connection status (polls /health)
  shared/     Icon set, Lens logo, Lens avatar
  layout/     App shell, sidebar, mode switch, theme toggle, connection status card
  features/
    chat/     Document Q&A: page, service, messages, markdown answers, sources, composer, welcome
    sources/  Sources: page, service, file drop, link forms, sources table
    review/   Code review: start screen, review page, code viewer, findings, severity filter, Ask Lens, service
    history/  History: page, service, date groups, search, pin and delete; also feeds the sidebar's Recent
.github/workflows/ci.yml   CI: install, build and test
```

Conventions:

- Standalone components, signals for state (no store library), zoneless change detection and lazy-loaded routes.
- File names follow the Angular 22 scaffold: `sidebar.ts`, not `sidebar.component.ts`.
- Colours, fonts and radii are CSS custom properties in `src/styles.css`, with light and dark values. Use the tokens instead of raw colours.
- Each feature keeps its own service (`ChatService`, `SourcesService`, `ReviewService`, `HistoryService`).

## Design

The UI follows the "Chatbot & Code Review UI" design canvas, Direction A ("Refined navy"): navy sidebar, blue only for the main action and current selection, Space Grotesk headings, Inter body text and JetBrains Mono for code. Every screen has light and dark versions, and under 768 px the sidebar becomes a drawer.

Accessibility:

- A "Skip to content" link appears on the first Tab.
- On phones the drawer works like a menu: focus moves into it, the page behind can't be reached, and Escape or Close menu puts focus back on the menu button.
- After a navigation that leaves focus nowhere (a closed drawer, a deleted row), focus moves to the new page's title.
- Text meets WCAG AA contrast (4.5:1) in both themes, including code on highlighted lines.

## Known limitations

These come from what llm-chatbot returns today, not from the frontend:

- **Citations** are numbered source chips under each answer. The design puts them inside the text, but answers carry no citation markers.
- **Source passages** show the first 200 characters of the matching chunk without a highlight, because Flask sends no match position or page number.
- **Suggested questions** are three fixed starters on an empty chat. Lens shows the server's suggestions once `/chat` returns `suggested_questions`.
- **Chats are saved by llm-chatbot** in its `data/sessions.json`, so History and open chats survive a restart, with their sources. Chats from before llm-chatbot PR #8 were only in memory and are gone.
- **Document chats can cite code reviews,** because document mode searches the whole vector store, including stored code-review chunks.
- **Old vector data:** chunks stored by an earlier llm-chatbot version have no type and are effectively unsearchable. They show on the Sources screen as "Older data without details · Outdated". If answers only cite code-review files or "Unknown source", remove that row and add your documents again.
- **Adding the same file or link twice** stores it twice. Removing a source removes it from search; the uploaded file stays in llm-chatbot's `uploads/` folder.
- **Reviews in progress live in the tab.** "Stop waiting" only stops the screen; llm-chatbot still finishes and stores the review. If you leave the page before it finishes, open it from History or Recent once it's done.
- **"Run the review again"** only works in the tab where the file was chosen, because the browser keeps the file in memory.
- **Reviews stored before llm-chatbot PR #7** have no category, source or suggestion on their findings, so those details don't show.
