export const SUPER_COOLDOWN_RATIO_PER_TIER = [1.44, 1.276, 1.14, 1.0, 0.94, 0.90, 0.86, 0.822, 0.798, 0.776, 0.76]
export const ABILITY_COOLDOWN_RATIO_PER_TIER = [1.25, 1.14, 1.04, 1.0, 0.839, 0.72, 0.62, 0.56, 0.59, 0.45, 0.39]

export function calculateTierValueAbility(tier: number, baseValue: number) {
  return Math.round(baseValue * ABILITY_COOLDOWN_RATIO_PER_TIER[tier])
}

export function calculateTierValueSuper(tier: number, baseValue: number) {
  return Math.round(baseValue * SUPER_COOLDOWN_RATIO_PER_TIER[tier])
}

export function calculateTierValueMobility(tier: number, baseValue: number) {
  return (Math.round((baseValue + (baseValue * tier * 0.04)) * 100) / 100)
}
