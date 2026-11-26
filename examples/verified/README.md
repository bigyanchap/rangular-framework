# Recipe: Verified, an app the gate passes clean

**Intent**: A tiny settings page written to pass `rg verify` with
nothing to report: strict build, doctor, tests and render, all
clean. It is the smallest example of the verification contract in
[docs/VERIFICATION.md](../../docs/VERIFICATION.md): every handler
names a real method, every prop exists in the catalog, every style
value sits on its scale, and the one deliberate palette choice is
declared where a reviewer can see it.

**Source**

`verified.component.ts`:

```ts
import { Component } from '@angular/core';

@Component({
  selector: 'app-verified',
  templateUrl: './verified.component.html',
  styles: [`
    /* doctor: allow-hex: the band tint and the muted grey below are
       this page's deliberate palette, not theme roles */
    .band { background-color: #e8f0fe; padding: 16px; border-radius: 12px; }
    .rowline { flex-direction: row; align-items: center; gap: 12px; margin-top: 12px; }
    .grow { flex: 1; }
    .muted { font-size: 14px; color: #5f6368; margin-top: 8px; }
  `],
})
export class VerifiedComponent {
  title = 'Desk settings';
  notify = true;
  saves = 0;

  onNotify(value: boolean) {
    this.notify = value;
  }

  save() {
    const next = this.saves + 1;
    this.saves = next;
  }
}
```

`verified.component.html`:

```html
<screen>
  <section class="band">
    <h3>{{ title }}</h3>
    <section class="rowline">
      <p class="grow">Notifications</p>
      <switch [checked]="notify" (change)="onNotify($event)"></switch>
    </section>
  </section>
  <p class="muted">Saved {{ saves }} times</p>
  <button color="primary" (click)="save()">Save</button>
</screen>
```

**What it compiles to**

A screen with a tinted band holding the title and the switch row, a
muted count line, and a primary button. `save()` carries its new
value in a local const and assigns the field once, so the generated
state writes are exactly the ones the source shows.

**Rules used**

- Every event binding names a method the component has; a missing
  one is a `TPL_HANDLER` error, not a tap that fails later.
- Every attribute and binding is a prop of its element in the
  catalog; an invented one is a `GEN_UNKNOWN_PROP` error with the
  near match when one exists.
- Style values sit on the spacing, radius and type scales; an
  off-scale value warns `STYLE_OFF_SCALE` and fails a strict build.
- A field is assigned once per method run on each path; assigning,
  reading and assigning again warns `GEN_FIELD_REREAD`.
- Deliberate hex colours are declared with a `doctor: allow-hex`
  comment in the style text itself, so the doctor passes with zero
  findings and the exception stays visible in review.

**Common mistakes**

- Writing `(click)="sav()"` for a method named `save`: named by
  `TPL_HANDLER` at compile time.
- Writing `colour="primary"` on the button: named by
  `GEN_UNKNOWN_PROP`, and `rg fix` renames it on its own.
- Writing `margin-top: 7px`: snapped with a `STYLE_OFF_SCALE`
  warning, a failure under strict mode, and `rg fix` writes the 8
  back into the source.
- Counting with `this.saves = this.saves + 1; this.saves = this.saves + 1;`
  style double assignment after a read: named by `GEN_FIELD_REREAD`;
  carry the value in a local and assign once.
