#!/usr/bin/env node
/**
 * Full run against the real services: llm-chatbot (Flask), code-review-backend and Ollama.
 * Makes the same calls Lens makes, in the order a person would, and checks each answer
 * has what the screens need. Everything it adds is removed again at the end.
 *
 *   npm run smoke                     # against http://localhost:5001
 *   npm run smoke -- --base http://localhost:5002
 *   npm run smoke -- --keep           # leave the test source and chats in place
 *
 * Needs Node 18+ (built-in fetch). Answers come from Ollama, so a run takes a minute or two.
 */

const args = process.argv.slice(2);
const baseAt = args.indexOf('--base');
const BASE = (baseAt >= 0 && args[baseAt + 1] ? args[baseAt + 1] : 'http://localhost:5001').replace(/\/$/, '');
const KEEP = args.includes('--keep');
const SLOW_MS = 180_000; // Ollama on a laptop, first question loads the model

const CODEWORD = 'TANGERINE-42';
const NOTE = `Lens smoke test note.\nThe Lens smoke test codeword is ${CODEWORD}.\nIt is only used to check that answers come from uploaded files.\n`;
const PYTHON = [
  'import os',
  'PASSWORD = "admin123"',
  '',
  'def find(cur, name):',
  '    cur.execute("SELECT * FROM users WHERE name = \'" + name + "\'")',
  '    return cur.fetchall()',
  '',
].join('\n');

const cleanup = [];
let failed = 0;
let warned = 0;

function line(mark, text, detail = '') {
  console.log(`${mark} ${text}${detail ? `  (${detail})` : ''}`);
}

function check(condition, text, detail) {
  if (!condition) throw new Error(detail ? `${text}: ${detail}` : text);
}

/** A soft check: the model's wording varies, so a miss is reported but doesn't fail the run. */
function expectAnswer(condition, text) {
  if (!condition) {
    warned++;
    line('⚠', text);
  }
}

async function step(name, fn) {
  const started = Date.now();
  try {
    const detail = await fn();
    line('✓', name, [`${((Date.now() - started) / 1000).toFixed(1)} s`, detail].filter(Boolean).join(', '));
    return true;
  } catch (err) {
    failed++;
    line('✗', name, err instanceof Error ? err.message : String(err));
    return false;
  }
}

async function call(method, path, { json, form, timeout = 15_000 } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: json ? { 'Content-Type': 'application/json' } : undefined,
    body: json ? JSON.stringify(json) : form,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body, headers: res.headers };
}

function upload(path, filename, content, extra = {}) {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'text/plain' }), filename);
  for (const [k, v] of Object.entries(extra)) form.append(k, v);
  return call('POST', path, { form, timeout: SLOW_MS });
}

const state = {};

console.log(`Lens smoke test against ${BASE}\n`);

// ---------- Connections ----------
const healthy = await step('Health: chat server, Ollama and review service are up', async () => {
  const { status, body } = await call('GET', '/health');
  check(status === 200, 'GET /health', `HTTP ${status}`);
  check(body.ollama === 'healthy', 'Ollama', String(body.ollama));
  check(body.review_service?.success === true, 'Review service', body.review_service?.error ?? 'not reachable');
  return `model ${body.llm_model}`;
});
if (!healthy) {
  console.log('\nStart Ollama, llm-chatbot and code-review-backend first (see "Running everything" in the README).');
  process.exit(1);
}

// ---------- Sources ----------
await step('Sources: upload a text file', async () => {
  const { status, body } = await upload('/upload/file', 'lens-smoke-note.txt', NOTE);
  check(status === 200 && body.success, 'POST /upload/file', body?.error ?? `HTTP ${status}`);
  check(body.chunks_created > 0, 'chunks_created', String(body.chunks_created));
  state.sourceId = body.source?.id;
  check(state.sourceId, 'the response names the new source');
  cleanup.push(['Sources: remove the test file', () => call('DELETE', `/sources/${state.sourceId}`)]);
  return `${body.chunks_created} section(s)`;
});

await step('Sources: the list shows it as ready', async () => {
  const { body } = await call('GET', '/sources');
  const item = body.sources.find((s) => s.id === state.sourceId);
  check(item, 'GET /sources lists the file');
  check(item.status === 'ready' && item.type === 'file_upload', 'status and type', `${item.status}, ${item.type}`);
});

await step('Sources: a bad link is refused with a reason', async () => {
  const { status, body } = await call('POST', '/upload/web', { json: { url: 'not a link' } });
  check(status >= 400 && body?.error, 'POST /upload/web with a bad link', `HTTP ${status}`);
});

// ---------- Document Q&A ----------
state.chatId = crypto.randomUUID();
await step('Chat: ask about the uploaded file', async () => {
  const { status, body } = await call('POST', '/chat', {
    json: { question: 'What is the Lens smoke test codeword?', session_id: state.chatId },
    timeout: SLOW_MS,
  });
  check(status === 200 && body.success, 'POST /chat', body?.error ?? `HTTP ${status}`);
  check(typeof body.answer === 'string' && body.answer.trim(), 'a non-empty answer');
  check(Array.isArray(body.sources), 'a sources list');
  cleanup.push(['History: delete the test chat', () => call('DELETE', `/chat/clear/${state.chatId}`)]);
  const cited = body.sources.some((s) => s.metadata?.source?.endsWith('lens-smoke-note.txt'));
  expectAnswer(cited, 'The answer did not cite lens-smoke-note.txt (other sources may have ranked higher)');
  expectAnswer(body.answer.includes(CODEWORD), `The answer did not mention ${CODEWORD}`);
  return `${body.sources.length} source(s)`;
});

