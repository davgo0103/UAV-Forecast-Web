/** Web Vibration API wrapper — silently no-ops on unsupported platforms (e.g. iOS Safari) */
function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // unsupported, ignore
  }
}

/** Light tick for each slider step */
export const hapticTick = () => vibrate(6)

/** Stronger bump when hitting a boundary */
export const hapticBump = () => vibrate(20)
