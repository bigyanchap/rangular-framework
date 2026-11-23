import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vm from 'node:vm';
import { Observable, Subject, map } from 'rxjs';
import { compileComponent, CompileResult } from '../packages/compiler/src/compile';
import { renderPreview } from '../packages/compiler/src/preview/renderPreview';
import {
  ActivatedRoute, EventEmitter, FormArray, FormControl, FormGroup, HttpClient,
} from '../packages/runtime/src/index';

/**
 * The RxJS adoption: the runtime's producers (HttpClient, form
 * valueChanges, ActivatedRoute.paramMap, EventEmitter) return real
 * RxJS streams, so user code can pipe them through the operator
 * library, and a component field holding a Subject is one stable
 * instance held in a ref, like a form field. Before the adoption
 * these were a home-grown subscribe-only shape: the same call sites
 * compiled, but .pipe(...) broke at run time, and a Subject field
 * was recreated on every render, orphaning its subscribers.
 */

function compileProject(files: Record<string, string>, entryName = 'app.component.ts'): CompileResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rangular-rx-'));
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content);
  }
  const entry = path.join(dir, entryName);
  return compileComponent({
    tsSource: fs.readFileSync(entry, 'utf8'),
    fileName: entry,
    resolveFile: (rel) => {
      const p = path.join(dir, rel);
      return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : undefined;
    },
    resolveImport: (spec, importer) => {
      const base = path.resolve(path.dirname(importer), spec);
      for (const cand of [base, `${base}.ts`]) {
        if (fs.existsSync(cand)) return { source: fs.readFileSync(cand, 'utf8'), fileName: cand };
      }
      return undefined;
    },
  });
}

function previewOf(result: CompileResult): string {
  return renderPreview(result.component!, result.ast!, {
    children: result.children,
    services: result.services,
    routes: result.routes,
    pipes: result.pipes,
    directives: result.directives,
  });
}

// --- Preview DOM shim (Stage 8 pattern) -------------------------------------------

class ShimText {
  constructor(private text: string) {}
  get textContent(): string { return this.text; }
}

class ShimElement {
  className = '';
  disabled = false;
  value = '';
  type = '';
  children: (ShimElement | ShimText)[] = [];
  private listeners = new Map<string, ((ev: unknown) => void)[]>();
  private attrs = new Map<string, string>();
  constructor(public tagName: string) { this.tagName = tagName.toUpperCase(); }
  appendChild(node: ShimElement | ShimText): unknown { this.children.push(node); return node; }
  addEventListener(type: string, fn: (ev: unknown) => void): void {
    const list = this.listeners.get(type) ?? [];
    list.push(fn);
    this.listeners.set(type, list);
  }
  dispatch(type: string): void {
    for (const fn of this.listeners.get(type) ?? []) fn({});
  }
  click(): void { this.dispatch('click'); }
  setAttribute(name: string, value: string): void { this.attrs.set(name, value); }
  getAttribute(name: string): string | null { return this.attrs.get(name) ?? null; }
  set innerHTML(_value: string) { this.children = []; }
  get innerHTML(): string { return ''; }
  set textContent(value: string) { this.children = [new ShimText(value)]; }
  get textContent(): string { return this.children.map((c) => c.textContent).join(''); }
}

function loadPreview(html: string): ShimElement {
  const app = new ShimElement('div');
  const toggle = new ShimElement('button');
  const documentElement = new ShimElement('html');
  const documentShim = {
    createElement: (tag: string) => new ShimElement(tag),
    createTextNode: (text: string) => new ShimText(text),
    getElementById: (id: string) => (id === 'app' ? app : id === 'theme-toggle' ? toggle : null),
    documentElement,
  };
  const script = html.split('<script>')[1].split('</script>')[0];
  vm.runInNewContext(script, { document: documentShim, console, setTimeout, clearTimeout });
  return app;
}

function findAll(el: ShimElement, pred: (e: ShimElement) => boolean, out: ShimElement[] = []): ShimElement[] {
  if (pred(el)) out.push(el);
  for (const child of el.children) {
    if (child instanceof ShimElement) findAll(child, pred, out);
  }
  return out;
}

function hasClass(el: ShimElement, name: string): boolean {
  return el.className.split(/\s+/).includes(name);
}

const inputsOf = (app: ShimElement) => findAll(app, (e) => e.tagName === 'INPUT');
const buttonOf = (app: ShimElement, text: string) => findAll(app, (e) => hasClass(e, 'btn') && e.textContent.includes(text))[0];

