import {Component, Input, OnDestroy, OnInit} from '@angular/core';
import { Subject } from 'rxjs';
import {CharacterClass} from "../../../../data/enum/character-Class";
import {ConfigurationService} from "../../../../services/configuration.service";
import {takeUntil} from "rxjs/operators";

@Component({
  selector: 'app-desired-class-selection',
  templateUrl: './desired-class-selection.component.html',
  styleUrls: ['./desired-class-selection.component.scss']
})
export class DesiredClassSelectionComponent implements OnInit, OnDestroy  {

  @Input() availableClasses: CharacterClass[] = [0,1,2]
  selectedClass = -1;

  constructor(public config: ConfigurationService) {
  }

  ngOnInit(): void {
    this.config.configuration
      .pipe(takeUntil(this.ngUnsubscribe))
      .subscribe(
      c => this.selectedClass = c.characterClass
    )
  }

  selectClass(clazz: number) {
    this.config.modifyConfiguration(d => {
      d.characterClass = clazz;
      d.selectedExotics = [];
    });
  }

  private ngUnsubscribe = new Subject();
  ngOnDestroy() {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }
}
