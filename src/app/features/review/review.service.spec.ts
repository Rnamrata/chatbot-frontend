import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { buildRows, tokenize } from './code-view';
import { Review } from './review.models';
import { ReviewService } from './review.service';

const API = 'http://localhost:5001';

const review: Review = {
  review_id: 'r1',
  session_id: 's1',
  filename: 'UserDao.java',
  language: 'java',
  code: 'class A {}\n',
  findings: [{ file: 'UserDao.java', line: 1, severity: 'high', message: 'SQL injection', source: 'llm' }],
  warnings: [],
  summary: '1 issue found: 1 high.',
};

function file(name: string, content = 'print(1)\n'): File {
  return new File([content], name);
}

describe('ReviewService', () => {
  let reviews: ReviewService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    reviews = TestBed.inject(ReviewService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('checks files before uploading', () => {
    expect(reviews.check(file('main.go'))?.kind).toBe('unsupported');
    expect(reviews.check(file('big.py', 'x'.repeat(1024 * 1024 + 1)))?.kind).toBe('too-large');
    expect(reviews.check(file('empty.py', ''))?.kind).toBe('empty');
    expect(reviews.check(file('app.py'))).toBeNull();
  });

  it('runs a review and keeps the result for its review id', async () => {
    const jobId = await reviews.start(file('UserDao.java', 'class A {}\n'));
    expect(reviews.job(jobId)!().status).toBe('running');
    expect(reviews.job(jobId)!().code).toBe('class A {}\n');

    const req = http.expectOne(`${API}/review`);
    expect(req.request.body).toBeInstanceOf(FormData);
    req.flush({ success: true, ...review });

    expect(reviews.job(jobId)!().status).toBe('done');
    expect(reviews.load('r1')()).toEqual({ state: 'ready', review }); // no second request
  });

  it('keeps the result after Stop waiting', async () => {
    const jobId = await reviews.start(file('UserDao.java'));
    reviews.stop(jobId);
    http.expectOne(`${API}/review`).flush({ success: true, ...review });

    expect(reviews.job(jobId)!()).toMatchObject({ stopped: true, status: 'done' });
  });

  it('turns a 429 into a rate-limit error with the wait from the server', async () => {
    const jobId = await reviews.start(file('app.py'));
    http
      .expectOne(`${API}/review`)
      .flush({ success: false, error: 'Too many', retry_after: 270 }, { status: 429, statusText: 'Too Many Requests' });

    const error = reviews.job(jobId)!().error!;
    expect(error.kind).toBe('rate-limited');
    expect(error.retryAt! - Date.now()).toBeGreaterThan(268_000);
  });

  it('passes the server’s reason on for a refused file', async () => {
    const jobId = await reviews.start(file('app.py'));
    http
      .expectOne(`${API}/review`)
      .flush({ success: false, error: 'Unsupported file extension' }, { status: 400, statusText: 'Bad Request' });

    expect(reviews.job(jobId)!().error).toMatchObject({ kind: 'refused', body: 'Unsupported file extension' });
  });

  it('loads a stored review once, and reports a missing one', () => {
    const first = reviews.load('r1');
    http.expectOne(`${API}/review/r1`).flush({ success: true, ...review });
    expect(first()).toEqual({ state: 'ready', review });
    reviews.load('r1');
    http.expectNone(`${API}/review/r1`);

    const gone = reviews.load('gone');
    http.expectOne(`${API}/review/gone`).flush({ success: false }, { status: 404, statusText: 'Not Found' });
    expect(gone()).toEqual({ state: 'missing' });
  });
});

describe('code view', () => {
  it('colours keywords, strings, numbers and comments', () => {
    expect(tokenize('return x + 1  # done', 'python')).toEqual([
      { kind: 'kw', text: 'return' },
      { kind: 'plain', text: ' x + ' },
      { kind: 'num', text: '1' },
      { kind: 'plain', text: '  ' },
      { kind: 'com', text: '# done' },
    ]);
    expect(tokenize('String s = "a";', 'java')[0]).toEqual({ kind: 'type', text: 'String' });
  });

  it('folds long stretches far from any finding', () => {
    const rows = buildRows(20, [10], new Set());
    expect(rows[0]).toEqual({ kind: 'fold', from: 1, to: 7 });
    expect(rows.filter((r) => r.kind === 'line').map((r) => (r.kind === 'line' ? r.n : 0))).toEqual([8, 9, 10, 11, 12]);
    expect(rows.at(-1)).toEqual({ kind: 'fold', from: 13, to: 20 });
  });

  it('shows everything when there are no findings or a fold was opened', () => {
    expect(buildRows(5, [], new Set())).toHaveLength(5);
    expect(buildRows(20, [10], new Set(['1-7', '13-20']))).toHaveLength(20);
  });
});