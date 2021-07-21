import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StatModAmountComponent } from './stat-mod-amount.component';

describe('StatModAmountComponent', () => {
  let component: StatModAmountComponent;
  let fixture: ComponentFixture<StatModAmountComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ StatModAmountComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StatModAmountComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
