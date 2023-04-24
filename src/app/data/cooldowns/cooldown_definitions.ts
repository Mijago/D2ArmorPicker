export const SUPER_COOLDOWN_RATIO_PER_TIER = [1.439, 1.276, 1.144, 1.0, 0.9478, 0.90, 0.8598, 0.8216, 0.798, 0.7751, 0.7651]
export const ABILITY_COOLDOWN_RATIO_PER_TIER = [1.25, 1.131, 1.039, 1.0, 0.905, 0.831, 0.766, 0.71, 0.642, 0.569, 0.498]
export const CLASS_COOLDOWN_RATIO_PER_TIER = [1.428, 1.25, 1.111, 1.0, 0.909, 0.8333, 0.7692, 0.7142, 0.666, 0.625, 0.5882]

export function formatTimeMMMSS(seconds: number) {
  seconds = Math.abs(seconds)
  var min = Math.floor(seconds / 60)
  var sec = Math.floor(seconds - min * 60)

  return `${min}:${sec < 10 ? "0" : ""}${sec}`
}
