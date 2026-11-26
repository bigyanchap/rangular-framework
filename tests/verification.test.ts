import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { compileComponent } from '../packages/compiler/src/compile';
import { parsePrimitives } from '../packages/compiler/src/catalog';
import { TAG_MAP } from '../packages/compiler/src/codegen/generate';
import { ELEMENT_PROPS } from '../packages/compiler/src/propTable';

// Verification fortification (2026-11-26): the checks that keep a
// vibe-coded app honest. A handler naming a missing method and a prop
// the element does not have are compile errors, the prop table can
// never drift from the primitives, and strict mode fails a build on
// warnings, so nothing is dropped or snapped quietly.

const ROOT = path.join(__dirname, '..', '..');
const cliPath = path.join(ROOT, 'dist', 'packages', 'cli', 'src', 'cli.js');

function compile(template: string, classBody = '') {
  const tsSource = [
    `import { Component } from '@angular/core';`,
    `@Component({ selector: 'app-t', template: \`${template.replace(/`/g, '')}\` })`,
    `export class TComponent { ${classBody} }`,
  ].join('\n');
  return compileComponent({ tsSource, resolveFile: () => undefined });
}

test('TPL_HANDLER: a binding to a missing method is a compile error', () => {
  const result = compile('<button (click)="save()">Save</button>');
  const diag = result.diagnostics.find((d) => d.code === 'TPL_HANDLER');
  assert.ok(diag, JSON.stringify(result.diagnostics));
  assert.equal(diag.severity, 'error');
  assert.match(diag.message, /'save'/);
  assert.match(diag.fix ?? '', /Add a method named save/);
});

test('TPL_HANDLER: an existing method and a member call stay silent', () => {
  const ok = compile('<button (click)="save()">Save</button>', 'save() {}');
  assert.equal(ok.diagnostics.some((d) => d.code === 'TPL_HANDLER'), false, JSON.stringify(ok.diagnostics));
  const member = compile('<button (click)="svc.save()">Save</button>', 'svc: any;');
  assert.equal(member.diagnostics.some((d) => d.code === 'TPL_HANDLER'), false, JSON.stringify(member.diagnostics));
});

test('GEN_UNKNOWN_PROP: a misspelled prop errors and suggests the near match', () => {
  const result = compile('<button colour="red">Go</button>');
  const diag = result.diagnostics.find((d) => d.code === 'GEN_UNKNOWN_PROP');
  assert.ok(diag, JSON.stringify(result.diagnostics));
  assert.equal(diag.severity, 'error');
  assert.match(diag.fix ?? '', /Did you mean 'color'/);
});

test('GEN_UNKNOWN_PROP: real props, form extras and class toggles stay silent', () => {
  const cases: [string, string][] = [
    ['<button color="danger" type="submit">Go</button>', ''],
    ['<input label="Name" required minlength="2" />', ''],
    ['<p [class.hot]="flag">Hi</p>', 'flag = true;'],
    ['<div formArrayName="members"><p>x</p></div>', ''],
  ];
  for (const [template, body] of cases) {
    const result = compile(template, body);
    assert.equal(
      result.diagnostics.some((d) => d.code === 'GEN_UNKNOWN_PROP'),
      false,
      `${template} -> ${JSON.stringify(result.diagnostics)}`,
    );
  }
});

test('prop table: ELEMENT_PROPS matches the primitives it was generated from', () => {
  const source = fs.readFileSync(path.join(ROOT, 'packages', 'ui', 'src', 'primitives.tsx'), 'utf8');
  const prims = parsePrimitives(source);
  const byName = new Map(prims.map((p) => [p.name, p.props.map((x) => x.name)]));
  const expected: Record<string, string[]> = {};
  for (const [tag, m] of Object.entries(TAG_MAP)) {
    if (!m.fromUi) continue;
    const props = byName.get(m.component);
    assert.ok(props, `no primitive parsed for ${tag} (${m.component})`);
    expected[tag] = props.filter((n) => n !== 'children' && !/^on[A-Z]/.test(n)).sort();
  }
  assert.deepEqual(ELEMENT_PROPS, expected);
});

