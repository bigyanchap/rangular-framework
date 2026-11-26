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
