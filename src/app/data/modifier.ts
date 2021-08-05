import {ModifierType} from "./enum/modifierType";
import {ArmorStat, SpecialArmorStat} from "./enum/armor-stat";
import {ModOrAbility} from "./enum/modOrAbility";

export interface ModifierValue {
  stat: ArmorStat | SpecialArmorStat;
  value: number;
}

export interface Modifier {
  id: ModOrAbility,
  name: string;
  type: ModifierType;
  bonus: ModifierValue[];
}
