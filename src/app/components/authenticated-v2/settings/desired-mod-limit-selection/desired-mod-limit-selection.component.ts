import {Component, OnInit} from '@angular/core';
import {ArmorSlot} from 'src/app/data/enum/armor-slot';
import {ConfigurationService} from "../../../../services/configuration.service";
import {ArmorPerkOrSlot} from "../../../../data/enum/armor-stat";
import {environment} from "../../../../../environments/environment";

@Component({
  selector: 'app-desired-mod-selection',
  templateUrl: './desired-mod-limit-selection.component.html',
  styleUrls: ['./desired-mod-limit-selection.component.scss']
})
export class DesiredModLimitSelectionComponent implements OnInit {
  readonly ArmorSlot = ArmorSlot;
  readonly ArmorPerkOrSlot = ArmorPerkOrSlot;

  public possibilityList = [true, true, true, true, true]
  public allPossible = true;
  public disabledSlotLimitation = !environment.featureFlags.enableModslotLimitation;


  constructor(public config: ConfigurationService) {
  }

  ngOnInit(): void {
  }


  updatePossibility(n: number, state: boolean) {
    this.possibilityList[n] = state;
    this.allPossible = this.possibilityList.filter(k => !!k).length ==  5
  }

  clear() {
    this.config.modifyConfiguration(c => {
      for (let n = 0; n < 5; n++) {
        c.armorPerks[n + 1 as ArmorSlot] = {fixed: true, value: 0}
        c.maximumModSlots[n + 1 as ArmorSlot] = {fixed: true, value: 5}
      }
    })
  }

}
