import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { typeInto } from '../../testing/test-helpers';
import { Composer } from './composer';

describe('Composer', () => {
  async function render(inputs: { disabled?: boolean; busy?: boolean } = {}) {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(Composer);
    for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
    const sent: string[] = [];
    fixture.componentInstance.send.subscribe((q) => sent.push(q));
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, sent, box: el.querySelector('textarea')!, sendButton: el.querySelector<HTMLButtonElement>('.send')! };
  }

  function press(box: HTMLTextAreaElement, shiftKey = false): KeyboardEvent {
    const event = new KeyboardEvent('keydown', { key: 'Enter', shiftKey, cancelable: true });
    box.dispatchEvent(event);
    return event;
  }

  it('sends the trimmed question on Enter and empties the box', async () => {
    const { fixture, sent, box } = await render();
    typeInto(box, '  What is RAG?  ');
    await fixture.whenStable();

    const enter = press(box);
    await fixture.whenStable();

    expect(sent).toEqual(['What is RAG?']);
    expect(enter.defaultPrevented).toBe(true);
    expect(box.value).toBe('');
  });

  it('empties the box even when Enter comes before the typed text was drawn', async () => {
    const { fixture, sent, box } = await render();
    typeInto(box, 'Quick question'); // no wait: Enter follows at once, as with fast typing
    press(box);
    await fixture.whenStable();

    expect(sent).toEqual(['Quick question']);
    expect(box.value).toBe('');
  });

  it('leaves Shift + Enter to add a new line', async () => {
    const { fixture, sent, box } = await render();
    typeInto(box, 'line one');
    await fixture.whenStable();

    const shiftEnter = press(box, true);

    expect(sent).toEqual([]);
    expect(shiftEnter.defaultPrevented).toBe(false);
  });

  it('keeps Send off while empty, busy or disabled', async () => {
    const empty = await render();
    expect(empty.sendButton.disabled).toBe(true);
    TestBed.resetTestingModule();

    const busy = await render({ busy: true });
    typeInto(busy.box, 'Next question');
    await busy.fixture.whenStable();
    press(busy.box);
    expect(busy.sendButton.disabled).toBe(true);
    expect(busy.sent).toEqual([]); // typing is fine while an answer is on its way, sending waits
    TestBed.resetTestingModule();

    const disabled = await render({ disabled: true });
    expect(disabled.box.disabled).toBe(true);
  });
});