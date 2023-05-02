import {Component, Input, OnInit} from '@angular/core';
import {Modifier} from "../../../../data/modifier";
import {ArmorStat, ArmorStatNames} from "../../../../data/enum/armor-stat";
import {
  ABILITY_COOLDOWN_RATIO_PER_TIER,
  CLASS_COOLDOWN_RATIO_PER_TIER,
  formatTimeMMMSS,
  SUPER_COOLDOWN_RATIO_PER_TIER
} from "../../../../data/cooldowns/cooldown_definitions";
import {EnumDictionary} from "../../../../data/types/EnumDictionary";
import {CharacterClass} from "../../../../data/enum/character-Class";
import {SuperAbilitiesPerClassAndTier} from "../../../../data/cooldowns/cooldowns_super";
import {ConfigurationService} from "../../../../services/configuration.service";
import {GrenadeAbilitiesPerClassAndTier} from "../../../../data/cooldowns/cooldowns_grenade";
import {MeleeAbilitiesPerClassAndTier} from "../../../../data/cooldowns/cooldowns_melee";

enum BenefitDirection {
  Positive = 1,
  Negative = -1
}

interface CooldownEntry {
  name: string;
  valueFunction: (t: number) => number,
  formatting: (t: number) => string,
  benefitDirection: BenefitDirection,
  description?: EnumDictionary<CharacterClass, string>
}

const speedTextFormatter = (t: number) => (Math.round(t * 100) / 100).toFixed(2) + "m/s";

function reformatTimeMMMSS(time: number) {
  var str = formatTimeMMMSS(time)
  if (time < 0) str = "-" + str
  return str;
}