function makeWarnApp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-strict-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'app.component.ts'), [
    "import { Component } from '@angular/core';",
    '',
    '@Component({',
    "  selector: 'app-root',",
    "  template: '<p class=\"x\">Hi</p>',",
    '  styles: [`.x { padding: 7px; }`],',
    '})',
    'export class AppComponent {}',
    '',
  ].join('\n'));
  return dir;
}

function runCli(dir: string, args: string[]) {
  return spawnSync('node', [cliPath, ...args], { cwd: dir, encoding: 'utf8' });
}

test('strict mode: a warning fails the build only under strict', () => {
  const loose = makeWarnApp();
  const looseRun = runCli(loose, ['build']);
  assert.equal(looseRun.status, 0, looseRun.stderr);
  assert.ok(fs.existsSync(path.join(loose, 'src', 'AppRoot.tsx')));

  const flagged = makeWarnApp();
  const flaggedRun = runCli(flagged, ['build', '--strict']);
  assert.equal(flaggedRun.status, 1, flaggedRun.stdout);
  assert.match(flaggedRun.stderr, /strict mode/);

  const configured = makeWarnApp();
  fs.writeFileSync(path.join(configured, 'rangular.json'), '{\n  "strict": true\n}\n');
  const configuredRun = runCli(configured, ['build']);
  assert.equal(configuredRun.status, 1, configuredRun.stdout);
  const overridden = runCli(configured, ['build', '--no-strict']);
  assert.equal(overridden.status, 0, overridden.stderr);
});

test('scaffold: rg init --app writes the AI guide file and strict config', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-init-'));
  const appDir = path.join(base, 'myapp');
  const run = runCli(base, ['init', appDir, '--app']);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  const agents = fs.readFileSync(path.join(appDir, 'AGENTS.md'), 'utf8');
  assert.match(agents, /verify loop/);
  assert.match(agents, /Nothing fails silently/);
  const cfg = JSON.parse(fs.readFileSync(path.join(appDir, 'rangular.json'), 'utf8'));
  assert.equal(cfg.strict, true);
});

test('GEN_FIELD_REREAD: assign, read, assign again in one method warns', () => {
  const trapped = compile('<p>{{ total }}</p>', 'total = 0; bump() { this.total = 1; this.show(this.total); this.total = 2; } show(n: number) {}');
  const diag = trapped.diagnostics.find((d) => d.code === 'GEN_FIELD_REREAD');
  assert.ok(diag, JSON.stringify(trapped.diagnostics));
  assert.equal(diag.severity, 'warning');
  assert.match(diag.message, /this\.total/);
});

test('GEN_FIELD_REREAD: the safe shapes stay silent', () => {
  const cases = [
    'total = 0; bump() { this.total = this.total + 1; }',
    'total = 0; bump() { this.total = 5; this.show(this.total); } show(n: number) {}',
    'total = 0; bump() { const next = this.total + 1; this.total = next; }',
    'total = 0; bump() { this.total = 1; } again() { this.total = 2; }',
  ];
  for (const body of cases) {
    const result = compile('<p>{{ total }}</p>', body);
    assert.equal(
      result.diagnostics.some((d) => d.code === 'GEN_FIELD_REREAD'),
      false,
      `${body} -> ${JSON.stringify(result.diagnostics)}`,
    );
  }
});

test('rg verify: a clean app passes all four stages', () => {
  const dir = makeWarnApp();
  fs.writeFileSync(path.join(dir, 'src', 'app.component.ts'), [
    "import { Component } from '@angular/core';",
    '',
    '@Component({',
    "  selector: 'app-root',",
    "  template: '<p>Hi</p>',",
    '})',
    'export class AppComponent {}',
    '',
  ].join('\n'));
  const run = runCli(dir, ['verify']);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stdout, /verify: build +PASS/);
  assert.match(run.stdout, /verify: render +PASS/);
  assert.match(run.stdout, /verify: OK/);
});

test('rg verify: a warning fails the gate, --no-strict lets it pass', () => {
  const dir = makeWarnApp();
  const run = runCli(dir, ['verify']);
  assert.equal(run.status, 1, run.stdout);
  assert.match(run.stdout, /verify: FAIL/);
  const loose = runCli(dir, ['verify', '--no-strict']);
  assert.equal(loose.status, 0, loose.stderr + loose.stdout);
});

