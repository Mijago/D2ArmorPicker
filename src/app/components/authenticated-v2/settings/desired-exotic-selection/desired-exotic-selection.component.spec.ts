import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DesiredExoticSelectionComponent } from './desired-exotic-selection.component';

describe('DesiredExoticSelectionComponent', () => {
  let component: DesiredExoticSelectionComponent;
  let fixture: ComponentFixture<DesiredExoticSelectionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ DesiredExoticSelectionComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(DesiredExoticSelectionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