const CooldownInfo: EnumDictionary<ArmorStat, CooldownEntry[]> = {
  [ArmorStat.Mobility]: [
    {
      name: "Speed increase",
      benefitDirection: BenefitDirection.Positive,
      valueFunction: t => t * 0.04,
      formatting: t => Math.floor(t * 100) + "%"
    },
    {
      name: "Walking Speed",
      benefitDirection: BenefitDirection.Positive,
      valueFunction: t => 5 * (1 + t * 0.04),
      formatting: speedTextFormatter
    },
    {
      name: "Strafe Speed",
      benefitDirection: BenefitDirection.Positive,
      valueFunction: t => 4.25 * (1 + t * 0.04),
      formatting: speedTextFormatter
    },
    {
      name: "Crouch Speed",
      benefitDirection: BenefitDirection.Positive,
      valueFunction: t => 2.75 * (1 + t * 0.04),
      formatting: speedTextFormatter
    },
    {
      name: "Marksman Dodge",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => 29 * CLASS_COOLDOWN_RATIO_PER_TIER[t],
      formatting: (t) => reformatTimeMMMSS(t)
    },
    {
      name: "Gamblers Dodge",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => 38 * CLASS_COOLDOWN_RATIO_PER_TIER[t],
      formatting: (t) => reformatTimeMMMSS(t)
    },
    {
      name: "Acrobat's Dodge",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => 82 * CLASS_COOLDOWN_RATIO_PER_TIER[t],
      formatting: (t) => reformatTimeMMMSS(t)
    },
  ],
  [ArmorStat.Resilience]: [
    {
      name: "Hitpoints",
      benefitDirection: BenefitDirection.Positive,
      valueFunction: t => [185, 186, 187, 188, 189, 190, 192, 194, 196, 198, 200][t],
      formatting: t => t.toString()
    },
    {
      name: "PvE Damage Reduction",
      benefitDirection: BenefitDirection.Positive,
      valueFunction: t => ([0, 1, 2, 3, 4, 8, 14, 20, 26, 32, 40][t] / 100),
      formatting: t => Math.floor(t * 100) + "%"
    },
    {
      name: "Rally Barricade",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => 32 * CLASS_COOLDOWN_RATIO_PER_TIER[t],
      formatting: (t) => reformatTimeMMMSS(t)
    },
    {
      name: "Towering Barricade",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => 40 * CLASS_COOLDOWN_RATIO_PER_TIER[t],
      formatting: (t) => reformatTimeMMMSS(t)
    },
    {
      name: "Bastion Barricade",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => 82 * CLASS_COOLDOWN_RATIO_PER_TIER[t],
      formatting: (t) => reformatTimeMMMSS(t)
    },
  ],
  [ArmorStat.Recovery]: [
    {
      name: "Regeneration time",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => [9, 8.8, 8.6, 8.4, 8.2, 8.0, 7.8, 7.4, 7.0, 6.6, 6.0][t],
      formatting: t => (Math.round(t * 100) / 100).toFixed(1) + "s"
    },
    {
      name: "Rift",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => 82 * CLASS_COOLDOWN_RATIO_PER_TIER[t],
      formatting: (t) => reformatTimeMMMSS(t)
    }
  ],
  [ArmorStat.Discipline]: [
    {
      name: "Tier 1",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(182 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][0],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][0],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][0],
      }
    },
    {
      name: "Tier 2",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(152 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][1],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][1],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][1],
      }
    },
    {
      name: "Tier 3",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(121 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][2],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][2],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][2],
      }
    },
    {
      name: "Tier 4",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(105 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][3],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][3],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][3],
      }
    },
    {
      name: "Tier 5",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round( 91* ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][4],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][4],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][4],
      }
    },
    {
      name: "Tier 6",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(82 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][5],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][5],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][5],
      }
    },
    {
      name: "Tier 7",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(73 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][6],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][6],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][6],
      }
    },
    {
      name: "Tier 8",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(64 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Hunter][7],
        [CharacterClass.Warlock]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Warlock][7],
        [CharacterClass.Titan]: GrenadeAbilitiesPerClassAndTier[CharacterClass.Titan][7],
      }
    },

  ],
  [ArmorStat.Intellect]: [
    {
      name: "Tier 1",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(625 * SUPER_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: SuperAbilitiesPerClassAndTier[CharacterClass.Hunter][0],
        [CharacterClass.Warlock]: SuperAbilitiesPerClassAndTier[CharacterClass.Warlock][0],
        [CharacterClass.Titan]: SuperAbilitiesPerClassAndTier[CharacterClass.Titan][0],
      }
    },
    {
      name: "Tier 2",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(556 * SUPER_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: SuperAbilitiesPerClassAndTier[CharacterClass.Hunter][1],
        [CharacterClass.Warlock]: SuperAbilitiesPerClassAndTier[CharacterClass.Warlock][1],
        [CharacterClass.Titan]: SuperAbilitiesPerClassAndTier[CharacterClass.Titan][1],
      }
    },
    {
      name: "Tier 3",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(500 * SUPER_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: SuperAbilitiesPerClassAndTier[CharacterClass.Hunter][2],
        [CharacterClass.Warlock]: SuperAbilitiesPerClassAndTier[CharacterClass.Warlock][2],
        [CharacterClass.Titan]: SuperAbilitiesPerClassAndTier[CharacterClass.Titan][2],
      }
    },
    {
      name: "Tier 4",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(455 * SUPER_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: SuperAbilitiesPerClassAndTier[CharacterClass.Hunter][3],
        [CharacterClass.Warlock]: SuperAbilitiesPerClassAndTier[CharacterClass.Warlock][3],
        [CharacterClass.Titan]: SuperAbilitiesPerClassAndTier[CharacterClass.Titan][3],
      }
    },
    {
      name: "Tier 5",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(417 * SUPER_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: SuperAbilitiesPerClassAndTier[CharacterClass.Hunter][4],
        [CharacterClass.Warlock]: SuperAbilitiesPerClassAndTier[CharacterClass.Warlock][4],
        [CharacterClass.Titan]: SuperAbilitiesPerClassAndTier[CharacterClass.Titan][4],
      }
    },
  ],
  [ArmorStat.Strength]: [

    {
      name: "Tier 1",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(113 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: MeleeAbilitiesPerClassAndTier[CharacterClass.Hunter][0],
        [CharacterClass.Warlock]: MeleeAbilitiesPerClassAndTier[CharacterClass.Warlock][0],
        [CharacterClass.Titan]: MeleeAbilitiesPerClassAndTier[CharacterClass.Titan][0],
      }
    },
    {
      name: "Tier 2",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(109 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: MeleeAbilitiesPerClassAndTier[CharacterClass.Hunter][1],
        [CharacterClass.Warlock]: MeleeAbilitiesPerClassAndTier[CharacterClass.Warlock][1],
        [CharacterClass.Titan]: MeleeAbilitiesPerClassAndTier[CharacterClass.Titan][1],
      }
    },
    {
      name: "Tier 3",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(106 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: MeleeAbilitiesPerClassAndTier[CharacterClass.Hunter][2],
        [CharacterClass.Warlock]: MeleeAbilitiesPerClassAndTier[CharacterClass.Warlock][2],
        [CharacterClass.Titan]: MeleeAbilitiesPerClassAndTier[CharacterClass.Titan][2],
      }
    },
    {
      name: "Tier 4",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(100 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: MeleeAbilitiesPerClassAndTier[CharacterClass.Hunter][3],
        [CharacterClass.Warlock]: MeleeAbilitiesPerClassAndTier[CharacterClass.Warlock][3],
        [CharacterClass.Titan]: MeleeAbilitiesPerClassAndTier[CharacterClass.Titan][3],
      }
    },
    {
      name: "Tier 5",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(90 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: MeleeAbilitiesPerClassAndTier[CharacterClass.Hunter][4],
        [CharacterClass.Warlock]: MeleeAbilitiesPerClassAndTier[CharacterClass.Warlock][4],
        [CharacterClass.Titan]: MeleeAbilitiesPerClassAndTier[CharacterClass.Titan][4],
      }
    },
    {
      name: "Tier 6",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(82 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: MeleeAbilitiesPerClassAndTier[CharacterClass.Hunter][5],
        [CharacterClass.Warlock]: MeleeAbilitiesPerClassAndTier[CharacterClass.Warlock][5],
        [CharacterClass.Titan]: MeleeAbilitiesPerClassAndTier[CharacterClass.Titan][5],
      }
    },
    {
      name: "Tier 7",
      benefitDirection: BenefitDirection.Negative,
      valueFunction: t => Math.round(45 * ABILITY_COOLDOWN_RATIO_PER_TIER[t]),
      formatting: t => reformatTimeMMMSS(t),
      description: {
        [CharacterClass.None]: "",
        [CharacterClass.Hunter]: MeleeAbilitiesPerClassAndTier[CharacterClass.Hunter][6],
        [CharacterClass.Warlock]: MeleeAbilitiesPerClassAndTier[CharacterClass.Warlock][6],
        [CharacterClass.Titan]: MeleeAbilitiesPerClassAndTier[CharacterClass.Titan][6],
      }
    },
  ],
}

@Component({
  selector: 'app-stat-cooldown-tooltip',
  templateUrl: './stat-cooldown-tooltip.component.html',
  styleUrls: ['./stat-cooldown-tooltip.component.css']
})
export class StatCooldownTooltipComponent implements OnInit {

  public ArmorStatNames = ArmorStatNames;

  @Input() tier: number = 0;
  @Input() differenceTier: number = 0; // the tier we use to show a difference for
  @Input() stat: ArmorStat = ArmorStat.Mobility;

  public entries: CooldownEntry[] = [];

  constructor(private config: ConfigurationService) {
  }

  get characterClass(): CharacterClass {
    return this.config.readonlyConfigurationSnapshot.characterClass;
  }

  ngOnInit(): void {
    this.entries = CooldownInfo[this.stat];
  }

  getPercentageDifference(v1: number, v2: number) {
    return (v1 - v2) / Math.max(1, v2)
  }

}