test('rg verify --json: the stages arrive as data', () => {
  const dir = makeWarnApp();
  const run = runCli(dir, ['verify', '--json']);
  assert.equal(run.status, 1);
  const payload = JSON.parse(run.stdout);
  assert.equal(payload.ok, false);
  assert.equal(payload.stages.build.warnings > 0, true);
  assert.ok(Array.isArray(payload.diagnostics));
});

test('GEN_FIELD_REREAD: the if/else toggle shape in a component stays silent', () => {
  const body = 'items = [1]; toggle(id: number) { if (this.has(id)) { this.items = this.items.filter((x) => x !== id); } else { this.items = [...this.items, id]; } } has(n: number) { return true; }';
  const result = compile('<p>{{ items.length }}</p>', body);
  assert.equal(
    result.diagnostics.some((d) => d.code === 'GEN_FIELD_REREAD'),
    false,
    JSON.stringify(result.diagnostics),
  );
});

test('GEN_FIELD_REREAD: a read inside a branch between two writes still flags', () => {
  const body = 'total = 0; flag = true; bump() { this.total = 1; if (this.flag) { this.show(this.total); } this.total = 2; } show(n: number) {}';
  const result = compile('<p>{{ total }}</p>', body);
  assert.ok(
    result.diagnostics.some((d) => d.code === 'GEN_FIELD_REREAD'),
    JSON.stringify(result.diagnostics),
  );
});

test('GEN_FIELD_REREAD: a service method with the same shape stays silent', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-reread-svc-'));
  fs.writeFileSync(path.join(dir, 'store.service.ts'), [
    "import { Injectable } from '@angular/core';",
    "@Injectable({ providedIn: 'root' })",
    'export class Store {',
    '  items = [1];',
    '  cycle() { this.items = [2]; this.show(this.items); this.items = [3]; }',
    '  show(x: number[]) {}',
    '}',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'app.component.ts'), [
    "import { Component } from '@angular/core';",
    "import { Store } from './store.service';",
    "@Component({ selector: 'app-t', template: '<p>x</p>' })",
    'export class TComponent { constructor(public store: Store) {} }',
    '',
  ].join('\n'));
  const entry = path.join(dir, 'app.component.ts');
  const result = compileComponent({
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
  assert.match(result.code, /Store/, 'the service really compiled');
  assert.equal(
    result.diagnostics.some((d) => d.code === 'GEN_FIELD_REREAD'),
    false,
    JSON.stringify(result.diagnostics),
  );
});

test('rg fix: snapped values written back, dead CSS removed, near-match prop renamed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rg-fix-'));
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'app.component.ts'), [
    "import { Component } from '@angular/core';",
    '',
    '@Component({',
    "  selector: 'app-root',",
    "  templateUrl: './app.component.html',",
    "  styleUrls: ['./app.component.css'],",
    '})',
    'export class AppComponent {',
    "  title = 'Hello';",
    '}',
    '',
  ].join('\n'));
  fs.writeFileSync(path.join(dir, 'src', 'app.component.html'), '<h1 class="x">{{ title }}</h1>\n<button colour="danger">Go</button>\n');
  fs.writeFileSync(path.join(dir, 'src', 'app.component.css'), '.x { padding: 7px; border-bottom-width: 2px; }\n');
  const run = runCli(dir, ['fix']);
  assert.equal(run.status, 0, run.stderr + run.stdout);
  assert.match(run.stdout, /STYLE_OFF_SCALE/);
  assert.match(run.stdout, /CSS_UNSUPPORTED/);
  assert.match(run.stdout, /GEN_UNKNOWN_PROP/);
  const css = fs.readFileSync(path.join(dir, 'src', 'app.component.css'), 'utf8');
  assert.match(css, /padding: 8px/);
  assert.match(css, /rg fix: removed 'border-bottom-width'/);
  const html = fs.readFileSync(path.join(dir, 'src', 'app.component.html'), 'utf8');
  assert.match(html, /color="danger"/);
  const again = runCli(dir, ['fix']);
  assert.equal(again.status, 0, again.stderr + again.stdout);
  assert.match(again.stdout, /nothing mechanical to apply/);
});
