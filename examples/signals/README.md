# Recipe: Signals, reactive values the Angular way

**Intent**: Hold a counter in a `signal`, derive its double with a `computed` value that updates itself, and let an `effect` mirror every count into a plain field, all in Angular's own syntax: read by calling, write with `set` and `update`.

**Source**

`signals.component.ts`:

```ts
import { Component, signal, computed, effect } from '@angular/core';

@Component({
  selector: 'app-signals',
  templateUrl: './signals.component.html',
})
export class SignalsComponent {
  count = signal(0);
  double = computed(() => this.count() * 2);
  lastSeen = 0;

  ngOnInit() {
    effect(() => {
      this.lastSeen = this.count();
    });
  }

  add() {
    this.count.update((n) => n + 1);
  }

  reset() {
    this.count.set(0);
  }
}
```

`signals.component.html`:

```html
<screen>
  <appbar title="Signals"></appbar>
  <h2>Count: {{ count() }}</h2>
  <p>Double, computed: {{ double() }}</p>
  <p>The effect has seen: {{ lastSeen }}</p>
  <button (click)="add()">Add one</button>
  <button (click)="reset()">Reset</button>
</screen>
```

**What it compiles to**

Key lines of the generated `signals.component.tsx`:

```tsx
import { SignalRenderTracker, beginEffectScope, computed, effect, endEffectScope, signal } from '@rangular-framework/runtime';

export default function Signals() {
  const [, __sigBump] = useReducer((n: number) => n + 1, 0);
  const __sigTracker = useRef(new SignalRenderTracker(__sigBump));
  const [lastSeen, setLastSeen] = useState(0);
  const countRef = useRef(signal(0));                                   // one signal for the component's whole life
  const doubleRef = useRef(computed(() => countRef.current() * 2));     // the computed arrow reads through the ref
  const ngOnInit = () => {
    effect(() => {
  setLastSeen(countRef.current());
});
  };
  const add = () => {
    countRef.current.update((n) => n + 1);                              // methods write through the ref
  };
  useEffect(() => {
    beginEffectScope();                                                 // effects created on mount are destroyed on unmount
    ngOnInit();
    const __endEffects = endEffectScope();
    return () => {
      __endEffects();
    };
  }, []);
  __sigTracker.current.begin();                                         // the view's signal reads subscribe this component
  try {
    return (
      <RgScreen>
        <RgText variant="heading">Count: {countRef.current()}</RgText>
```

**Rules used**

- **Signals are the runtime package's reactive core.** `signal`, `computed`, `effect` and `untracked` come from `@angular/core` in source and from `@rangular-framework/runtime` in the generated code, with Angular's semantics: a signal is read by calling it, `computed` is lazy and cached and never observes a half-updated mix, and dependency tracking is automatic, whatever a computed or an effect read last is what it follows.
- **A signal field is one stable instance.** A field initialised with `signal(...)` or `computed(...)` is held in a `useRef`, never state and never a per-render const: a signal recreated on a render would lose its value and orphan every reader. Methods and templates read it as `nameRef.current` everywhere. In a service the same field is a plain class field, emitted verbatim, and any component whose view reads it subscribes to it.
- **The render tracker is how a write reaches the screen.** Every generated component opens its tracker just before its view is evaluated and closes it right after, so every signal the view reads, directly, through a method it calls, or through an injected service, subscribes exactly that component. A write re-renders the readers, at component granularity.
- **Effects live and die with the component.** An `effect()` created in the constructor or `ngOnInit` is registered in a scope the mount effect opens, and the scope's cleanup destroys it on unmount. An effect created anywhere else still runs, but nothing destroys it with the component, and codegen says so with `GEN_SIGNAL_EFFECT_CONTEXT`. Effects re-run through a queue, never inside the write itself.
- **A computed value reads signals only.** Inside `computed(...)`, reads of plain fields or methods cannot be tracked; codegen reports them with `GEN_SIGNAL_SCOPE` and degrades the field. Derive from plain fields with a method, which the template calls fresh on every render, and keep `computed` for signal inputs. Writing a signal inside a computed is an error in the core, as in Angular.
- The preview carries a plain-JS mirror of the core with the same semantics (its effects re-run synchronously instead of through the queue), so the page behaves like the app.

**Common mistakes**

- **Reading a signal without calling it.** `{{ count }}` prints the signal object itself, not its value. A signal is always read as `count()`, in templates and in methods alike.
- **Assigning a signal field in a method.** `this.count = signal(5)` would swap the instance and strand every reader of the old one. Create the signal in the field initializer and write with `set` or `update`.
- **Storing what a computed can derive.** A second field kept in step by hand is two copies of one fact. If the value follows from signals, write it once as a `computed` and let it track.