await step('Chat: a follow-up keeps the conversation', async () => {
  const { body } = await call('POST', '/chat', {
    json: { question: 'Repeat it in lower case.', session_id: state.chatId },
    timeout: SLOW_MS,
  });
  check(body.success, 'POST /chat', body?.error);
  check(body.message_count === 2, 'message_count', String(body.message_count));
});

// ---------- History ----------
await step('History: the chat is listed with a title and preview', async () => {
  const { body } = await call('GET', '/chat/sessions');
  const item = body.sessions.find((s) => s.session_id === state.chatId);
  check(item, 'GET /chat/sessions lists the chat');
  check(item.type === 'docs' && item.title === 'What is the Lens smoke test codeword?', 'type and title', `${item.type}, ${item.title}`);
  check(item.preview === 'Repeat it in lower case.', 'preview is the last question', item.preview);
  check(item.messages === 4, 'messages', String(item.messages));
});

await step('History: pin and unpin', async () => {
  const pin = await call('PATCH', `/chat/session/${state.chatId}`, { json: { pinned: true } });
  check(pin.body?.session?.pinned === true, 'PATCH pinned: true', `HTTP ${pin.status}`);
  const unpin = await call('PATCH', `/chat/session/${state.chatId}`, { json: { pinned: false } });
  check(unpin.body?.session?.pinned === false, 'PATCH pinned: false', `HTTP ${unpin.status}`);
});

await step('History: a reloaded chat keeps its answers and sources', async () => {
  const { body } = await call('GET', `/chat/history/${state.chatId}`);
  check(body.history?.length === 2, 'two question and answer pairs', String(body.history?.length));
  check(Array.isArray(body.history[0].sources), 'each answer has its sources');
});

// ---------- Code review ----------
await step('Review: review a Python file', async () => {
  const { status, body } = await upload('/review', 'lens_smoke.py', PYTHON);
  check(status === 200 && body.success, 'POST /review', body?.error ?? `HTTP ${status}`);
  for (const key of ['review_id', 'session_id', 'filename', 'summary', 'code', 'language']) check(body[key], key);
  check(Array.isArray(body.findings) && Array.isArray(body.warnings), 'findings and warnings lists');
  check(body.findings.length > 0, 'at least one finding (Ruff flags the unused import)');
  for (const f of body.findings) check(f.line !== undefined && f.severity && f.message, 'each finding has line, severity and message');
  state.review = body;
  cleanup.push(['Review: delete the test review', () => call('DELETE', `/chat/clear/${body.session_id}`)]);
  if (body.warnings.length) line('⚠', `Part of the review didn't run: ${body.warnings.map((w) => `${w.source}: ${w.message}`).join('; ')}`);
  return `${body.findings.length} finding(s)${body.warning ? `, warning: ${body.warning}` : ''}`;
});

await step('Review: reloading it gives the same review', async () => {
  check(state.review, 'needs the review from the step before');
  const { status, body } = await call('GET', `/review/${state.review.review_id}`);
  check(status === 200, 'GET /review/:id', `HTTP ${status}`);
  check(body.findings.length === state.review.findings.length, 'same number of findings');
  check(body.session_id === state.review.session_id && body.code === state.review.code, 'same session and code');
});

await step('Review: Ask Lens answers about a line', async () => {
  check(state.review, 'needs the review from the step before');
  const { body } = await call('POST', '/chat', {
    json: { question: 'How do I fix line 2?', session_id: state.review.session_id, review_id: state.review.review_id },
    timeout: SLOW_MS,
  });
  check(body.success, 'POST /chat', body?.error);
  check(body.review_id === state.review.review_id, 'the answer is about this review');
  expectAnswer(/password|environment|secret|hard-?coded/i.test(body.answer), 'The answer about line 2 did not mention the password');
});

await step('Review: a file type the service can’t check is refused, not stored', async () => {
  const { status, body } = await upload('/review', 'main.go', 'package main\n');
  check(status === 400 && body?.error, 'POST /review with a .go file', `HTTP ${status}`);
});

await step('History: the review is listed by file name', async () => {
  check(state.review, 'needs the review from the step before');
  const { body } = await call('GET', '/chat/sessions');
  const item = body.sessions.find((s) => s.session_id === state.review.session_id);
  check(item?.type === 'code_review' && item.title === 'Review: lens_smoke.py', 'type and title', `${item?.type}, ${item?.title}`);
});

// ---------- Clean up ----------
if (KEEP) {
  console.log('\n--keep: leaving the test source, chat and review in place.');
} else {
  console.log('');
  for (const [name, undo] of cleanup.reverse()) {
    await step(name, async () => {
      const { status } = await undo();
      check(status === 200, name, `HTTP ${status}`);
    });
  }
  if (state.review) {
    await step('Review: a deleted review is gone', async () => {
      const { status } = await call('GET', `/review/${state.review.review_id}`);
      check(status === 404, 'GET /review/:id after delete', `HTTP ${status}`);
    });
  }
}

console.log(`\n${failed ? `${failed} step(s) failed` : 'All steps passed'}${warned ? `, ${warned} note(s) about the model's answers` : ''}.`);
process.exit(failed ? 1 : 0);