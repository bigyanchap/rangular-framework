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
