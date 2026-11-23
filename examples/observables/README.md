# Recipe: Observables, your own streams with RxJS

**Intent**: Make two streams of your own: a Subject that counts taps through the `scan` operator, and a BehaviorSubject whose current value a template reads with the `async` pipe while a subscription mirrors it into a field.

**Source**

`observables.component.ts`:

```ts
import { Component } from '@angular/core';
import { BehaviorSubject, Subject, scan } from 'rxjs';

@Component({
  selector: 'app-observables',
  templateUrl: './observables.component.html',
})
export class ObservablesComponent {
  taps = new Subject<number>();
  mood = new BehaviorSubject<string>('Calm');
  tapCount = 0;
  lastMood = '';

  ngOnInit() {
    this.taps.pipe(scan((n: number) => n + 1, 0)).subscribe((n: number) => { this.tapCount = n; });
    this.mood.subscribe((m: string) => { this.lastMood = m; });
  }

  tap() {
    this.taps.next(1);
  }

  setMood(m: string) {
    this.mood.next(m);
  }
}
```

`observables.component.html`:

```html
<screen>
  <appbar title="Observables"></appbar>
  <h2>Taps counted by the stream: {{ tapCount }}</h2>
  <button (click)="tap()">Tap</button>
  <p>Current mood: {{ mood | async }}</p>
  <p>Last mood the subscription saw: {{ lastMood }}</p>
  <button (click)="setMood('Calm')">Calm</button>
  <button (click)="setMood('Bright')">Bright</button>
</screen>
```

**What it compiles to**

Key lines of the generated `observables.component.tsx`:

```tsx
import { BehaviorSubject, Subject, scan } from 'rxjs';

export default function Observables() {
  const [tapCount, setTapCount] = useState(0);
  const [lastMood, setLastMood] = useState('');
  const tapsRef = useRef(new Subject<number>());                      // one subject for the component's whole life
  const moodRef = useRef(new BehaviorSubject<string>('Calm'));
  const [__async0, set__async0] = useState<any>(null);
  useEffect(() => {
    const __obs = (moodRef.current) as any;                           // the async pipe subscribes to the same instance
    if (!__obs || typeof __obs.subscribe !== 'function') return;
    const __sub = __obs.subscribe((__v: any) => set__async0(__v));
    return () => { if (__sub && typeof __sub.unsubscribe === 'function') __sub.unsubscribe(); };
  }, []);
  const ngOnInit = () => {
    tapsRef.current.pipe(scan((n: number) => n + 1, 0)).subscribe((n: number) => {
  setTapCount(n);
});
    moodRef.current.subscribe((m: string) => {
  setLastMood(m);
});
  };
  const tap = () => {
    tapsRef.current.next(1);                                          // methods read the subject through the ref
  };
```

**Rules used**

- **Streams are the real RxJS package.** Imports from `rxjs` carry into the generated module like any third-party import, and the runtime package (HttpClient, form `valueChanges`, `ActivatedRoute.paramMap`, `EventEmitter`) hands out real Observables, so one operator library serves every stream in the app.
- **A subject field is one stable instance.** A field initialised with `new Subject(...)` (also `BehaviorSubject`, `ReplaySubject`, `AsyncSubject`) is held in a `useRef`, never state and never a per-render const: a subject recreated on a render would orphan everyone subscribed to the previous one. Methods and templates read it as `nameRef.current` everywhere.
- **`scan` folds a stream into a running value.** `scan((n) => n + 1, 0)` turns each tap into the next count; subscribing in `ngOnInit` and assigning a state field is the standard way to land a stream in the template.
- **A BehaviorSubject remembers.** It replays its current value to every new subscriber, which is why `lastMood` is filled at once and why `{{ mood | async }}` shows `Calm` before any tap.
- The preview carries a small mirror of these pieces (the classes and the common operators), so the page behaves like the app; the phone runs the real library.

**Common mistakes**

- **Assigning a subject field in a method.** `this.taps = new Subject()` would swap the instance and strand every subscriber of the old one. Create the subject in the field initializer and only call `next` on it.
- **Subscribing in a method that runs often.** A subscription made in `ngOnInit` lives as long as the component should listen. Subscribing inside a click handler adds one more listener per click; keep subscriptions in `ngOnInit` and unsubscribe in `ngOnDestroy` when the stream outlives the component.
- **Expecting a plain Subject to replay.** A Subject tells only its current subscribers; a value sent before the subscribe is gone. When a late reader needs the current value, use a BehaviorSubject.