function typeInto(app: ShimElement, index: number, value: string): void {
  const input = inputsOf(app)[index];
  input.value = value;
  input.dispatch('input');
}

// --- Runtime producers -----------------------------------------------------------

test('HttpClient returns a real Observable: pipe and map compose', async () => {
  const http = new HttpClient(async () => ({ json: async () => ({ name: 'Leanne', address: { city: 'Gwenborough' } }) }));
  const stream = http.get('https://example.com/users/1');
  assert.ok(stream instanceof Observable, 'the verb returns an RxJS Observable');
  const city = await new Promise<unknown>((resolve, reject) => {
    stream.pipe(map((d: any) => d.address.city)).subscribe(resolve, reject);
  });
  assert.equal(city, 'Gwenborough');
});

test('HttpClient completes after the value, and the observer object form works', async () => {
  const http = new HttpClient(async () => ({ json: async () => 7 }));
  const events: string[] = [];
  await new Promise<void>((resolve) => {
    http.get('https://example.com/x').subscribe({
      next: (v) => events.push(`next ${v}`),
      complete: () => { events.push('complete'); resolve(); },
    });
  });
  assert.deepEqual(events, ['next 7', 'complete']);
});

test('form valueChanges are real Observables on control, group and array', () => {
  const name = new FormControl('');
  const group = new FormGroup({ name, city: new FormControl('') });
  const rows = new FormArray([new FormControl('Ana')]);

  const lengths: number[] = [];
  name.valueChanges.pipe(map((v) => String(v).length)).subscribe((n) => lengths.push(n));
  name.setValue('Bo');
  name.setValue('Cyx');
  assert.deepEqual(lengths, [2, 3]);

  const groupValues: unknown[] = [];
  group.valueChanges.pipe(map((v) => v.name)).subscribe((n) => groupValues.push(n));
  name.setValue('Dee');
  assert.deepEqual(groupValues, ['Dee'], 'the group stream carries the group value through operators');

  const rowCounts: number[] = [];
  rows.valueChanges.pipe(map((v) => v.length)).subscribe((n) => rowCounts.push(n));
  rows.push(new FormControl('Bo'));
  assert.deepEqual(rowCounts, [2], 'the array stream emits on push');
});

test('paramMap is a real Observable: a late subscriber gets the current params at once', () => {
  const route = new ActivatedRoute({ id: '4' });
  assert.ok(route.paramMap instanceof Observable);
  const seen: unknown[] = [];
  route.paramMap.pipe(map((p) => p.id)).subscribe((id) => seen.push(id));
  assert.deepEqual(seen, ['4'], 'BehaviorSubject semantics: the current value replays on subscribe');
});

test('EventEmitter is a Subject: emit feeds pipes, on and off keep working', () => {
  const em = new EventEmitter<number>();
  assert.ok(em instanceof Subject, 'an EventEmitter is an RxJS Subject, as in Angular');
  const doubled: number[] = [];
  em.pipe(map((v) => v * 2)).subscribe((v) => doubled.push(v));
  const viaOn: number[] = [];
  const off = em.on((v) => viaOn.push(v));
  em.emit(3);
  off();
  em.emit(10);
  assert.deepEqual(doubled, [6, 20]);
  assert.deepEqual(viaOn, [3]);
  assert.equal(em.listenerCount, 1, 'the piped subscription is the one listener left');
});

// --- Compiler: subject fields ------------------------------------------------------

const SUBJECT_COMPONENT = `
import { Component } from '@angular/core';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  template: '<p>Clicks: {{ clicks | async }}</p><button (click)="bump()">Bump</button>',
})
export class AppComponent {
  clicks = new Subject<number>();
  count = 0;

  bump() {
    this.count = this.count + 1;
    this.clicks.next(this.count);
  }
}
`;

test('a Subject field is held in a ref and read through it everywhere', () => {
  const result = compileProject({ 'app.component.ts': SUBJECT_COMPONENT });
  assert.deepEqual(result.diagnostics.filter((d) => d.severity === 'error'), [], JSON.stringify(result.diagnostics));
  assert.ok(result.code!.includes('const clicksRef = useRef(new Subject<number>());'), result.code!);
  assert.ok(!/const clicks = new Subject/.test(result.code!), 'no per-render subject is created');
  assert.ok(result.code!.includes('clicksRef.current.next('), 'methods write through the ref');
  assert.ok(result.code!.includes('(clicksRef.current)'), 'the async pipe subscribes to the ref instance');
  assert.ok(result.code!.includes("import { Subject } from 'rxjs';"), 'the rxjs import is carried');
});

