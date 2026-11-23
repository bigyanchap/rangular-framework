import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signal,
  computed,
  effect,
  untracked,
  flushEffects,
  beginEffectScope,
  endEffectScope,
  SignalRenderTracker,
} from '../packages/runtime/src/index';

// Signals adoption: the runtime core mirrors @angular/core semantics.
// A signal is read by calling it; computed values are lazy, cached and
// glitch-free; effects run at creation and re-run through the queue.

test('signal: read by calling, set and update write', () => {
  const s = signal(0);
  assert.equal(s(), 0);
  s.set(2);
  assert.equal(s(), 2);
  s.update((v) => v + 1);
  assert.equal(s(), 3);
});

test('signal: an equal write (Object.is) notifies nobody', () => {
  const s = signal(1);
  let runs = 0;
  const ref = effect(() => { runs++; s(); });
  assert.equal(runs, 1);
  s.set(1);
  flushEffects();
  assert.equal(runs, 1);
  ref.destroy();
});

test('signal: asReadonly view reads and tracks but has no set', () => {
  const s = signal(5);
  const ro = s.asReadonly();
  assert.equal(ro(), 5);
  assert.equal((ro as unknown as { set?: unknown }).set, undefined);
  s.set(6);
  assert.equal(ro(), 6);
});

test('computed: lazy, then cached while inputs are unchanged', () => {
  const s = signal(2);
  let runs = 0;
  const d = computed(() => { runs++; return s() * 2; });
  assert.equal(runs, 0);
  assert.equal(d(), 4);
  assert.equal(d(), 4);
  assert.equal(runs, 1);
  s.set(3);
  assert.equal(d(), 6);
  assert.equal(runs, 2);
});

test('computed: a diamond never observes a half-updated mix', () => {
  const a = signal(1);
  const b = computed(() => a() + 1);
  const c = computed(() => a() * 10);
  let runs = 0;
  const e = computed(() => { runs++; return b() + c(); });
  assert.equal(e(), 12);
  a.set(2);
  assert.equal(e(), 23);
  assert.equal(runs, 2);
});

test('computed: an unchanged output stops the chain below it', () => {
  const a = signal(2);
  const parity = computed(() => a() % 2);
  let runs = 0;
  const down = computed(() => { runs++; return parity() * 100; });
  assert.equal(down(), 0);
  a.set(4);
  assert.equal(down(), 0);
  assert.equal(runs, 1);
});

test('computed: dependencies are whatever the last run read', () => {
  const flag = signal(true);
  const x = signal(1);
  const y = signal(10);
  const pick = computed(() => (flag() ? x() : y()));
  assert.equal(pick(), 1);
  y.set(20);
  assert.equal(pick(), 1);
  flag.set(false);
  assert.equal(pick(), 20);
  x.set(5);
  assert.equal(pick(), 20);
});

test('computed: writing a signal inside computed throws', () => {
  const w = signal(0);
  const bad = computed(() => { w.set(1); return 0; });
  assert.throws(() => bad(), /not allowed inside a computed/);
});

test('effect: runs at creation, re-runs on change after flush, destroy stops it', () => {
  const src = signal(0);
  const seen: number[] = [];
  const ref = effect(() => { seen.push(src()); });
  assert.deepEqual(seen, [0]);
  src.set(1);
  assert.deepEqual(seen, [0]);
  flushEffects();
  assert.deepEqual(seen, [0, 1]);
  ref.destroy();
  src.set(2);
  flushEffects();
  assert.deepEqual(seen, [0, 1]);
});

test('effect: cleanup runs before each re-run and at destroy', () => {
  const src = signal(0);
  const order: string[] = [];
  const ref = effect((onCleanup) => {
    const v = src();
    order.push(`run${v}`);
    onCleanup(() => { order.push(`clean${v}`); });
  });
  src.set(1);
  flushEffects();
  ref.destroy();
  assert.deepEqual(order, ['run0', 'clean0', 'run1', 'clean1']);
});

