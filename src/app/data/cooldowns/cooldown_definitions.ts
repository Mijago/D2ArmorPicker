export const SUPER_COOLDOWN_RATIO_PER_TIER = [1.44, 1.276, 1.14, 1.0, 0.94, 0.90, 0.86, 0.822, 0.798, 0.776, 0.76]
export const ABILITY_COOLDOWN_RATIO_PER_TIER = [1.25, 1.14, 1.04, 1.0, 0.839, 0.72, 0.62, 0.55, 0.50, 0.455, 0.39]
export const CLASS_COOLDOWN_RATIO_PER_TIER = [1.427, 1.256, 1.11, 1.0, 0.91461, 0.829, 0.7683, 0.72, 0.622, 0.561, 0.5]

export function calculateTierValueAbility(tier: number, baseValue: number, table = ABILITY_COOLDOWN_RATIO_PER_TIER) {
  return formatTimeMMMSS(Math.round(baseValue * table[tier]))
}

export function calculateTierValueClassAbility(tier: number, baseValue: number) {
  return calculateTierValueAbility(tier, baseValue, CLASS_COOLDOWN_RATIO_PER_TIER)
}

export function calculateTierValueSuper(tier: number, baseValue: number) {
  return formatTimeMMMSS(Math.round(baseValue * SUPER_COOLDOWN_RATIO_PER_TIER[tier]))
}

export function calculateTierValueMobility(tier: number, baseValue: number) {
  return Math.round((baseValue + (baseValue * tier * 0.04)) * 100) / 100;
}

export function formatTimeMMMSS(seconds: number) {
  var min = Math.floor(seconds / 60)
  var sec = seconds - min * 60

  return `${min}:${sec < 10 ? "0" : ""}${sec}`
}
