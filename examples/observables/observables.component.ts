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