test('untracked: reads inside it do not subscribe the reader', () => {
  const t1 = signal(0);
  const t2 = signal(0);
  let runs = 0;
  const ref = effect(() => { runs++; t1(); untracked(() => { t2(); }); });
  t2.set(5);
  flushEffects();
  assert.equal(runs, 1);
  t1.set(1);
  flushEffects();
  assert.equal(runs, 2);
  ref.destroy();
});

test('effect scope: end cleanup destroys every effect created inside', () => {
  beginEffectScope();
  const src = signal(0);
  let runs = 0;
  effect(() => { runs++; src(); });
  const end = endEffectScope();
  end();
  src.set(9);
  flushEffects();
  assert.equal(runs, 1);
});

test('render tracker: writes after end notify once; re-render re-tracks', () => {
  let changes = 0;
  const tracker = new SignalRenderTracker(() => { changes++; });
  const s = signal(0);
  tracker.begin();
  s();
  tracker.end();
  s.set(1);
  assert.equal(changes, 1);
  tracker.begin();
  s();
  tracker.end();
  s.set(2);
  assert.equal(changes, 2);
  tracker.dispose();
  s.set(3);
  assert.equal(changes, 2);
});

// --- Compiler (signals adoption) -------------------------------------------
// A signal or computed field is one stable instance held in a ref,
// like a Subject field; reads and writes in methods and templates
// route through the ref, so the author's Angular syntax survives.
// effect() in the constructor or ngOnInit is created inside an effect
// scope the mount effect opens, and every component carries a render
// tracker so signal writes re-render exactly the readers.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { compileComponent, CompileResult } from '../packages/compiler/src/compile';

