/**
 * Maps a staleness score (0 = fresh, 1 = fully stale) to a color
 * on a gradient from bright green (fresh sprout) to pale brown (autumn leaf).
 *
 * Uses HSL interpolation for a natural-looking progression:
 * green -> yellow-green -> yellow -> amber -> pale brown
 */
export function getStalenessColor(score: number): string {
  const clamped = Math.max(0, Math.min(1, score));

  const freshHue = 142;
  const freshSat = 71;
  const freshLight = 45;

  const staleHue = 30;
  const staleSat = 40;
  const staleLight = 59;

  const h = Math.round(freshHue + (staleHue - freshHue) * clamped);
  const s = Math.round(freshSat + (staleSat - freshSat) * clamped);
  const l = Math.round(freshLight + (staleLight - freshLight) * clamped);

  return `hsl(${h}, ${s}%, ${l}%)`;
}

export function getStalenessScore(
  commitsBehind: number,
  commitCeiling: number
): number {
  if (commitCeiling <= 0) return 0;
  return Math.min(commitsBehind / commitCeiling, 1);
}