test('a BehaviorSubject field with a seed is ref-held the same way', () => {
  const src = SUBJECT_COMPONENT
    .replace("import { Subject } from 'rxjs';", "import { BehaviorSubject } from 'rxjs';")
    .replace('new Subject<number>()', 'new BehaviorSubject<number>(0)');
  const result = compileProject({ 'app.component.ts': src });
  assert.ok(result.code!.includes('const clicksRef = useRef(new BehaviorSubject<number>(0));'), result.code!);
});

// --- Preview mirror parity ---------------------------------------------------------
// The preview page cannot load rxjs, so PAGE_RUNTIME carries a mini
// mirror. These tests run the generated preview in the DOM shim and
// prove the mirror behaves: subjects feed the async pipe, form
// valueChanges carry operators, and an HttpClient pipe chain runs.

test('preview parity: a Subject field feeds the async pipe and survives re-renders', () => {
  const result = compileProject({ 'app.component.ts': SUBJECT_COMPONENT });
  const app = loadPreview(previewOf(result));
  assert.ok(app.textContent.includes('Clicks:'), app.textContent);
  buttonOf(app, 'Bump').click();
  assert.ok(app.textContent.includes('Clicks: 1'), app.textContent);
  buttonOf(app, 'Bump').click();
  assert.ok(app.textContent.includes('Clicks: 2'), app.textContent);
});

test('preview parity: form valueChanges carry an operator into a subscribed field', () => {
  const src = `
import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { map } from 'rxjs';

@Component({
  selector: 'app-root',
  template: '<form [formGroup]="form"><input formControlName="name"></form><p>{{ echo }}</p>',
})
export class AppComponent {
  form = new FormGroup({ name: new FormControl('') });
  echo = '';

  ngOnInit() {
    this.form.get('name').valueChanges.pipe(map((v) => 'Hi ' + v)).subscribe((s) => { this.echo = s; });
  }
}
`;
  const result = compileProject({ 'app.component.ts': src });
  const app = loadPreview(previewOf(result));
  typeInto(app, 0, 'Ana');
  assert.ok(app.textContent.includes('Hi Ana'), app.textContent);
});

test('the observables example behaves in its preview: scan counts taps, the BehaviorSubject feeds both readers', () => {
  const dir = path.join(__dirname, '..', '..', 'examples', 'observables');
  const ts = fs.readFileSync(path.join(dir, 'observables.component.ts'), 'utf8');
  const html = fs.readFileSync(path.join(dir, 'observables.component.html'), 'utf8');
  const result = compileProject({ 'observables.component.ts': ts, 'observables.component.html': html }, 'observables.component.ts');
  assert.deepEqual(result.diagnostics.filter((d) => d.severity === 'error'), [], JSON.stringify(result.diagnostics));
  const app = loadPreview(previewOf(result));
  assert.ok(app.textContent.includes('Current mood: Calm'), app.textContent);
  assert.ok(app.textContent.includes('Last mood the subscription saw: Calm'), app.textContent);
  buttonOf(app, 'Tap').click();
  buttonOf(app, 'Tap').click();
  assert.ok(app.textContent.includes('Taps counted by the stream: 2'), app.textContent);
  buttonOf(app, 'Bright').click();
  assert.ok(app.textContent.includes('Current mood: Bright'), app.textContent);
  assert.ok(app.textContent.includes('Last mood the subscription saw: Bright'), app.textContent);
});

test('preview parity: an HttpClient pipe chain runs in a method and simply never emits', () => {
  const src = `
import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';

@Component({
  selector: 'app-root',
  template: '<button (click)="load()">Load</button><p>tried: {{ tried }}</p>',
})
export class AppComponent {
  tried = false;
  name = '';
  constructor(private http: HttpClient) {}

  load() {
    this.http.get('https://example.com/users/1').pipe(map((d: any) => d.name)).subscribe((n: string) => { this.name = n; });
    this.tried = true;
  }
}
`;
  const result = compileProject({ 'app.component.ts': src });
  const app = loadPreview(previewOf(result));
  buttonOf(app, 'Load').click();
  assert.ok(app.textContent.includes('tried: true'), app.textContent);
});