function compileProject(files: Record<string, string>, entryName = 'app.component.ts'): CompileResult {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rangular-sig-'));
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

const SIGNAL_COMPONENT_TS = `
import { Component, signal, computed, effect } from '@angular/core';

@Component({
  selector: 'app-probe',
  templateUrl: './app.component.html',
})
export class AppComponent {
  count = signal(0);
  double = computed(() => this.count() * 2);

  ngOnInit() {
    effect(() => {
      console.log('count is ' + this.count());
    });
  }

  inc() {
    this.count.set(this.count() + 1);
  }
}
`;

const SIGNAL_COMPONENT_HTML = `
<p>Count: {{ count() }}</p>
<p>Double: {{ double() }}</p>
<button (click)="inc()">Add one</button>
`;

test('compiler: signal and computed fields are ref-held, reads route through the ref', () => {
  const result = compileProject({ 'app.component.ts': SIGNAL_COMPONENT_TS, 'app.component.html': SIGNAL_COMPONENT_HTML });
  assert.deepEqual(result.diagnostics.filter((d) => d.severity === 'error'), [], JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  const code = result.code!;
  assert.ok(code.includes('const countRef = useRef(signal(0));'), code);
  assert.ok(code.includes('const doubleRef = useRef(computed(() => countRef.current() * 2));'), code);
  assert.ok(code.includes('countRef.current.set(countRef.current() + 1)'), code);
  assert.ok(code.includes('{countRef.current()}'), code);
  assert.ok(code.includes('{doubleRef.current()}'), code);
  assert.ok(code.includes('signal') && code.includes('computed') && code.includes('effect'), code);
});

test('compiler: effect in ngOnInit is wrapped in an effect scope with cleanup', () => {
  const result = compileProject({ 'app.component.ts': SIGNAL_COMPONENT_TS, 'app.component.html': SIGNAL_COMPONENT_HTML });
  const code = result.code!;
  assert.ok(code.includes('beginEffectScope();'), code);
  assert.ok(code.includes('const __endEffects = endEffectScope();'), code);
  assert.ok(code.includes('__endEffects();'), code);
  assert.equal(result.diagnostics.some((d) => d.code === 'GEN_SIGNAL_EFFECT_CONTEXT'), false);
});

test('compiler: effect outside the lifecycle warns GEN_SIGNAL_EFFECT_CONTEXT', () => {
  const ts = `
import { Component, signal, effect } from '@angular/core';

@Component({ selector: 'app-x', templateUrl: './app.component.html' })
export class AppComponent {
  count = signal(0);

  start() {
    effect(() => { console.log(this.count()); });
  }
}
`;
  const result = compileProject({ 'app.component.ts': ts, 'app.component.html': '<p>{{ count() }}</p>' });
  assert.equal(result.diagnostics.some((d) => d.code === 'GEN_SIGNAL_EFFECT_CONTEXT'), true, JSON.stringify(result.diagnostics));
});

test('compiler: computed reading a plain field degrades with GEN_SIGNAL_SCOPE', () => {
  const ts = `
import { Component, signal, computed } from '@angular/core';

@Component({ selector: 'app-x', templateUrl: './app.component.html' })
export class AppComponent {
  count = signal(0);
  factor = 3;
  scaled = computed(() => this.count() * this.factor);
}
`;
  const result = compileProject({ 'app.component.ts': ts, 'app.component.html': '<p>{{ scaled() }}</p>' });
  assert.equal(result.diagnostics.some((d) => d.code === 'GEN_SIGNAL_SCOPE'), true, JSON.stringify(result.diagnostics));
  assert.ok(result.code!.includes('const scaledRef = useRef(undefined);'), result.code!);
});

test('compiler: a service signal field is a verbatim class field', () => {
  const ts = `
import { Component } from '@angular/core';
import { CounterService } from './counter.service';

@Component({ selector: 'app-x', templateUrl: './app.component.html' })
export class AppComponent {
  constructor(public svc: CounterService) {}

  add() {
    this.svc.add();
  }
}
`;
  const svc = `
import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CounterService {
  total = signal(0);

  add() {
    this.total.set(this.total() + 1);
  }
}
`;
  const result = compileProject({
    'app.component.ts': ts,
    'app.component.html': '<p>Total: {{ svc.total() }}</p><button (click)="add()">Add</button>',
    'counter.service.ts': svc,
  });
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  assert.ok(result.code!.includes('total = signal(0);'), result.code!);
  assert.ok(result.code!.includes('{svc.total()}'), result.code!);
});

test('compiler: every component carries the render tracker around its return', () => {
  const ts = `
import { Component } from '@angular/core';

@Component({ selector: 'app-x', templateUrl: './app.component.html' })
export class AppComponent {
  name = 'World';
}
`;
  const result = compileProject({ 'app.component.ts': ts, 'app.component.html': '<p>Hello {{ name }}</p>' });
  const code = result.code!;
  assert.ok(code.includes('const __sigTracker = useRef(new SignalRenderTracker(__sigBump));'), code);
  assert.ok(code.includes('__sigTracker.current.begin();'), code);
  assert.ok(code.includes('__sigTracker.current.end();'), code);
});

// --- Preview parity (signals adoption) --------------------------------------
// The preview page carries a plain-JS mirror of the reactive core.
// These tests run the shipped probes' previews in the DOM shim: a
// component signal and its computed update on click, an effect in
// ngOnInit observes the writes, and a service signal drives a
// component template, exactly as the generated app behaves.

import * as vm from 'node:vm';
import { renderPreview } from '../packages/compiler/src/preview/renderPreview';

function previewOf(result: CompileResult): string {
  return renderPreview(result.component!, result.ast!, {
    children: result.children,
    services: result.services,
    routes: result.routes,
    pipes: result.pipes,
    directives: result.directives,
  });
}

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

function loadPreview(html: string, logs: string[]): ShimElement {
  const app = new ShimElement('div');
  const toggle = new ShimElement('button');
  const documentElement = new ShimElement('html');
  const documentShim = {
    createElement: (tag: string) => new ShimElement(tag),
    createTextNode: (text: string) => new ShimText(text),
    getElementById: (id: string) => (id === 'app' ? app : id === 'theme-toggle' ? toggle : null),
    documentElement,
  };
  const consoleShim = {
    log: (...args: unknown[]) => { logs.push(args.map(String).join(' ')); },
    warn: () => undefined,
    error: () => undefined,
  };
  const script = html.split('<script>')[1].split('</script>')[0];
  vm.runInNewContext(script, { document: documentShim, console: consoleShim, setTimeout, clearTimeout });
  return app;
}

function findAll(el: ShimElement, pred: (e: ShimElement) => boolean, out: ShimElement[] = []): ShimElement[] {
  if (pred(el)) out.push(el);
  for (const child of el.children) {
    if (child instanceof ShimElement) findAll(child, pred, out);
  }
  return out;
}

const buttonOf = (app: ShimElement, text: string) =>
  findAll(app, (e) => e.className.split(/\s+/).includes('btn') && e.textContent.includes(text))[0];

test('preview: a component signal and its computed update on click; the ngOnInit effect observes', () => {
  const result = compileProject({ 'app.component.ts': SIGNAL_COMPONENT_TS, 'app.component.html': SIGNAL_COMPONENT_HTML });
  const logs: string[] = [];
  const app = loadPreview(previewOf(result), logs);
  assert.ok(app.textContent.includes('Count: 0'), app.textContent);
  assert.ok(app.textContent.includes('Double: 0'), app.textContent);
  buttonOf(app, 'Add one').click();
  assert.ok(app.textContent.includes('Count: 1'), app.textContent);
  assert.ok(app.textContent.includes('Double: 2'), app.textContent);
  buttonOf(app, 'Add one').click();
  assert.ok(app.textContent.includes('Count: 2'), app.textContent);
  assert.ok(app.textContent.includes('Double: 4'), app.textContent);
  assert.deepEqual(logs, ['count is 0', 'count is 1', 'count is 2']);
});

test('preview: a service signal drives the component template', () => {
  const ts = `
import { Component } from '@angular/core';
import { CounterService } from './counter.service';

@Component({ selector: 'app-x', templateUrl: './app.component.html' })
export class AppComponent {
  constructor(public svc: CounterService) {}

  add() {
    this.svc.add();
  }
}
`;
  const svc = `
import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CounterService {
  total = signal(0);
  double = computed(() => this.total() * 2);

  add() {
    this.total.set(this.total() + 1);
  }
}
`;
  const result = compileProject({
    'app.component.ts': ts,
    'app.component.html': '<p>Total: {{ svc.total() }}</p><p>Double: {{ svc.double() }}</p><button (click)="add()">Add</button>',
    'counter.service.ts': svc,
  });
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  const app = loadPreview(previewOf(result), []);
  assert.ok(app.textContent.includes('Total: 0'), app.textContent);
  assert.ok(app.textContent.includes('Double: 0'), app.textContent);
  buttonOf(app, 'Add').click();
  assert.ok(app.textContent.includes('Total: 1'), app.textContent);
  assert.ok(app.textContent.includes('Double: 2'), app.textContent);
});

test('the shipped signals example compiles clean and its preview behaves', () => {
  const dir = path.join(__dirname, '..', '..', 'examples', 'signals');
  const result = compileProject({
    'signals.component.ts': fs.readFileSync(path.join(dir, 'signals.component.ts'), 'utf8'),
    'signals.component.html': fs.readFileSync(path.join(dir, 'signals.component.html'), 'utf8'),
  }, 'signals.component.ts');
  assert.deepEqual(result.diagnostics, [], JSON.stringify(result.diagnostics));
  const app = loadPreview(previewOf(result), []);
  assert.ok(app.textContent.includes('Count: 0'), app.textContent);
  assert.ok(app.textContent.includes('Double, computed: 0'), app.textContent);
  assert.ok(app.textContent.includes('The effect has seen: 0'), app.textContent);
  buttonOf(app, 'Add one').click();
  assert.ok(app.textContent.includes('Count: 1'), app.textContent);
  assert.ok(app.textContent.includes('Double, computed: 2'), app.textContent);
  assert.ok(app.textContent.includes('The effect has seen: 1'), app.textContent);
  buttonOf(app, 'Reset').click();
  assert.ok(app.textContent.includes('Count: 0'), app.textContent);
  assert.ok(app.textContent.includes('The effect has seen: 0'), app.textContent);
});
