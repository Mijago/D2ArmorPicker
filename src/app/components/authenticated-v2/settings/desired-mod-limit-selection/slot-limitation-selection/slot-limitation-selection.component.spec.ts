import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SlotLimitationSelectionComponent } from './slot-limitation-selection.component';

describe('SlotLimitationSelectionComponent', () => {
  let component: SlotLimitationSelectionComponent;
  let fixture: ComponentFixture<SlotLimitationSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ SlotLimitationSelectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SlotLimitationSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
